import { PMO_FIELDS as F, PMO_LISTS } from "../config/sharePointSchema";
import type { IPmoApprovalRequest, IPmoProject } from "../models/domain";
import {
  ApprovalWorkflowService,
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
});
