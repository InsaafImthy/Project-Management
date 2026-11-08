import type {
  IPmoApprovalRequest,
  IPmoEmployee,
  IPmoProject,
  IPmoQualityItem,
  IPmoTaskAction,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../models/domain";
import { ActionCenterService } from "../services/domain/ActionCenterService";
import type {
  IPmoResolvedUserContext,
  PmoCapability,
  PmoSecurityRole,
} from "../services/domain/UserCapabilityService";

const userPerson = { id: 10, displayName: "Employee" };
const employee: IPmoEmployee = {
  id: 5,
  etag: '"e"',
  name: "Employee",
  employeeNumber: "E5",
  user: userPerson,
  email: "employee@example.com",
  department: "Delivery",
  employmentStatus: "Active",
  standardHoursPerDay: 8,
  capacityPercent: 100,
  isProjectManager: true,
  isQa: true,
  isApprover: true,
  isResourceManager: false,
  isActive: true,
};
const context: IPmoResolvedUserContext = {
  sharePointUserId: 10,
  displayName: "Employee",
  email: "employee@example.com",
  loginName: "employee@example.com",
  employee,
  eligibility: {
    isProjectManager: true,
    isQa: true,
    isApprover: true,
    isResourceManager: false,
  },
  securityRoles: new Set<PmoSecurityRole>(["employee", "projectManager"]),
  capabilities: new Set<PmoCapability>(["work.view-own", "projects.manage"]),
};

const work = (
  id: number,
  status: IPmoWorkItem["status"],
  plannedEnd: string,
): IPmoWorkItem =>
  ({
    id,
    etag: `"w${id}"`,
    title: `Work ${id}`,
    projectId: 1,
    projectCode: "PRJ-2026-00001",
    itemType: "Task",
    assignedEmployeeId: 5,
    assignedTo: userPerson,
    qaRequired: false,
    status,
    priority: "Normal",
    plannedEnd: new Date(plannedEnd),
    actualEffortHours: 0,
    percentComplete: 0,
    dependencyIds: [],
    isCritical: false,
    planVersion: 1,
    isActive: true,
  }) as IPmoWorkItem;

describe("ActionCenterService", () => {
  it("returns filtered records and consistent action counts", async () => {
    const returnedAction = {
      id: 1,
      processingStatus: "Rejected",
    } as IPmoTaskAction;
    const failedAction = {
      id: 2,
      processingStatus: "Failed",
    } as IPmoTaskAction;
    const returnedTime = {
      id: 1,
      entryStatus: "Returned",
      hours: 1,
    } as IPmoTimeEntry;
    const recordedTime = {
      id: 2,
      entryStatus: "Draft",
      hours: 4,
    } as IPmoTimeEntry;
    const service = new ActionCenterService(
      {
        getAssignedTo: async () => ({
          items: [
            work(1, "Assigned", "2026-11-09T00:00:00Z"),
            work(2, "Blocked", "2026-11-07T00:00:00Z"),
          ],
        }),
        getReviewQueueForUser: async () => ({
          items: [work(3, "Submitted for Review", "2026-11-10T00:00:00Z")],
        }),
        getQaQueueForUser: async () => ({
          items: [work(4, "Submitted to QA", "2026-11-10T00:00:00Z")],
        }),
      },
      {
        getAssignedTo: async () => ({ items: [{ id: 5 } as IPmoQualityItem] }),
      },
      {
        getPendingForApprover: async () => ({
          items: [{ id: 6 } as IPmoApprovalRequest],
        }),
      },
      {
        getEmployeeRange: async () => ({
          items: [returnedTime, recordedTime],
        }),
      },
      {
        getForRequestor: async () => ({
          items: [returnedAction, failedAction],
        }),
        getFailed: async () => ({ items: [] }),
      },
      {
        getStale: async () => ({ items: [{ id: 7 } as IPmoProject] }),
      },
      () => new Date("2026-11-08T12:00:00Z"),
    );
    const result = await service.getActions(context);
    expect(result.counts).toEqual({
      awaitingAcceptance: 1,
      dueSoon: 1,
      overdue: 1,
      blocked: 1,
      reviewsAndQa: 3,
      pendingApprovals: 1,
      returned: 2,
      incompleteWorkday: 1,
      failedTaskActions: 1,
      staleMetrics: 1,
    });
    expect(result.incompleteWorkday?.missingHours).toBe(4);
  });
});
