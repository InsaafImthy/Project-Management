import { PMO_FIELDS as F, PMO_LISTS } from "../config/sharePointSchema";
import type {
  IPmoApprovalRequest,
  IPmoChangeRequest,
  IPmoProject,
  IPmoQualityItem,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../models/domain";
import {
  ApprovalWorkflowService,
  type IApprovalSourceRepositories,
  type IApprovalWorkflowActor,
} from "../services/domain/ApprovalWorkflowService";

const requestor = { id: 20, displayName: "Project Manager" };
const approver: IApprovalWorkflowActor = {
  id: 10,
  displayName: "Approver",
  isApproverEligible: true,
  hasApproverRole: true,
  isOwner: false,
};

const makeProject = (): IPmoProject => ({
  id: 7,
  etag: '"project-1"',
  title: "Project",
  projectCode: "PRJ-2026-00007",
  projectType: "Internal",
  description: "Description",
  scopeSummary: "Scope",
  projectManager: requestor,
  pmoOwner: approver,
  status: "Pending Baseline Approval",
  priority: "Normal",
  plannedStart: new Date("2026-11-01T00:00:00Z"),
  baselineEnd: new Date("2026-12-31T00:00:00Z"),
  currentApprovedEnd: new Date("2026-12-31T00:00:00Z"),
  baselineEffortHours: 100,
  approvedEffortHours: 100,
  actualEffortHours: 0,
  currencyCode: "OMR",
  percentComplete: 0,
  overallHealth: "Not Set",
  baselineVersion: 0,
  currentPlanVersion: 0,
  confidentiality: "Internal",
  isActive: true,
});

const createHarness = (): {
  readonly service: ApprovalWorkflowService;
  readonly getProject: () => IPmoProject;
  readonly getProjectUpdates: () => number;
} => {
  let project = makeProject();
  let projectUpdates = 0;
  let approval: IPmoApprovalRequest | undefined;
  let approvalVersion = 1;
  const approvals = {
    getById: async (): Promise<IPmoApprovalRequest> => {
      if (!approval) throw new Error("Missing approval");
      return approval;
    },
    create: async (
      values: Readonly<Record<string, unknown>>,
    ): Promise<IPmoApprovalRequest> => {
      approval = {
        id: 3,
        etag: '"approval-1"',
        created: new Date("2026-11-08T09:00:00Z"),
        title: values[F.approvalRequests.Title] as string,
        approvalNumber: values[F.approvalRequests.ApprovalNumber] as string,
        approvalType: values[
          F.approvalRequests.ApprovalType
        ] as IPmoApprovalRequest["approvalType"],
        sourceList: values[
          F.approvalRequests.SourceList
        ] as IPmoApprovalRequest["sourceList"],
        sourceItemId: values[F.approvalRequests.SourceItemId] as number,
        projectId: values[F.approvalRequests.ProjectId] as number,
        projectCode: values[F.approvalRequests.ProjectCode] as string,
        requestedBy: requestor,
        requestedOn: new Date(values[F.approvalRequests.RequestedOn] as string),
        approver,
        approvalStatus: "Submitted",
        escalationLevel: 0,
        flowProcessingStatus: "New",
      };
      return approval;
    },
    update: async (
      _id: number,
      values: Readonly<Record<string, unknown>>,
      etag: string,
    ): Promise<IPmoApprovalRequest> => {
      if (!approval || approval.etag !== etag)
        throw new Error("Approval conflict");
      approvalVersion += 1;
      approval = {
        ...approval,
        etag: `"approval-${approvalVersion}"`,
        approvalNumber:
          (values[F.approvalRequests.ApprovalNumber] as string | undefined) ??
          approval.approvalNumber,
        approvalStatus:
          (values[F.approvalRequests.ApprovalStatus] as
            | IPmoApprovalRequest["approvalStatus"]
            | undefined) ?? approval.approvalStatus,
        decision:
          (values[F.approvalRequests.Decision] as
            | IPmoApprovalRequest["decision"]
            | undefined) ?? approval.decision,
        decisionComment:
          (values[F.approvalRequests.DecisionComment] as string | undefined) ??
          approval.decisionComment,
        flowProcessingStatus:
          (values[F.approvalRequests.FlowProcessingStatus] as
            | IPmoApprovalRequest["flowProcessingStatus"]
            | undefined) ?? approval.flowProcessingStatus,
      };
      return approval;
    },
  };
  const projects = {
    getById: async (): Promise<IPmoProject> => project,
    update: async (
      _id: number,
      values: Readonly<Record<string, unknown>>,
      etag: string,
    ): Promise<IPmoProject> => {
      if (etag !== project.etag) throw new Error("Project conflict");
      projectUpdates += 1;
      project = {
        ...project,
        etag: `"project-${projectUpdates + 1}"`,
        status:
          (values[F.projects.Status] as IPmoProject["status"] | undefined) ??
          project.status,
        baselineVersion:
          (values[F.projects.BaselineVersion] as number | undefined) ??
          project.baselineVersion,
        baselineApprovedBy:
          values[`${F.projects.BaselineApprovedBy}Id`] === approver.id
            ? approver
            : project.baselineApprovedBy,
      };
      return project;
    },
  };
  const unsupported = {
    getById: async (): Promise<never> => {
      throw new Error("Unexpected source access");
    },
    update: async (): Promise<never> => {
      throw new Error("Unexpected source update");
    },
  };
  return {
    service: new ApprovalWorkflowService(
      approvals,
      {
        projects,
        workItems: unsupported,
        changeRequests: unsupported,
        qualityItems: unsupported,
        timeEntries: unsupported,
      },
      () => new Date("2026-11-08T09:00:00Z"),
    ),
    getProject: (): IPmoProject => project,
    getProjectUpdates: (): number => projectUpdates,
  };
};

describe("ApprovalWorkflowService", () => {
  it("applies a baseline decision once and preserves original baseline values", async () => {
    const harness = createHarness();
    const created = await harness.service.create({
      title: "Project baseline",
      approvalType: "Project Baseline",
      sourceList: PMO_LISTS.projects,
      sourceItemId: 7,
      projectId: 7,
      projectCode: "PRJ-2026-00007",
      requestedBy: requestor,
      approver,
      segregationOfDuties: true,
    });
    expect(created.approvalNumber).toBe("APR-2026-00003");
    const baselineEnd = harness.getProject().baselineEnd;
    const baselineEffort = harness.getProject().baselineEffortHours;
    const decided = await harness.service.decide(
      created.id,
      approver,
      "Approve",
    );
    expect(decided.approvalStatus).toBe("Approved");
    expect(harness.getProject().status).toBe("Approved");
    expect(harness.getProject().baselineVersion).toBe(1);
    expect(harness.getProject().baselineEnd).toEqual(baselineEnd);
    expect(harness.getProject().baselineEffortHours).toBe(baselineEffort);
    const updates = harness.getProjectUpdates();
    await harness.service.decide(created.id, approver, "Approve");
    expect(harness.getProjectUpdates()).toBe(updates);
  });

  it("enforces segregation of duties and approver eligibility", async () => {
    const harness = createHarness();
    await expect(
      harness.service.create({
        title: "Self approval",
        approvalType: "Project Baseline",
        sourceList: PMO_LISTS.projects,
        sourceItemId: 7,
        projectId: 7,
        projectCode: "PRJ-2026-00007",
        requestedBy: approver,
        approver,
        segregationOfDuties: true,
      }),
    ).rejects.toThrow(/different people/);
  });

  it.each([
    ["Project Baseline", PMO_LISTS.projects, F.projects.BaselineVersion],
    ["Execution Plan", PMO_LISTS.projects, F.projects.CurrentPlanVersion],
    ["Task Change", PMO_LISTS.changeRequests, F.workItems.PlanVersion],
    [
      "Project Variation",
      PMO_LISTS.changeRequests,
      F.projects.CurrentPlanVersion,
    ],
    ["QA Exception", PMO_LISTS.qualityItems, F.qualityItems.Status],
    ["Project Closure", PMO_LISTS.projects, F.projects.Status],
    ["Time Correction", PMO_LISTS.timeEntries, F.timeEntries.EntryStatus],
  ] as const)(
    "applies %s through the shared approval workflow",
    async (approvalType, sourceList, expectedField) => {
      let approval: IPmoApprovalRequest = {
        id: 19,
        etag: '"approval-1"',
        title: approvalType,
        approvalNumber: "APR-2026-00019",
        approvalType,
        sourceList,
        sourceItemId: 7,
        projectId: 7,
        projectCode: "PRJ-2026-00007",
        requestedBy: requestor,
        requestedOn: new Date("2026-11-08T09:00:00Z"),
        approver,
        approvalStatus: "Submitted",
        escalationLevel: 0,
        flowProcessingStatus: "New",
      };
      const sourceWrites: Record<string, unknown>[] = [];
      const project = {
        ...makeProject(),
        status:
          approvalType === "Execution Plan"
            ? "Approved"
            : approvalType === "Project Closure"
              ? "Active"
              : "Pending Baseline Approval",
      } as IPmoProject;
      const change = {
        id: 7,
        etag: '"change-1"',
        title: "Change",
        requestNumber: "CR-2026-00007",
        requestType:
          approvalType === "Project Variation"
            ? "Project Variation"
            : "Additional Effort",
        projectId: 7,
        projectCode: "PRJ-2026-00007",
        workItemId: approvalType === "Task Change" ? 11 : undefined,
        requestedBy: requestor,
        requestedOn: new Date(),
        reasonCategory: "Estimation Error",
        reasonDetails: "Reason",
        currentEffortHours: 10,
        additionalHoursRequested: 2,
        proposedEffortHours: 12,
        impactSummary: "Impact",
        requestStatus: "Submitted",
      } as unknown as IPmoChangeRequest;
      const workItem = {
        id: 11,
        etag: '"work-1"',
        approvedEffortHours: 10,
        plannedEnd: new Date("2026-12-31T00:00:00Z"),
        planVersion: 1,
        lastActionId: undefined,
      } as unknown as IPmoWorkItem;
      const quality = {
        id: 7,
        etag: '"quality-1"',
        status: "In Review",
      } as unknown as IPmoQualityItem;
      const time = {
        id: 7,
        etag: '"time-1"',
        isLocked: true,
        entryStatus: "Submitted",
      } as unknown as IPmoTimeEntry;
      const sources = {
        projects: {
          getById: async (): Promise<IPmoProject> => project,
          update: async (
            _id: number,
            values: Readonly<Record<string, unknown>>,
          ): Promise<IPmoProject> => {
            sourceWrites.push(values);
            return project;
          },
        },
        workItems: {
          getById: async (): Promise<IPmoWorkItem> => workItem,
          update: async (
            _id: number,
            values: Readonly<Record<string, unknown>>,
          ): Promise<IPmoWorkItem> => {
            sourceWrites.push(values);
            return workItem;
          },
        },
        changeRequests: {
          getById: async (): Promise<IPmoChangeRequest> => change,
          update: async (
            _id: number,
            values: Readonly<Record<string, unknown>>,
          ): Promise<IPmoChangeRequest> => {
            sourceWrites.push(values);
            return change;
          },
        },
        qualityItems: {
          getById: async (): Promise<IPmoQualityItem> => quality,
          update: async (
            _id: number,
            values: Readonly<Record<string, unknown>>,
          ): Promise<IPmoQualityItem> => {
            sourceWrites.push(values);
            return quality;
          },
        },
        timeEntries: {
          getById: async (): Promise<IPmoTimeEntry> => time,
          update: async (
            _id: number,
            values: Readonly<Record<string, unknown>>,
          ): Promise<IPmoTimeEntry> => {
            sourceWrites.push(values);
            return time;
          },
        },
      } as IApprovalSourceRepositories;
      const workflow = new ApprovalWorkflowService(
        {
          getById: async (): Promise<IPmoApprovalRequest> => approval,
          create: async (): Promise<IPmoApprovalRequest> => approval,
          update: async (
            _id: number,
            values: Readonly<Record<string, unknown>>,
          ): Promise<IPmoApprovalRequest> => {
            approval = {
              ...approval,
              etag: `"approval-${Math.random()}"`,
              approvalStatus:
                (values[F.approvalRequests.ApprovalStatus] as
                  | IPmoApprovalRequest["approvalStatus"]
                  | undefined) ?? approval.approvalStatus,
              flowProcessingStatus:
                (values[F.approvalRequests.FlowProcessingStatus] as
                  | IPmoApprovalRequest["flowProcessingStatus"]
                  | undefined) ?? approval.flowProcessingStatus,
              decision:
                (values[F.approvalRequests.Decision] as
                  | IPmoApprovalRequest["decision"]
                  | undefined) ?? approval.decision,
            };
            return approval;
          },
        },
        sources,
      );
      const completed = await workflow.decide(19, approver, "Approve");
      expect(completed.flowProcessingStatus).toBe("Completed");
      expect(sourceWrites.some((values) => expectedField in values)).toBe(true);
      if (approvalType === "QA Exception") {
        expect(
          sourceWrites.some((values) => F.qualityItems.TestResult in values),
        ).toBe(false);
      }
    },
  );

  it("requires comments for non-approval decisions and keeps clarification open", async () => {
    const harness = createHarness();
    const created = await harness.service.create({
      title: "Clarification",
      approvalType: "Project Baseline",
      sourceList: PMO_LISTS.projects,
      sourceItemId: 7,
      projectId: 7,
      projectCode: "PRJ-2026-00007",
      requestedBy: requestor,
      approver,
      segregationOfDuties: true,
    });
    await expect(
      harness.service.decide(created.id, approver, "Reject"),
    ).rejects.toThrow(/requires a decision comment/);
    const clarified = await harness.service.decide(
      created.id,
      approver,
      "Request Clarification",
      "Please provide the recovery plan.",
    );
    expect(clarified.approvalStatus).toBe("Clarification Requested");
    expect(clarified.flowProcessingStatus).toBe("Waiting");
  });

  it("leaves a failed decision retryable and never retries a completed decision", async () => {
    let approval: IPmoApprovalRequest = {
      id: 41,
      etag: '"approval-1"',
      title: "Retry baseline",
      approvalNumber: "APR-2026-00041",
      approvalType: "Project Baseline",
      sourceList: PMO_LISTS.projects,
      sourceItemId: 7,
      projectId: 7,
      projectCode: "PRJ-2026-00007",
      requestedBy: requestor,
      requestedOn: new Date("2026-11-08T09:00:00Z"),
      approver,
      approvalStatus: "Submitted",
      escalationLevel: 0,
      flowProcessingStatus: "New",
    };
    let sourceAttempts = 0;
    const project = makeProject();
    const workflow = new ApprovalWorkflowService(
      {
        getById: async (): Promise<IPmoApprovalRequest> => approval,
        create: async (): Promise<IPmoApprovalRequest> => approval,
        update: async (
          _id: number,
          values: Readonly<Record<string, unknown>>,
        ): Promise<IPmoApprovalRequest> => {
          approval = {
            ...approval,
            etag: `"approval-${sourceAttempts}-${approval.flowProcessingStatus}"`,
            approvalStatus:
              (values[F.approvalRequests.ApprovalStatus] as
                | IPmoApprovalRequest["approvalStatus"]
                | undefined) ?? approval.approvalStatus,
            flowProcessingStatus:
              (values[F.approvalRequests.FlowProcessingStatus] as
                | IPmoApprovalRequest["flowProcessingStatus"]
                | undefined) ?? approval.flowProcessingStatus,
            decision:
              (values[F.approvalRequests.Decision] as
                | IPmoApprovalRequest["decision"]
                | undefined) ?? approval.decision,
          };
          return approval;
        },
      },
      {
        projects: {
          getById: async (): Promise<IPmoProject> => project,
          update: async (): Promise<IPmoProject> => {
            sourceAttempts += 1;
            if (sourceAttempts === 1) throw new Error("ETag conflict");
            return { ...project, status: "Approved" };
          },
        },
      } as unknown as IApprovalSourceRepositories,
    );
    await expect(workflow.decide(41, approver, "Approve")).rejects.toThrow(
      "ETag conflict",
    );
    expect(approval.flowProcessingStatus).toBe("Failed");
    expect(approval.decision).toBe("Approve");
    await workflow.retry(41, approver);
    expect(approval.flowProcessingStatus).toBe("Completed");
    expect(sourceAttempts).toBe(2);
    await expect(workflow.retry(41, approver)).rejects.toThrow(/Only a failed/);
    expect(sourceAttempts).toBe(2);
  });
});
