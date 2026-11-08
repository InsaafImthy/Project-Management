import {
  PMO_FIELDS as F,
  PMO_LISTS,
  type PmoContainerName,
} from "../../config/sharePointSchema";
import type { IPmoApprovalRequest, IPmoPerson } from "../../models/domain";
import type {
  ApprovalRequestsRepository,
  ChangeRequestsRepository,
  ProjectsRepository,
  QualityItemsRepository,
  TimeEntriesRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import { SharePointError } from "../sharepoint/SharePointError";
import {
  approvalStatusForDecision,
  assertApprovalTransition,
  generateRecordCode,
  type ApprovalDecision,
} from "./DomainRules";

const personIdField = (field: string): string => `${field}Id`;

export interface IApprovalWorkflowActor extends IPmoPerson {
  readonly isApproverEligible: boolean;
  readonly hasApproverRole: boolean;
  readonly isOwner: boolean;
}

export interface ICreateApprovalInput {
  readonly title: string;
  readonly approvalType: IPmoApprovalRequest["approvalType"];
  readonly sourceList: PmoContainerName;
  readonly sourceItemId: number;
  readonly projectId: number;
  readonly projectCode: string;
  readonly requestedBy: IPmoPerson;
  readonly approver: IApprovalWorkflowActor;
  readonly dueOn?: Date;
  readonly segregationOfDuties: boolean;
}

export interface IApprovalSourceRepositories {
  readonly projects: Pick<ProjectsRepository, "getById" | "update">;
  readonly workItems: Pick<WorkItemsRepository, "getById" | "update">;
  readonly changeRequests: Pick<ChangeRequestsRepository, "getById" | "update">;
  readonly qualityItems: Pick<QualityItemsRepository, "getById" | "update">;
  readonly timeEntries: Pick<TimeEntriesRepository, "getById" | "update">;
}

const terminalApprovalStatuses: readonly IPmoApprovalRequest["approvalStatus"][] =
  ["Approved", "Conditionally Approved", "Rejected", "Cancelled", "Expired"];

const decisionCommentRequired = (decision: ApprovalDecision): boolean =>
  decision !== "Approve";

export class ApprovalWorkflowService {
  public constructor(
    private readonly approvals: Pick<
      ApprovalRequestsRepository,
      "getById" | "create" | "update"
    >,
    private readonly sources: IApprovalSourceRepositories,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async create(
    input: ICreateApprovalInput,
  ): Promise<IPmoApprovalRequest> {
    this.assertApprover(
      input.requestedBy,
      input.approver,
      input.segregationOfDuties,
    );
    const requestedOn = this.now();
    const created = await this.approvals.create({
      [F.approvalRequests.Title]: input.title,
      [F.approvalRequests.ApprovalNumber]: `PENDING-${requestedOn.valueOf()}`,
      [F.approvalRequests.ApprovalType]: input.approvalType,
      [F.approvalRequests.SourceList]: input.sourceList,
      [F.approvalRequests.SourceItemId]: input.sourceItemId,
      [F.approvalRequests.ProjectId]: input.projectId,
      [F.approvalRequests.ProjectCode]: input.projectCode,
      [personIdField(F.approvalRequests.RequestedBy)]: input.requestedBy.id,
      [F.approvalRequests.RequestedOn]: requestedOn.toISOString(),
      [personIdField(F.approvalRequests.Approver)]: input.approver.id,
      [F.approvalRequests.ApprovalStatus]: "Submitted",
      [F.approvalRequests.DueOn]: input.dueOn?.toISOString(),
      [F.approvalRequests.EscalationLevel]: 0,
      [F.approvalRequests.FlowProcessingStatus]: "New",
    });
    return this.approvals.update(
      created.id,
      {
        [F.approvalRequests.ApprovalNumber]: generateRecordCode(
          "Approval",
          created.id,
          created.created ?? requestedOn,
        ),
      },
      created.etag,
    );
  }

  public async decide(
    approvalId: number,
    actor: IApprovalWorkflowActor,
    decision: ApprovalDecision,
    comment?: string,
    segregationOfDuties = true,
  ): Promise<IPmoApprovalRequest> {
    let approval = await this.approvals.getById(approvalId);
    if (terminalApprovalStatuses.indexOf(approval.approvalStatus) >= 0) {
      return approval;
    }
    this.assertApprover(approval.requestedBy, actor, segregationOfDuties);
    if (approval.approver.id !== actor.id && !actor.isOwner) {
      throw new Error("Only the assigned approver may decide this request.");
    }
    if (decisionCommentRequired(decision) && !comment?.trim()) {
      throw new Error(`${decision} requires a decision comment.`);
    }
    const targetStatus = approvalStatusForDecision(decision);
    assertApprovalTransition(approval.approvalStatus, targetStatus);
    approval = await this.approvals.update(
      approval.id,
      {
        [F.approvalRequests.ApprovalStatus]: "In Progress",
        [F.approvalRequests.FlowProcessingStatus]: "Processing",
      },
      approval.etag,
    );
    try {
      await this.applyGovernedSource(approval, actor, decision, comment);
      return await this.approvals.update(
        approval.id,
        {
          [F.approvalRequests.ApprovalStatus]: targetStatus,
          [F.approvalRequests.Decision]: decision,
          [F.approvalRequests.DecisionComment]: comment,
          [personIdField(F.approvalRequests.DecidedBy)]: actor.id,
          [F.approvalRequests.DecidedOn]: this.now().toISOString(),
          [F.approvalRequests.FlowProcessingStatus]: "Completed",
        },
        approval.etag,
      );
    } catch (error) {
      const message =
        error instanceof SharePointError
          ? `${error.message}${error.correlationId ? ` Correlation ID: ${error.correlationId}.` : ""}`
          : error instanceof Error
            ? error.message
            : "Unexpected approval processing error.";
      await this.approvals
        .update(
          approval.id,
          {
            [F.approvalRequests.FlowProcessingStatus]: "Failed",
            [F.approvalRequests.DecisionComment]: message,
          },
          approval.etag,
        )
        .catch(() => undefined);
      throw error;
    }
  }

  private assertApprover(
    requestor: IPmoPerson,
    approver: IApprovalWorkflowActor,
    segregationOfDuties: boolean,
  ): void {
    if (!approver.hasApproverRole || !approver.isApproverEligible) {
      if (!approver.isOwner) {
        throw new Error(
          "Approver requires both eligibility and the Approver security role.",
        );
      }
    }
    if (segregationOfDuties && requestor.id === approver.id) {
      throw new Error("Requestor and approver must be different people.");
    }
  }

  private async applyGovernedSource(
    approval: IPmoApprovalRequest,
    actor: IApprovalWorkflowActor,
    decision: ApprovalDecision,
    comment?: string,
  ): Promise<void> {
    const approved =
      decision === "Approve" || decision === "Conditionally Approve";
    switch (approval.approvalType) {
      case "Project Baseline": {
        this.assertSource(approval, PMO_LISTS.projects);
        const project = await this.sources.projects.getById(
          approval.sourceItemId,
        );
        if (
          (approved &&
            project.status === "Approved" &&
            project.baselineApprovedBy?.id === actor.id) ||
          (!approved && project.status === "Draft")
        ) {
          return;
        }
        await this.sources.projects.update(
          project.id,
          approved
            ? {
                [F.projects.Status]: "Approved",
                [F.projects.BaselineVersion]: project.baselineVersion + 1,
                [personIdField(F.projects.BaselineApprovedBy)]: actor.id,
                [F.projects.BaselineApprovedOn]: this.now().toISOString(),
              }
            : { [F.projects.Status]: "Draft" },
          project.etag,
        );
        return;
      }
      case "Execution Plan": {
        this.assertSource(approval, PMO_LISTS.projects);
        const project = await this.sources.projects.getById(
          approval.sourceItemId,
        );
        if (
          (approved && project.status === "Active") ||
          (!approved && project.status === "Approved")
        ) {
          return;
        }
        await this.sources.projects.update(
          project.id,
          approved
            ? {
                [F.projects.CurrentPlanVersion]: project.currentPlanVersion + 1,
                [F.projects.Status]: "Active",
              }
            : { [F.projects.Status]: "Approved" },
          project.etag,
        );
        return;
      }
      case "Task Change":
      case "Project Variation": {
        this.assertSource(approval, PMO_LISTS.changeRequests);
        const request = await this.sources.changeRequests.getById(
          approval.sourceItemId,
        );
        const requestStatus =
          decision === "Approve"
            ? "Approved"
            : decision === "Conditionally Approve"
              ? "Conditionally Approved"
              : decision === "Request Clarification"
                ? "Clarification Requested"
                : "Rejected";
        if (request.requestStatus !== requestStatus) {
          await this.sources.changeRequests.update(
            request.id,
            {
              [F.changeRequests.RequestStatus]: requestStatus,
              [F.changeRequests.DecisionComment]: comment,
              [personIdField(F.changeRequests.DecidedBy)]: actor.id,
              [F.changeRequests.DecidedOn]: this.now().toISOString(),
            },
            request.etag,
          );
        }
        if (approved && request.workItemId) {
          const workItem = await this.sources.workItems.getById(
            request.workItemId,
          );
          const values: Record<string, unknown> = {};
          if (request.proposedEffortHours !== undefined) {
            values[F.workItems.ApprovedEffortHours] =
              request.proposedEffortHours;
          }
          if (request.proposedDate) {
            values[F.workItems.PlannedEnd] = request.proposedDate.toISOString();
          }
          if (Object.keys(values).length > 0) {
            await this.sources.workItems.update(
              workItem.id,
              values,
              workItem.etag,
            );
          }
        } else if (approved && approval.approvalType === "Project Variation") {
          const project = await this.sources.projects.getById(
            approval.projectId,
          );
          const values: Record<string, unknown> = {};
          if (request.proposedEffortHours !== undefined) {
            values[F.projects.ApprovedEffortHours] =
              request.proposedEffortHours;
          }
          if (request.proposedDate) {
            values[F.projects.CurrentApprovedEnd] =
              request.proposedDate.toISOString();
          }
          if (Object.keys(values).length > 0) {
            await this.sources.projects.update(
              project.id,
              values,
              project.etag,
            );
          }
        }
        return;
      }
      case "QA Exception": {
        this.assertSource(approval, PMO_LISTS.qualityItems);
        const quality = await this.sources.qualityItems.getById(
          approval.sourceItemId,
        );
        const targetQualityStatus = approved
          ? "Approved Exception"
          : decision === "Request Clarification"
            ? "In Review"
            : "Rejected";
        if (quality.status === targetQualityStatus) return;
        await this.sources.qualityItems.update(
          quality.id,
          {
            [F.qualityItems.Status]: targetQualityStatus,
          },
          quality.etag,
        );
        return;
      }
      case "Project Closure": {
        this.assertSource(approval, PMO_LISTS.projects);
        const project = await this.sources.projects.getById(
          approval.sourceItemId,
        );
        const targetProjectStatus = approved ? "Closed" : "Active";
        if (project.status === targetProjectStatus) return;
        await this.sources.projects.update(
          project.id,
          { [F.projects.Status]: targetProjectStatus },
          project.etag,
        );
        return;
      }
      case "Time Correction": {
        this.assertSource(approval, PMO_LISTS.timeEntries);
        const entry = await this.sources.timeEntries.getById(
          approval.sourceItemId,
        );
        if (approved && !entry.isLocked && entry.entryStatus === "Returned") {
          return;
        }
        await this.sources.timeEntries.update(
          entry.id,
          approved
            ? {
                [F.timeEntries.IsLocked]: false,
                [F.timeEntries.EntryStatus]: "Returned",
                [F.timeEntries.CorrectionReason]: comment,
              }
            : { [F.timeEntries.CorrectionReason]: comment },
          entry.etag,
        );
      }
    }
  }

  private assertSource(
    approval: IPmoApprovalRequest,
    expected: PmoContainerName,
  ): void {
    if (approval.sourceList !== expected) {
      throw new Error(
        `${approval.approvalType} must govern ${expected}, not ${approval.sourceList}.`,
      );
    }
  }
}
