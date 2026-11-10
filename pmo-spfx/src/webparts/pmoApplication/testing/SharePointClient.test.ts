jest.mock("@microsoft/sp-http", () => ({
  SPHttpClient: { configurations: { v1: {} } },
}));

import type { SPHttpClient, SPHttpClientResponse } from "@microsoft/sp-http";
import { pmoEnvironment } from "../config/environment";
import { PMO_LISTS } from "../config/sharePointSchema";
import {
  SharePointClient,
  SharePointError,
  classifySharePointStatus,
} from "../services/sharepoint/SharePointClient";

const response = (
  status: number,
  payload: unknown,
  headers: Readonly<Record<string, string>> = {},
): SPHttpClientResponse => {
  const fake = {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        headers[name] ?? headers[name.toLowerCase()] ?? null,
    },
    json: jest.fn().mockResolvedValue(payload),
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
    clone: (): unknown => fake,
  };
  return fake as unknown as SPHttpClientResponse;
};

const createTransport = (): {
  readonly get: jest.Mock;
  readonly post: jest.Mock;
} => ({
  get: jest.fn(),
  post: jest.fn(),
});

describe("SharePointClient", () => {
  it("builds bounded selected, filtered, ordered queries", async () => {
    const transport = createTransport();
    transport.get.mockResolvedValue(
      response(200, { value: [{ ID: 1 }], "@odata.nextLink": "/next" }),
    );
    const client = new SharePointClient(
      transport as unknown as SPHttpClient,
      pmoEnvironment,
    );
    const page = await client.query(PMO_LISTS.workItems, {
      select: ["ID", "Title"],
      filter: "ProjectId eq 1",
      orderBy: ["PlannedEnd asc"],
      top: 50,
    });
    const url = transport.get.mock.calls[0]?.[0] as string;
    expect(url).toContain("getbytitle('PMO_WorkItems')/items");
    expect(url).toContain("%24select=ID%2CTitle");
    expect(url).toContain("%24filter=ProjectId+eq+1");
    expect(page.nextLink).toBe("/next");
  });

  it("gets by ID and preserves the response ETag", async () => {
    const transport = createTransport();
    transport.get.mockResolvedValue(
      response(200, { ID: 12, Title: "Task" }, { ETag: '"7"' }),
    );
    const client = new SharePointClient(
      transport as unknown as SPHttpClient,
      pmoEnvironment,
    );
    const item = await client.getById(PMO_LISTS.workItems, 12, ["ID", "Title"]);
    expect(item["@odata.etag"]).toBe('"7"');
  });

  it("rejects wildcard or missing ETags for governed updates", async () => {
    const transport = createTransport();
    const client = new SharePointClient(
      transport as unknown as SPHttpClient,
      pmoEnvironment,
    );
    await expect(
      client.update(PMO_LISTS.projects, 1, { Status: "Active" }, "*"),
    ).rejects.toThrow(/specific current ETag/);
    expect(transport.post).not.toHaveBeenCalled();
  });

  it("parses errors, correlation IDs and classifies conflicts without retrying", async () => {
    const transport = createTransport();
    transport.post.mockResolvedValue(
      response(
        412,
        { error: { code: "-1", message: { value: "Version conflict" } } },
        { SPRequestGuid: "corr-123" },
      ),
    );
    const client = new SharePointClient(
      transport as unknown as SPHttpClient,
      pmoEnvironment,
    );
    await expect(
      client.update(PMO_LISTS.projects, 1, { Status: "Active" }, '"1"'),
    ).rejects.toMatchObject<Partial<SharePointError>>({
      status: 412,
      correlationId: "corr-123",
      classification: "conflict",
      serverCode: "-1",
      requestMethod: "POST",
      requestUrl: expect.stringContaining("PMO_Projects") as string,
    });
    expect(transport.post).toHaveBeenCalledTimes(1);
  });

  it("classifies only throttling and temporary server failures as retryable", () => {
    expect(classifySharePointStatus(429)).toBe("throttled");
    expect(classifySharePointStatus(503)).toBe("temporary");
    expect(classifySharePointStatus(412)).toBe("conflict");
  });
});
