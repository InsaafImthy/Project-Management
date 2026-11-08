import { PMO_FIELDS as F } from "../config/sharePointSchema";
import type {
  IPmoRiskIssue,
  IPmoTaskAction,
  IPmoWorkItem,
} from "../models/domain";
import {
  TaskWorkflowService,
  type ITaskWorkflowActor,
} from "../services/domain/TaskWorkflowService";

const assignee = { id: 10, displayName: "Assignee" };
const actor: ITaskWorkflowActor = {
  employeeId: 5,
  sharePointUserId: 10,
  displayName: "Assignee",
  isProjectManager: false,
  isQa: false,
  isOwner: false,
};

const makeWorkItem = (overrides: Partial<IPmoWorkItem> = {}): IPmoWorkItem => ({
  id: 1,
  etag: '"work-1"',
  created: new Date("2026-11-08T08:00:00Z"),
  title: "Implement foundation",
  workItemCode: "WIT-2026-00001",
  projectId: 2,
  projectCode: "PRJ-2026-00002",
  itemType: "Task",
  assignedEmployeeId: 5,
  assignedTo: assignee,
  qaRequired: false,
  status: "Assigned",
  priority: "Normal",
  approvedEffortHours: 8,
  actualEffortHours: 0,
  percentComplete: 0,
  dependencyIds: [],
  isCritical: false,
  planVersion: 1,
  isActive: true,
  ...overrides,
});

const createHarness = (
  initialWork: IPmoWorkItem,
): {
  readonly service: TaskWorkflowService;
  readonly getWork: () => IPmoWorkItem;
  readonly getWorkUpdates: () => number;
  readonly risks: Map<number, IPmoRiskIssue>;
} => {
  let work = initialWork;
  let workUpdates = 0;
  let nextActionId = 1;
  const actions = new Map<number, IPmoTaskAction>();
  const risks = new Map<number, IPmoRiskIssue>();
  const workItems = {
    getById: async (): Promise<IPmoWorkItem> => work,
    update: async (
      id: number,
      values: Readonly<Record<string, unknown>>,
      etag: string,
    ): Promise<IPmoWorkItem> => {
      expect(id).toBe(work.id);
      expect(etag).toBe(work.etag);
      workUpdates += 1;
      work = {
        ...work,
        etag: `"work-${workUpdates + 1}"`,
        status:
          (values[F.workItems.Status] as IPmoWorkItem["status"] | undefined) ??
          work.status,
        lastActionId:
          (values[F.workItems.LastActionId] as number | undefined) ??
          work.lastActionId,
        actualStart:
          typeof values[F.workItems.ActualStart] === "string"
            ? new Date(values[F.workItems.ActualStart] as string)
            : work.actualStart,
      };
      return work;
    },
  };
  const taskActions = {
    getById: async (id: number): Promise<IPmoTaskAction> => {
      const item = actions.get(id);
      if (!item) throw new Error("Missing action");
      return item;
    },
    create: async (
      values: Readonly<Record<string, unknown>>,
    ): Promise<IPmoTaskAction> => {
      const id = nextActionId++;
      const item: IPmoTaskAction = {
        id,
        etag: `"action-${id}-1"`,
        created: new Date("2026-11-08T09:00:00Z"),
        title: values[F.taskActions.Title] as string,
        projectId: values[F.taskActions.ProjectId] as number,
        projectCode: values[F.taskActions.ProjectCode] as string,
        workItemId: values[F.taskActions.WorkItemId] as number,
        workItemCode: values[F.taskActions.WorkItemCode] as string,
        actionType: values[
          F.taskActions.ActionType
        ] as IPmoTaskAction["actionType"],
        requestedBy: assignee,
        requestedOn: new Date(values[F.taskActions.RequestedOn] as string),
        progressPercent: values[F.taskActions.ProgressPercent] as
          | number
          | undefined,
        remainingEffortHours: values[F.taskActions.RemainingEffortHours] as
          | number
          | undefined,
        comment: values[F.taskActions.Comment] as string | undefined,
        proposedStatus: values[F.taskActions.ProposedStatus] as
          | string
          | undefined,
        processingStatus: "New",
      };
      actions.set(id, item);
      return item;
    },
    update: async (
      id: number,
      values: Readonly<Record<string, unknown>>,
      etag: string,
    ): Promise<IPmoTaskAction> => {
      const current = actions.get(id);
      if (!current || current.etag !== etag) throw new Error("Action conflict");
      const next: IPmoTaskAction = {
        ...current,
        etag: `"action-${id}-${Number(current.etag.split("-")[2]?.replace('"', "") ?? 1) + 1}"`,
        processingStatus:
          (values[F.taskActions.ProcessingStatus] as
            | IPmoTaskAction["processingStatus"]
            | undefined) ?? current.processingStatus,
        resultMessage:
          (values[F.taskActions.ResultMessage] as string | undefined) ??
          current.resultMessage,
        processedOn:
          typeof values[F.taskActions.ProcessedOn] === "string"
            ? new Date(values[F.taskActions.ProcessedOn] as string)
            : current.processedOn,
      };
      actions.set(id, next);
      return next;
    },
  };
  const risksIssues = {
    getOpenByProject: async (): Promise<{
      items: readonly IPmoRiskIssue[];
      continuation?: string;
    }> => ({ items: Array.from(risks.values()) }),
    create: async (
      values: Readonly<Record<string, unknown>>,
    ): Promise<IPmoRiskIssue> => {
      const id = risks.size + 1;
      const risk: IPmoRiskIssue = {
        id,
        etag: `"risk-${id}-1"`,
        created: new Date("2026-11-08T09:00:00Z"),
        title: values[F.risksIssues.Title] as string,
        recordNumber: values[F.risksIssues.RecordNumber] as string,
        recordType: "Blocker",
        projectId: values[F.risksIssues.ProjectId] as number,
        projectCode: values[F.risksIssues.ProjectCode] as string,
        workItemId: values[F.risksIssues.WorkItemId] as number,
        severity: values[F.risksIssues.Severity] as IPmoRiskIssue["severity"],
        description: values[F.risksIssues.Description] as string,
        impact: values[F.risksIssues.Impact] as string,
        owner: assignee,
        raisedBy: assignee,
        raisedOn: new Date(values[F.risksIssues.RaisedOn] as string),
        status: "Open",
        isEscalated: values[F.risksIssues.IsEscalated] as boolean,
      };
      risks.set(id, risk);
      return risk;
    },
    update: async (
      id: number,
      values: Readonly<Record<string, unknown>>,
      etag: string,
    ): Promise<IPmoRiskIssue> => {
      const current = risks.get(id);
      if (!current || current.etag !== etag) throw new Error("Risk conflict");
      const next: IPmoRiskIssue = {
        ...current,
        etag: `"risk-${id}-2"`,
        recordNumber:
          (values[F.risksIssues.RecordNumber] as string | undefined) ??
          current.recordNumber,
        status:
          (values[F.risksIssues.Status] as
            | IPmoRiskIssue["status"]
            | undefined) ?? current.status,
      };
      risks.set(id, next);
      return next;
    },
  };
  return {
    service: new TaskWorkflowService(
      workItems,
      taskActions,
      risksIssues,
      () => new Date("2026-11-08T09:00:00Z"),
    ),
    getWork: (): IPmoWorkItem => work,
    getWorkUpdates: (): number => workUpdates,
    risks,
  };
};

describe("TaskWorkflowService", () => {
  it("applies an action once and returns the existing applied result on retry", async () => {
    const harness = createHarness(makeWorkItem());
    const applied = await harness.service.requestAndApply(1, actor, {
      actionType: "Accept",
    });
    expect(applied.processingStatus).toBe("Applied");
    expect(harness.getWork().status).toBe("Accepted");
    expect(harness.getWork().lastActionId).toBe(applied.id);
    const updates = harness.getWorkUpdates();
    const retried = await harness.service.apply(applied.id, actor);
    expect(retried.processingStatus).toBe("Applied");
    expect(harness.getWorkUpdates()).toBe(updates);
  });

  it("creates one related blocker and rejects unauthorized actions", async () => {
    const blockedHarness = createHarness(
      makeWorkItem({ status: "In Progress", isCritical: true }),
    );
    const blocked = await blockedHarness.service.requestAndApply(1, actor, {
      actionType: "Block",
      comment: "External dependency unavailable",
    });
    expect(blocked.processingStatus).toBe("Applied");
    expect(blockedHarness.getWork().status).toBe("Blocked");
    expect(blockedHarness.risks.size).toBe(1);

    const unauthorizedHarness = createHarness(makeWorkItem());
    const rejected = await unauthorizedHarness.service.requestAndApply(
      1,
      { ...actor, employeeId: 99, sharePointUserId: 99 },
      { actionType: "Accept" },
    );
    expect(rejected.processingStatus).toBe("Rejected");
    expect(unauthorizedHarness.getWork().status).toBe("Assigned");
  });
});
