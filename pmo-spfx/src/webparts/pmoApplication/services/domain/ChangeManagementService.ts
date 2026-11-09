import { PMO_FIELDS as F, PMO_LISTS } from "../../config/sharePointSchema";
import type {
  IPmoApprovalRequest,
  IPmoChangeRequest,
  IPmoPerson,
  IPmoProject,
  IPmoWorkItem,
} from "../../models/domain";
import type { IRepositoryPage } from "../repositories/contracts";
import type {
  ApprovalRequestsRepository,
  ChangeRequestsRepository,
  EmployeesRepository,
  ProjectsRepository,
  WorkItemsRepository,
  QualityItemsRepository,
  TimeEntriesRepository,
} from "../repositories/repositories";
import {
  ApprovalWorkflowService,
  type IApprovalWorkflowActor,
} from "./ApprovalWorkflowService";
import {
  generateRecordCode,
  validateChangeRequest,
  type ApprovalDecision,
} from "./DomainRules";
import type { MetricsService } from "./MetricsService";
import {
  assertCapability,
  type IPmoResolvedUserContext,
  type UserCapabilityService,
} from "./UserCapabilityService";

export interface IChangeRequestDraft {
  readonly requestType: IPmoChangeRequest["requestType"];
  readonly projectId?: number;
  readonly workItemId?: number;
  readonly reasonCategory: IPmoChangeRequest["reasonCategory"];
  readonly reasonDetails: string;
  readonly additionalHoursRequested?: number;
  readonly proposedEffortHours?: number;
  readonly proposedDate?: string;
  readonly impactSummary: string;
  readonly mitigationPlan?: string;
}

export interface IApprovalRoutingPreview {
  readonly approver?: string;
  readonly route: "Project Manager" | "PMO";
  readonly material: boolean;
  readonly reason: string;
  readonly blockedReason?: string;
}

export interface IChangeDashboard {
  readonly myDrafts: number;
  readonly mySubmitted: number;
  readonly pendingMyApproval: number;
  readonly clarificationRequested: number;
  readonly overdueApprovals: number;
  readonly approvedOrRejectedThisPeriod: number;
  readonly projectVariationsAwaitingPmo: number;
  readonly asOf: Date;
}

const activeApproval = (approval: IPmoApprovalRequest): boolean =>
  approval.approvalStatus === "Submitted" ||
  approval.approvalStatus === "In Progress";

const toActor = (actor: IPmoResolvedUserContext): IApprovalWorkflowActor => ({
  id: actor.sharePointUserId,
  displayName: actor.displayName,
  email: actor.email,
  loginName: actor.loginName,
  isApproverEligible: actor.eligibility.isApprover,
  hasApproverRole: actor.securityRoles.has("approver"),
  isOwner: actor.securityRoles.has("owner"),
});

const requester = (actor: IPmoResolvedUserContext): IPmoPerson => ({
  id: actor.sharePointUserId,
  displayName: actor.displayName,
  email: actor.email,
  loginName: actor.loginName,
});

/**
 * Change-request façade. It owns request lifecycle and routing, while every
 * decision and source mutation remains in ApprovalWorkflowService.
 */
export class ChangeManagementService {
  public constructor(
    private readonly changes: ChangeRequestsRepository,
    private readonly approvals: ApprovalRequestsRepository,
    private readonly projects: ProjectsRepository,
    private readonly workItems: WorkItemsRepository,
    private readonly employees: EmployeesRepository,
    private readonly quality: QualityItemsRepository,
    private readonly time: TimeEntriesRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly metrics?: Pick<MetricsService, "refreshProject">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public listMine(
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoChangeRequest>> {
    return this.withActor((actor) =>
      this.changes.getForRequester(actor.sharePointUserId, continuation),
    );
  }

  public listApprovals(
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoApprovalRequest>> {
    return this.withActor((actor) => {
      assertCapability(actor, "approvals.view");
      return this.approvals.getPendingForApprover(
        actor.sharePointUserId,
        continuation,
      );
    });
  }

  public getRequest(id: number): Promise<IPmoChangeRequest> {
    return this.changes.getById(id);
  }

  public getApproval(id: number): Promise<IPmoApprovalRequest> {
    return this.approvals.getById(id);
  }

  public getProjects(): Promise<IRepositoryPage<IPmoProject>> {
    return this.projects.getActive(undefined, 100);
  }

  public getWorkItems(
    projectId: number,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    return this.workItems.getByProject(projectId);
  }

  public async dashboard(): Promise<IChangeDashboard> {
    const actor = await this.capabilities.resolveCurrent();
    const now = this.now();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [
      mine,
      pending,
      clarifications,
      overdue,
      variations,
      approved,
      rejected,
    ] = await Promise.all([
      this.changes.getForRequester(actor.sharePointUserId),
      actor.capabilities.has("approvals.view")
        ? this.approvals.getPendingForApprover(actor.sharePointUserId)
        : Promise.resolve({ items: [] as IPmoApprovalRequest[] }),
      this.changes.getByStatus("Clarification Requested"),
      actor.capabilities.has("approvals.view")
        ? this.approvals.getOverdue(now)
        : Promise.resolve({ items: [] as IPmoApprovalRequest[] }),
      this.changes.getByStatus("Submitted"),
      this.changes.getByStatus("Approved"),
      this.changes.getByStatus("Rejected"),
    ]);
    return {
      myDrafts: mine.items.filter((item) => item.requestStatus === "Draft")
        .length,
      mySubmitted: mine.items.filter(
        (item) => item.requestStatus === "Submitted",
      ).length,
      pendingMyApproval: pending.items.filter(activeApproval).length,
      clarificationRequested: clarifications.items.filter(
        (item) => item.requestedBy.id === actor.sharePointUserId,
      ).length,
      overdueApprovals: overdue.items.filter(
        (item) => item.approver.id === actor.sharePointUserId,
      ).length,
      approvedOrRejectedThisPeriod: approved.items
        .concat(rejected.items)
        .filter(
          (item) =>
            (item.decidedOn ?? item.modified ?? new Date(0)) >= periodStart,
        ).length,
      projectVariationsAwaitingPmo: variations.items.filter(
        (item) => item.requestType === "Project Variation",
      ).length,
      asOf: now,
    };
  }

  public async routingPreview(
    draft: Pick<
      IChangeRequestDraft,
      | "requestType"
      | "projectId"
      | "workItemId"
      | "additionalHoursRequested"
      | "proposedDate"
    >,
  ): Promise<IApprovalRoutingPreview> {
    if (!draft.projectId) {
      return {
        route: "Project Manager",
        material: false,
        reason: "Select a source project to preview approval routing.",
        blockedReason: "A source project is required.",
      };
    }
    const [project, workItem] = await Promise.all([
      this.projects.getById(draft.projectId),
      draft.workItemId
        ? this.workItems.getById(draft.workItemId)
        : Promise.resolve(undefined),
    ]);
    const material =
      draft.requestType === "Project Variation" ||
      draft.requestType === "Scope Change" ||
      (draft.additionalHoursRequested ?? 0) > 8 ||
      (draft.proposedDate !== undefined &&
        new Date(`${draft.proposedDate}T00:00:00`).valueOf() >
          project.currentApprovedEnd.valueOf()) ||
      (workItem?.isCritical ?? false);
    const target = material ? project.pmoOwner : project.projectManager;
    const [eligibility, hasApproverRole] = await Promise.all([
      this.employees.getActiveBySharePointUserId(target.id),
      this.capabilities.isUserInSecurityRole(target.id, "approver"),
    ]);
    return {
      approver: target.displayName,
      route: material ? "PMO" : "Project Manager",
      material,
      reason: material
        ? "This request affects material effort, scope, schedule, a critical item, or project-level commitment."
        : "This task change remains within the configured project-manager authority.",
      blockedReason:
        !eligibility || !eligibility.isApprover || !hasApproverRole
          ? `Configured ${material ? "PMO" : "project-manager"} approver ${target.displayName} is not an active eligible approver. An administrator must correct the project authority before submission.`
          : undefined,
    };
  }

  public async saveDraft(
    draft: IChangeRequestDraft,
    existing?: IPmoChangeRequest,
  ): Promise<IPmoChangeRequest> {
    const actor = await this.capabilities.resolveCurrent();
    this.assertRequester(actor, existing);
    const source = await this.resolveSource(draft, actor);
    const values = this.requestValues(draft, source, actor, "Draft");
    if (existing) {
      if (
        existing.requestStatus !== "Draft" &&
        existing.requestStatus !== "Clarification Requested"
      ) {
        throw new Error("Only a draft or clarification request can be edited.");
      }
      return this.changes.update(existing.id, values, existing.etag);
    }
    const created = await this.changes.create({
      ...values,
      [F.changeRequests.RequestNumber]: `PENDING-${this.now().valueOf()}`,
    });
    return this.changes.update(
      created.id,
      {
        [F.changeRequests.RequestNumber]: generateRecordCode(
          "Request",
          created.id,
          created.created ?? this.now(),
        ),
      },
      created.etag,
    );
  }

  public async submit(request: IPmoChangeRequest): Promise<IPmoChangeRequest> {
    const actor = await this.capabilities.resolveCurrent();
    this.assertRequester(actor, request);
    if (request.requestStatus !== "Draft") {
      throw new Error("Only a draft request can be submitted.");
    }
    this.assertValidForSubmission(request);
    const preview = await this.routingPreview({
      requestType: request.requestType,
      projectId: request.projectId,
      workItemId: request.workItemId,
      additionalHoursRequested: request.additionalHoursRequested,
      proposedDate: request.proposedDate?.toISOString().slice(0, 10),
    });
    if (preview.blockedReason) throw new Error(preview.blockedReason);
    const project = await this.projects.getById(request.projectId);
    const approver = preview.material
      ? project.pmoOwner
      : project.projectManager;
    const updated = await this.changes.update(
      request.id,
      {
        [F.changeRequests.RequestStatus]: "Submitted",
        [`${F.changeRequests.CurrentApprover}Id`]: approver.id,
      },
      request.etag,
    );
    const approval = await this.workflow().create({
      title: `${updated.requestType}: ${updated.title}`,
      approvalType:
        updated.requestType === "Project Variation"
          ? "Project Variation"
          : "Task Change",
      sourceList: PMO_LISTS.changeRequests,
      sourceItemId: updated.id,
      projectId: updated.projectId,
      projectCode: updated.projectCode,
      requestedBy: requester(actor),
      approver: {
        ...approver,
        isApproverEligible: true,
        // The current decision action validates actual SharePoint-group membership.
        hasApproverRole: true,
        isOwner: false,
      },
      dueOn: this.defaultDueOn(),
      segregationOfDuties: true,
    });
    return this.changes.update(
      updated.id,
      { [F.changeRequests.ApprovalRequestId]: approval.id },
      updated.etag,
    );
  }

  public async resubmit(
    request: IPmoChangeRequest,
  ): Promise<IPmoChangeRequest> {
    const actor = await this.capabilities.resolveCurrent();
    this.assertRequester(actor, request);
    if (
      request.requestStatus !== "Clarification Requested" ||
      !request.approvalRequestId
    ) {
      throw new Error(
        "Only a clarification request with an approval record can be resubmitted.",
      );
    }
    this.assertValidForSubmission(request);
    const approval = await this.approvals.getById(request.approvalRequestId);
    if (approval.approvalStatus !== "Clarification Requested") {
      throw new Error(
        "The linked approval is no longer awaiting clarification.",
      );
    }
    await this.approvals.update(
      approval.id,
      {
        [F.approvalRequests.ApprovalStatus]: "In Progress",
        [F.approvalRequests.FlowProcessingStatus]: "New",
      },
      approval.etag,
    );
    return this.changes.update(
      request.id,
      { [F.changeRequests.RequestStatus]: "Submitted" },
      request.etag,
    );
  }

  public async withdraw(
    request: IPmoChangeRequest,
    reason: string,
  ): Promise<IPmoChangeRequest> {
    const actor = await this.capabilities.resolveCurrent();
    this.assertRequester(actor, request);
    if (
      ["Draft", "Submitted", "Clarification Requested"].indexOf(
        request.requestStatus,
      ) < 0
    ) {
      throw new Error("Only an open request can be withdrawn.");
    }
    if (!reason.trim()) throw new Error("Withdrawal requires a reason.");
    if (request.approvalRequestId) {
      const approval = await this.approvals.getById(request.approvalRequestId);
      if (
        activeApproval(approval) ||
        approval.approvalStatus === "Clarification Requested"
      ) {
        await this.approvals.update(
          approval.id,
          {
            [F.approvalRequests.ApprovalStatus]: "Cancelled",
            [F.approvalRequests.DecisionComment]: reason.trim(),
            [F.approvalRequests.FlowProcessingStatus]: "Completed",
          },
          approval.etag,
        );
      }
    }
    return this.changes.update(
      request.id,
      {
        [F.changeRequests.RequestStatus]: "Withdrawn",
        [F.changeRequests.DecisionComment]: reason.trim(),
      },
      request.etag,
    );
  }

  public async decide(
    approvalId: number,
    decision: ApprovalDecision,
    comment?: string,
  ): Promise<IPmoApprovalRequest> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "approvals.decide");
    return this.workflow().decide(
      approvalId,
      toActor(actor),
      decision,
      comment,
    );
  }

  public async retry(approvalId: number): Promise<IPmoApprovalRequest> {
    const actor = await this.capabilities.resolveCurrent();
    if (
      !actor.capabilities.has("support.failed-actions") &&
      !actor.securityRoles.has("owner")
    ) {
      throw new Error(
        "Only authorized support can retry a failed approval action.",
      );
    }
    return this.workflow().retry(approvalId, toActor(actor));
  }

  private workflow(): ApprovalWorkflowService {
    return new ApprovalWorkflowService(
      this.approvals,
      {
        projects: this.projects,
        workItems: this.workItems,
        changeRequests: this.changes,
        qualityItems: this.quality,
        timeEntries: this.time,
      },
      this.now,
      async (approval) => {
        const actor = await this.capabilities.resolveCurrent();
        if (this.metrics) {
          await this.metrics
            .refreshProject(approval.projectId, actor)
            .catch(() => undefined);
        }
      },
    );
  }

  private async resolveSource(
    draft: IChangeRequestDraft,
    actor: IPmoResolvedUserContext,
  ): Promise<{ project: IPmoProject; workItem?: IPmoWorkItem }> {
    if (!draft.projectId) throw new Error("A source project is required.");
    const project = await this.projects.getById(draft.projectId);
    const workItem = draft.workItemId
      ? await this.workItems.getById(draft.workItemId)
      : undefined;
    if (workItem && workItem.projectId !== project.id) {
      throw new Error(
        "The selected work item does not belong to the source project.",
      );
    }
    if (draft.requestType !== "Project Variation" && !workItem) {
      throw new Error("Task-level requests require a work item.");
    }
    const memberships = await this.capabilities.getProjectMemberships();
    const related =
      actor.capabilities.has("projects.manage") ||
      project.projectManager.id === actor.sharePointUserId ||
      workItem?.assignedEmployeeId === actor.employee?.id ||
      memberships.some((member) => member.projectId === project.id);
    if (!related) {
      throw new Error(
        "You do not have a project relationship that permits this request.",
      );
    }
    return { project, workItem };
  }

  private requestValues(
    draft: IChangeRequestDraft,
    source: { project: IPmoProject; workItem?: IPmoWorkItem },
    actor: IPmoResolvedUserContext,
    status: IPmoChangeRequest["requestStatus"],
  ): Record<string, unknown> {
    const currentEffort =
      source.workItem?.approvedEffortHours ??
      source.project.approvedEffortHours;
    const originalEffort =
      source.workItem?.baselineEffortHours ??
      source.project.baselineEffortHours;
    const originalDate =
      source.workItem?.plannedEnd ?? source.project.baselineEnd;
    return {
      [F.changeRequests.Title]:
        `${draft.requestType} — ${source.project.projectCode ?? source.project.title}`,
      [F.changeRequests.RequestType]: draft.requestType,
      [F.changeRequests.ProjectId]: source.project.id,
      [F.changeRequests.ProjectCode]: source.project.projectCode ?? "",
      [F.changeRequests.WorkItemId]: source.workItem?.id,
      [`${F.changeRequests.RequestedBy}Id`]: actor.sharePointUserId,
      [F.changeRequests.RequestedOn]: this.now().toISOString(),
      [F.changeRequests.ReasonCategory]: draft.reasonCategory,
      [F.changeRequests.ReasonDetails]: draft.reasonDetails.trim(),
      // Source values are always re-read here; the client cannot set them.
      [F.changeRequests.OriginalEffortHours]: originalEffort,
      [F.changeRequests.CurrentEffortHours]: currentEffort,
      [F.changeRequests.AdditionalHoursRequested]:
        draft.additionalHoursRequested,
      [F.changeRequests.ProposedEffortHours]: draft.proposedEffortHours,
      [F.changeRequests.OriginalDate]: originalDate?.toISOString(),
      [F.changeRequests.ProposedDate]: draft.proposedDate
        ? new Date(`${draft.proposedDate}T00:00:00`).toISOString()
        : undefined,
      [F.changeRequests.ImpactSummary]: draft.impactSummary.trim(),
      [F.changeRequests.MitigationPlan]: draft.mitigationPlan?.trim(),
      [F.changeRequests.RequestStatus]: status,
    };
  }

  private assertValidForSubmission(request: IPmoChangeRequest): void {
    const errors = validateChangeRequest(request);
    if (errors.length) throw new Error(errors[0]);
  }

  private assertRequester(
    actor: IPmoResolvedUserContext,
    request?: IPmoChangeRequest,
  ): void {
    if (!actor.employee && !actor.capabilities.has("projects.manage")) {
      throw new Error(
        "An active employee or authorized project manager is required to create a change request.",
      );
    }
    if (
      request &&
      request.requestedBy.id !== actor.sharePointUserId &&
      !actor.securityRoles.has("owner")
    ) {
      throw new Error("Only the requestor may change this request.");
    }
  }

  private defaultDueOn(): Date {
    const due = new Date(this.now());
    due.setDate(due.getDate() + 5);
    return due;
  }

  private async withActor<T>(
    action: (actor: IPmoResolvedUserContext) => Promise<T>,
  ): Promise<T> {
    return action(await this.capabilities.resolveCurrent());
  }
}
