import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type {
  IPmoRiskIssue,
  IPmoTaskAction,
  IPmoWorkItem,
} from "../../models/domain";
import type {
  RisksIssuesRepository,
  TaskActionsRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import { SharePointError } from "../sharepoint/SharePointError";
import {
  generateRecordCode,
  targetStatusForTaskAction,
  validateTaskActionEligibility,
  type ITaskActionActor,
  type ITaskActionInput,
} from "./DomainRules";

export interface ITaskWorkflowActor extends ITaskActionActor {
  readonly displayName: string;
}

const personIdField = (field: string): string => `${field}Id`;
const safeMessage = (error: unknown): string =>
  error instanceof SharePointError
    ? `${error.message}${error.correlationId ? ` Correlation ID: ${error.correlationId}.` : ""}`
    : error instanceof Error
      ? error.message
      : "Unexpected task-action processing failure.";

export class TaskWorkflowService {
  public constructor(
    private readonly workItems: Pick<WorkItemsRepository, "getById" | "update">,
    private readonly taskActions: Pick<
      TaskActionsRepository,
      "getById" | "create" | "update"
    >,
    private readonly risksIssues: Pick<
      RisksIssuesRepository,
      "getOpenByProject" | "create" | "update"
    >,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async requestAndApply(
    workItemId: number,
    actor: ITaskWorkflowActor,
    input: ITaskActionInput,
  ): Promise<IPmoTaskAction> {
    const workItem = await this.workItems.getById(workItemId);
    const requestedOn = this.now();
    const action = await this.taskActions.create({
      [F.taskActions.Title]: `${input.actionType}: ${workItem.title}`,
      [F.taskActions.ProjectId]: workItem.projectId,
      [F.taskActions.ProjectCode]: workItem.projectCode,
      [F.taskActions.WorkItemId]: workItem.id,
      [F.taskActions.WorkItemCode]:
        workItem.workItemCode ?? `ID-${workItem.id}`,
      [F.taskActions.ActionType]: input.actionType,
      [personIdField(F.taskActions.RequestedBy)]: actor.sharePointUserId,
      [F.taskActions.RequestedOn]: requestedOn.toISOString(),
      [F.taskActions.ProgressPercent]: input.progressPercent,
      [F.taskActions.RemainingEffortHours]: input.remainingEffortHours,
      [F.taskActions.Comment]: input.comment,
      [F.taskActions.ProposedStatus]: targetStatusForTaskAction(
        input.actionType,
      ),
      [F.taskActions.ProcessingStatus]: "New",
    });
    return this.apply(action.id, actor);
  }

  public async apply(
    actionId: number,
    actor: ITaskWorkflowActor,
  ): Promise<IPmoTaskAction> {
    let action = await this.taskActions.getById(actionId);
    if (action.processingStatus === "Applied") return action;
    if (action.processingStatus === "Rejected") return action;
    const workItem = await this.workItems.getById(action.workItemId);
    if (workItem.lastActionId === action.id) {
      try {
        await this.ensureRelatedSideEffects(workItem, action);
        return this.finishAction(
          action,
          "Applied",
          "Action was already applied.",
        );
      } catch (error) {
        return this.finishAction(action, "Failed", safeMessage(error));
      }
    }
    const input: ITaskActionInput = {
      actionType: action.actionType,
      comment: action.comment,
      progressPercent: action.progressPercent,
      remainingEffortHours: action.remainingEffortHours,
    };
    const errors = [...validateTaskActionEligibility(actor, workItem, input)];
    if (action.requestedBy.id !== actor.sharePointUserId) {
      errors.push("The processing actor does not match the action requestor.");
    }
    if (errors.length > 0) {
      return this.finishAction(action, "Rejected", errors.join(" "));
    }

    action = await this.taskActions.update(
      action.id,
      { [F.taskActions.ProcessingStatus]: "Processing" },
      action.etag,
    );
    try {
      await this.applyWorkItemMutation(workItem, action);
      return await this.finishAction(action, "Applied", "Action applied.");
    } catch (error) {
      return this.finishAction(action, "Failed", safeMessage(error));
    }
  }

  private async applyWorkItemMutation(
    workItem: IPmoWorkItem,
    action: IPmoTaskAction,
  ): Promise<void> {
    const values: Record<string, unknown> = {
      [F.workItems.LastActionId]: action.id,
    };
    const target = targetStatusForTaskAction(action.actionType);
    if (target) values[F.workItems.Status] = target;
    if (action.actionType === "Start" && !workItem.actualStart) {
      values[F.workItems.ActualStart] = this.now().toISOString();
    }
    if (action.actionType === "Progress Update") {
      values[F.workItems.PercentComplete] = action.progressPercent;
      values[F.workItems.ForecastEffortHours] =
        workItem.actualEffortHours + (action.remainingEffortHours ?? 0);
    }
    if (action.actionType === "Submit for Review") {
      values[F.workItems.SubmittedOn] = this.now().toISOString();
    }
    await this.workItems.update(workItem.id, values, workItem.etag);
    if (action.actionType === "Block")
      await this.createBlocker(workItem, action);
    if (action.actionType === "Unblock")
      await this.resolveBlockers(workItem, action);
  }

  private async ensureRelatedSideEffects(
    workItem: IPmoWorkItem,
    action: IPmoTaskAction,
  ): Promise<void> {
    if (action.actionType === "Block")
      await this.createBlocker(workItem, action);
    if (action.actionType === "Unblock")
      await this.resolveBlockers(workItem, action);
  }

  private async createBlocker(
    workItem: IPmoWorkItem,
    action: IPmoTaskAction,
  ): Promise<void> {
    const existing = await this.findRelatedBlockers(workItem);
    if (existing.length > 0) return;
    const created = await this.risksIssues.create({
      [F.risksIssues.Title]: `Blocker: ${workItem.title}`,
      [F.risksIssues.RecordNumber]: `PENDING-${action.id}`,
      [F.risksIssues.RecordType]: "Blocker",
      [F.risksIssues.ProjectId]: workItem.projectId,
      [F.risksIssues.ProjectCode]: workItem.projectCode,
      [F.risksIssues.WorkItemId]: workItem.id,
      [F.risksIssues.Severity]: workItem.isCritical ? "Critical" : "High",
      [F.risksIssues.Description]: action.comment ?? "Work item blocked.",
      [F.risksIssues.Impact]: action.comment ?? "Delivery is blocked.",
      [personIdField(F.risksIssues.Owner)]: action.requestedBy.id,
      [personIdField(F.risksIssues.RaisedBy)]: action.requestedBy.id,
      [F.risksIssues.RaisedOn]: this.now().toISOString(),
      [F.risksIssues.Status]: "Open",
      [F.risksIssues.IsEscalated]: workItem.isCritical,
    });
    await this.risksIssues.update(
      created.id,
      {
        [F.risksIssues.RecordNumber]: generateRecordCode(
          "Risk",
          created.id,
          created.created ?? this.now(),
        ),
      },
      created.etag,
    );
  }

  private async resolveBlockers(
    workItem: IPmoWorkItem,
    action: IPmoTaskAction,
  ): Promise<void> {
    const blockers = await this.findRelatedBlockers(workItem);
    await Promise.all(
      blockers.map((blocker) =>
        this.risksIssues.update(
          blocker.id,
          {
            [F.risksIssues.Status]: "Resolved",
            [F.risksIssues.Resolution]: action.comment ?? "Blocker cleared.",
            [F.risksIssues.ResolvedOn]: this.now().toISOString(),
          },
          blocker.etag,
        ),
      ),
    );
  }

  private async findRelatedBlockers(
    workItem: IPmoWorkItem,
  ): Promise<readonly IPmoRiskIssue[]> {
    const page = await this.risksIssues.getOpenByProject(workItem.projectId);
    return page.items.filter(
      (item) =>
        item.recordType === "Blocker" && item.workItemId === workItem.id,
    );
  }

  private finishAction(
    action: IPmoTaskAction,
    status: "Applied" | "Rejected" | "Failed",
    message: string,
  ): Promise<IPmoTaskAction> {
    return this.taskActions.update(
      action.id,
      {
        [F.taskActions.ProcessingStatus]: status,
        [F.taskActions.ProcessedOn]: this.now().toISOString(),
        [F.taskActions.ResultMessage]: message,
      },
      action.etag,
    );
  }
}
