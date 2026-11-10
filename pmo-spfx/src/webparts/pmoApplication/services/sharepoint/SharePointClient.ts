import {
  SPHttpClient,
  type ISPHttpClientOptions,
  type SPHttpClientResponse,
} from "@microsoft/sp-http";
import type { IPmoEnvironmentConfiguration } from "../../config/environment";
import type { PmoContainerName } from "../../config/sharePointSchema";
import type {
  ISharePointCollectionWire,
  ISharePointItemWire,
} from "../../models/sharePoint";
import {
  SharePointError,
  type SharePointRetryClassification,
} from "./SharePointError";

export { SharePointError } from "./SharePointError";
export type { SharePointRetryClassification } from "./SharePointError";

export interface ISharePointQuery {
  readonly select: readonly string[];
  readonly expand?: readonly string[];
  readonly filter?: string;
  readonly orderBy?: readonly string[];
  readonly top?: number;
  /** An opaque absolute or site-relative next link returned by SharePoint. */
  readonly continuation?: string;
}

export interface ISharePointPage<T> {
  readonly items: readonly T[];
  readonly nextLink?: string;
}

export interface ISharePointCreateResult {
  readonly id: number;
  readonly etag: string;
}

export interface ISharePointFileUploadResult {
  readonly serverRelativeUrl: string;
  readonly itemId: number;
  readonly etag: string;
}

export interface ISharePointBatchMutation {
  readonly kind: "create" | "update";
  readonly listName: PmoContainerName;
  readonly itemId?: number;
  readonly etag?: string;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface ISharePointClient {
  getById<T extends ISharePointItemWire>(
    listName: PmoContainerName,
    id: number,
    select: readonly string[],
    expand?: readonly string[],
  ): Promise<T>;
  query<T extends ISharePointItemWire>(
    listName: PmoContainerName,
    query: ISharePointQuery,
  ): Promise<ISharePointPage<T>>;
  create(
    listName: PmoContainerName,
    values: Readonly<Record<string, unknown>>,
  ): Promise<ISharePointCreateResult>;
  update(
    listName: PmoContainerName,
    id: number,
    values: Readonly<Record<string, unknown>>,
    etag: string,
  ): Promise<void>;
  executeBatch(
    mutations: readonly ISharePointBatchMutation[],
  ): Promise<readonly (ISharePointCreateResult | undefined)[]>;
  uploadFile(
    libraryName: PmoContainerName,
    folderServerRelativeUrl: string,
    fileName: string,
    content: Blob | ArrayBuffer,
    metadata: Readonly<Record<string, unknown>>,
  ): Promise<ISharePointFileUploadResult>;
  getJson<T>(url: string): Promise<T>;
}

export interface ISharePointAdministratorClient {
  delete(listName: PmoContainerName, id: number, etag: string): Promise<void>;
}

export interface IAdministratorAuthorization {
  readonly isPmoOwner: true;
}

const encodeODataString = (value: string): string =>
  value.replace(/'/g, "''");

const classifyStatus = (status: number): SharePointRetryClassification => {
  if (status === 409 || status === 412) return "conflict";
  if (status === 429) return "throttled";
  if (status === 401) return "authentication";
  if (status === 403) return "authorization";
  if (status === 404) return "notFound";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "temporary";
  return "permanent";
};

const readHeader = (
  response: SPHttpClientResponse,
  ...names: readonly string[]
): string | undefined => {
  for (const name of names) {
    const value = response.headers.get(name);
    if (value) return value;
  }
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseErrorBody = (
  body: unknown,
): { readonly message?: string; readonly code?: string } => {
  if (!isRecord(body)) return {};
  const error = isRecord(body.error) ? body.error : body;
  const code = typeof error.code === "string" ? error.code : undefined;
  const messageValue = error.message;
  if (typeof messageValue === "string") return { message: messageValue, code };
  if (isRecord(messageValue) && typeof messageValue.value === "string") {
    return { message: messageValue.value, code };
  }
  return { code };
};

const normalizeCollection = <T>(
  payload: ISharePointCollectionWire<T>,
): ISharePointPage<T> => ({
  items: payload.value ?? payload.d?.results ?? [],
  nextLink:
    payload["@odata.nextLink"] ??
    payload["odata.nextLink"] ??
    payload.d?.__next,
});

const normalizeItem = <T>(payload: T | { readonly d: T }): T =>
  isRecord(payload) && "d" in payload ? (payload.d as T) : (payload as T);

export class SharePointClient implements ISharePointClient {
  public constructor(
    private readonly httpClient: SPHttpClient,
    private readonly environment: IPmoEnvironmentConfiguration,
  ) {}

  public async getJson<T>(url: string): Promise<T> {
    const requestUrl = this.toAbsoluteUrl(url);
    const response = await this.httpClient.get(
      requestUrl,
      SPHttpClient.configurations.v1,
      { headers: { Accept: "application/json;odata=nometadata" } },
    );
    await this.ensureSuccess(response, "GET", requestUrl);
    return (await response.json()) as T;
  }

  public async getById<T extends ISharePointItemWire>(
    listName: PmoContainerName,
    id: number,
    select: readonly string[],
    expand: readonly string[] = [],
  ): Promise<T> {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid item ID.");
    const parameters = new URLSearchParams();
    parameters.set("$select", select.join(","));
    if (expand.length > 0) parameters.set("$expand", expand.join(","));
    const requestUrl = `${this.itemsEndpoint(listName)}(${id})?${parameters.toString()}`;
    const response = await this.httpClient.get(
      requestUrl,
      SPHttpClient.configurations.v1,
      { headers: { Accept: "application/json;odata=nometadata" } },
    );
    await this.ensureSuccess(response, "GET", requestUrl);
    const payload = normalizeItem<T>((await response.json()) as T | { d: T });
    const etag = readHeader(response, "ETag");
    return (etag ? { ...payload, "@odata.etag": etag } : payload) as T;
  }

  public async query<T extends ISharePointItemWire>(
    listName: PmoContainerName,
    query: ISharePointQuery,
  ): Promise<ISharePointPage<T>> {
    const url = query.continuation
      ? this.toAbsoluteUrl(query.continuation)
      : this.buildQueryUrl(listName, query);
    const response = await this.httpClient.get(
      url,
      SPHttpClient.configurations.v1,
      { headers: { Accept: "application/json;odata=nometadata" } },
    );
    await this.ensureSuccess(response, "GET", url);
    return normalizeCollection(
      (await response.json()) as ISharePointCollectionWire<T>,
    );
  }

  public async create(
    listName: PmoContainerName,
    values: Readonly<Record<string, unknown>>,
  ): Promise<ISharePointCreateResult> {
    const requestUrl = this.itemsEndpoint(listName);
    const response = await this.httpClient.post(
      requestUrl,
      SPHttpClient.configurations.v1,
      this.jsonOptions(values),
    );
    await this.ensureSuccess(response, "POST", requestUrl);
    const payload = normalizeItem<ISharePointItemWire>(
      (await response.json()) as
        | ISharePointItemWire
        | { readonly d: ISharePointItemWire },
    );
    return {
      id: payload.ID,
      etag:
        payload["@odata.etag"] ??
        payload["odata.etag"] ??
        readHeader(response, "ETag") ??
        "",
    };
  }

  public async update(
    listName: PmoContainerName,
    id: number,
    values: Readonly<Record<string, unknown>>,
    etag: string,
  ): Promise<void> {
    this.assertGovernedEtag(etag);
    const requestUrl = `${this.itemsEndpoint(listName)}(${id})`;
    const response = await this.httpClient.post(
      requestUrl,
      SPHttpClient.configurations.v1,
      this.jsonOptions(values, { "IF-MATCH": etag, "X-HTTP-Method": "MERGE" }),
    );
    await this.ensureSuccess(response, "POST", requestUrl);
  }

  /**
   * Uses the supported SPHttpClient request surface with bounded concurrency.
   * SPFx 1.24 does not expose beginBatch publicly, so this intentionally avoids
   * relying on its private batching API. Each mutation keeps its own ETag.
   */
  public async executeBatch(
    mutations: readonly ISharePointBatchMutation[],
  ): Promise<readonly (ISharePointCreateResult | undefined)[]> {
    if (mutations.length > 100) {
      throw new Error("A client batch cannot exceed 100 mutations.");
    }
    const results: (ISharePointCreateResult | undefined)[] = [];
    for (let offset = 0; offset < mutations.length; offset += 10) {
      const chunk = mutations.slice(offset, offset + 10);
      const chunkResults = await Promise.all(
        chunk.map(async (mutation) => {
          if (mutation.kind === "create") {
            return this.create(mutation.listName, mutation.values);
          }
          if (!mutation.itemId || !mutation.etag) {
            throw new Error("Batch updates require itemId and ETag.");
          }
          await this.update(
            mutation.listName,
            mutation.itemId,
            mutation.values,
            mutation.etag,
          );
          return undefined;
        }),
      );
      results.push(...chunkResults);
    }
    return results;
  }

  public async uploadFile(
    libraryName: PmoContainerName,
    folderServerRelativeUrl: string,
    fileName: string,
    content: Blob | ArrayBuffer,
    metadata: Readonly<Record<string, unknown>>,
  ): Promise<ISharePointFileUploadResult> {
    const folder = encodeODataString(folderServerRelativeUrl);
    const name = encodeODataString(fileName);
    const uploadUrl = `${this.environment.siteUrl}/_api/web/getfolderbyserverrelativeurl('${folder}')/files/add(url='${name}',overwrite=false)?$expand=ListItemAllFields`;
    const response = await this.httpClient.post(
      uploadUrl,
      SPHttpClient.configurations.v1,
      {
        body: content,
        headers: { Accept: "application/json;odata=nometadata" },
      },
    );
    await this.ensureSuccess(response, "POST", uploadUrl);
    const payload = normalizeItem<{
      readonly ServerRelativeUrl: string;
      readonly ListItemAllFields: ISharePointItemWire;
    }>(await response.json());
    const itemId = payload.ListItemAllFields.ID;
    const etag =
      payload.ListItemAllFields["@odata.etag"] ??
      payload.ListItemAllFields["odata.etag"] ??
      readHeader(response, "ETag") ??
      "";
    if (Object.keys(metadata).length > 0) {
      const currentEtag = etag
        ? etag
        : (
            await this.getById<ISharePointItemWire>(libraryName, itemId, [
              "ID",
            ])
          )["@odata.etag"] ?? "";
      await this.update(libraryName, itemId, metadata, currentEtag);
    }
    return { serverRelativeUrl: payload.ServerRelativeUrl, itemId, etag };
  }

  public forAdministration(
    authorization: IAdministratorAuthorization,
  ): ISharePointAdministratorClient {
    if (!authorization.isPmoOwner) throw new Error("PMO Owner access is required.");
    return {
      delete: async (listName, id, etag) => {
        this.assertGovernedEtag(etag);
        const requestUrl = `${this.itemsEndpoint(listName)}(${id})`;
        const response = await this.httpClient.post(
          requestUrl,
          SPHttpClient.configurations.v1,
          this.jsonOptions(
            {},
            { "IF-MATCH": etag, "X-HTTP-Method": "DELETE" },
          ),
        );
        await this.ensureSuccess(response, "POST", requestUrl);
      },
    };
  }

  private itemsEndpoint(listName: PmoContainerName): string {
    return `${this.environment.siteUrl}/_api/web/lists/getbytitle('${encodeODataString(listName)}')/items`;
  }

  private buildQueryUrl(
    listName: PmoContainerName,
    query: ISharePointQuery,
  ): string {
    if (query.select.length === 0) {
      throw new Error("SharePoint queries require an explicit select list.");
    }
    const top = query.top ?? 50;
    if (!Number.isInteger(top) || top < 1 || top > 200) {
      throw new Error("SharePoint query top must be between 1 and 200.");
    }
    const parameters = new URLSearchParams();
    parameters.set("$select", query.select.join(","));
    parameters.set("$top", String(top));
    if (query.expand?.length) parameters.set("$expand", query.expand.join(","));
    if (query.filter) parameters.set("$filter", query.filter);
    if (query.orderBy?.length) parameters.set("$orderby", query.orderBy.join(","));
    return `${this.itemsEndpoint(listName)}?${parameters.toString()}`;
  }

  private toAbsoluteUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      const candidate = new URL(url);
      if (candidate.origin !== new URL(this.environment.siteUrl).origin) {
        throw new Error("SharePoint continuation links must remain on the site origin.");
      }
      return url;
    }
    if (url.startsWith("/")) {
      return `${new URL(this.environment.siteUrl).origin}${url}`;
    }
    return `${this.environment.siteUrl}/${url.replace(/^\//, "")}`;
  }

  private jsonOptions(
    values: Readonly<Record<string, unknown>>,
    extraHeaders: Readonly<Record<string, string>> = {},
  ): ISPHttpClientOptions {
    return {
      body: JSON.stringify(values),
      headers: {
        Accept: "application/json;odata=nometadata",
        "Content-Type": "application/json;odata=nometadata",
        ...extraHeaders,
      },
    };
  }

  private assertGovernedEtag(etag: string): void {
    if (!etag || etag === "*") {
      throw new Error("A specific current ETag is required for governed updates.");
    }
  }

  private async ensureSuccess(
    response: SPHttpClientResponse,
    requestMethod: "GET" | "POST",
    requestUrl: string,
  ): Promise<void> {
    if (response.ok) return;
    let parsed: { readonly message?: string; readonly code?: string } = {};
    try {
      parsed = parseErrorBody(await response.clone().json());
    } catch {
      try {
        const text = await response.clone().text();
        parsed = text ? { message: text } : {};
      } catch {
        parsed = {};
      }
    }
    throw new SharePointError(
      parsed.message ?? `SharePoint request failed (${response.status}).`,
      response.status,
      readHeader(
        response,
        "SPRequestGuid",
        "request-id",
        "x-ms-correlation-id",
      ),
      classifyStatus(response.status),
      parsed.code,
      requestMethod,
      requestUrl,
    );
  }
}

export const escapeODataString = encodeODataString;
export const classifySharePointStatus = classifyStatus;
