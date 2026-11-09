import { PMO_FIELDS as F } from "../config/sharePointSchema";
import type { IPmoWorkItem } from "../models/domain";
import { ReviewWorkflowService } from "../services/domain/ReviewWorkflowService";

const reviewer = { id: 20, displayName: "Reviewer" };
const makeItem = (overrides: Partial<IPmoWorkItem> = {}): IPmoWorkItem => ({
  id: 1,
  etag: '"1"',
  title: "Deliverable",
  projectId: 1,
  projectCode: "PRJ-2026-00001",
  itemType: "Task",
  assignedEmployeeId: 5,
  assignedTo: { id: 10, displayName: "Employee" },
  reviewer,
  qaRequired: false,
  status: "Submitted for Review",
  priority: "Normal",
  actualEffortHours: 0,
  percentComplete: 75,
  dependencyIds: [],
  isCritical: false,
  planVersion: 1,
  isActive: true,
  ...overrides,
});

const createHarness = (initial: IPmoWorkItem) => {
  let item = initial;
  const service = new ReviewWorkflowService(
    {
      getById: async (): Promise<IPmoWorkItem> => item,
      update: async (_id, values, etag): Promise<IPmoWorkItem> => {
        expect(etag).toBe(item.etag);
        item = {
          ...item,
          etag: `"${Number(item.etag.replace(/\D/g, "")) + 1}"`,
          status:
            (values[F.workItems.Status] as
              | IPmoWorkItem["status"]
              | undefined) ?? item.status,
          acceptedOn:
            typeof values[F.workItems.AcceptedOn] === "string"
              ? new Date(values[F.workItems.AcceptedOn] as string)
              : item.acceptedOn,
          percentComplete:
            (values[F.workItems.PercentComplete] as number | undefined) ??
            item.percentComplete,
        };
        return item;
      },
    },
    {
      resolveCurrent: async () => ({
        sharePointUserId: 20,
        displayName: "Reviewer",
        email: "reviewer@example.com",
        loginName: "reviewer@example.com",
        eligibility: {
          isProjectManager: false,
          isQa: false,
          isApprover: false,
          isResourceManager: false,
        },
        securityRoles: new Set(),
        capabilities: new Set(),
      }),
    } as never,
    () => new Date("2026-11-09T09:00:00Z"),
  );
  return { service, item: (): IPmoWorkItem => item };
};

describe("ReviewWorkflowService", () => {
  it("records the review gate before accepting work and keeps acceptance date", async () => {
    const harness = createHarness(makeItem());
    const result = await harness.service.apply(1, "Accept");
    expect(result.status).toBe("Accepted");
    expect(result.percentComplete).toBe(100);
    expect(result.acceptedOn).toEqual(new Date("2026-11-09T09:00:00Z"));
  });

  it("routes QA-required work through QA state and returns work with a comment", async () => {
    const qa = createHarness(makeItem({ qaRequired: true, qaOwner: reviewer }));
    expect((await qa.service.apply(1, "Route to QA")).status).toBe(
      "Submitted to QA",
    );
    const returned = createHarness(makeItem());
    expect(
      (await returned.service.apply(1, "Return", "Needs evidence")).status,
    ).toBe("In Progress");
    await expect(returned.service.apply(1, "Return")).rejects.toThrow(
      /requires a comment/,
    );
  });
});
