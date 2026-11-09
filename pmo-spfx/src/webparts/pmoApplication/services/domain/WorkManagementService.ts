import type { IPmoTaskAction, IPmoWorkItem } from "../../models/domain";
import type { IRepositoryPage } from "../repositories/contracts";
import type {
  TaskActionsRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import type { ITaskActionInput } from "./DomainRules";
import {
  ReviewWorkflowService,
  type ReviewAction,
} from "./ReviewWorkflowService";
import { TaskWorkflowService } from "./TaskWorkflowService";
import {
  assertCapability,
  type UserCapabilityService,
} from "./UserCapabilityService";

/** Feature-facing work boundary: UI can read its queues and request actions only. */
export class WorkManagementService {
  public constructor(
    private readonly workItems: Pick<
      WorkItemsRepository,
      | "getById"
      | "getAssignedTo"
      | "getReviewQueueForUser"
      | "getQaQueueForUser"
    >,
    private readonly actions: Pick<
      TaskActionsRepository,
      "getByWorkItem" | "getForRequestor" | "getFailed" | "getById"
    >,
    private readonly taskWorkflow: TaskWorkflowService,
    private readonly reviews: ReviewWorkflowService,
    private readonly capabilities: UserCapabilityService,
  ) {}

  public async myWork(
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "work.view-own");
    if (!actor.employee) return { items: [] };
    return this.workItems.getAssignedTo(actor.employee.id, continuation);
  }

  public async get(id: number): Promise<IPmoWorkItem> {
    const actor = await this.capabilities.resolveCurrent();
    const item = await this.workItems.getById(id);
    const own = actor.employee?.id === item.assignedEmployeeId;
    if (
      !own &&
      !actor.capabilities.has("projects.manage") &&
      item.reviewer?.id !== actor.sharePointUserId &&
      item.qaOwner?.id !== actor.sharePointUserId
    )
      throw new Error("You are not authorized to view this work item.");
    return item;
  }

  public async history(
    workItemId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTaskAction>> {
    await this.get(workItemId);
    return this.actions.getByWorkItem(workItemId, continuation);
  }

  public async myActionHistory(
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTaskAction>> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "work.view-own");
    return this.actions.getForRequestor(actor.sharePointUserId, continuation);
  }

  public async request(
    workItemId: number,
    input: ITaskActionInput,
  ): Promise<IPmoTaskAction> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "work.act-own");
    return this.taskWorkflow.requestAndApply(
      workItemId,
      {
        employeeId: actor.employee?.id,
        sharePointUserId: actor.sharePointUserId,
        displayName: actor.displayName,
        isProjectManager: actor.capabilities.has("projects.manage"),
        isQa: actor.eligibility.isQa && actor.securityRoles.has("qa"),
        isOwner: actor.securityRoles.has("owner"),
      },
      input,
    );
  }

  public async retry(actionId: number): Promise<IPmoTaskAction> {
    const actor = await this.capabilities.resolveCurrent();
    const action = await this.actions.getById(actionId);
    if (action.processingStatus !== "Failed") return action;
    if (
      !actor.capabilities.has("support.failed-actions") &&
      action.requestedBy.id !== actor.sharePointUserId
    )
      throw new Error(
        "Only the requestor or authorized support may retry this failed action.",
      );
    return this.taskWorkflow.apply(actionId, {
      employeeId: actor.employee?.id,
      sharePointUserId: actor.sharePointUserId,
      displayName: actor.displayName,
      isProjectManager: actor.capabilities.has("projects.manage"),
      isQa: actor.eligibility.isQa && actor.securityRoles.has("qa"),
      isOwner: actor.securityRoles.has("owner"),
    });
  }

  public async reviewQueue(
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.capabilities.has("projects.manage") && !actor.eligibility.isQa)
      throw new Error("You are not authorized to review work.");
    return this.workItems.getReviewQueueForUser(
      actor.sharePointUserId,
      continuation,
    );
  }

  public async qaQueue(
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.eligibility.isQa && !actor.capabilities.has("projects.manage"))
      throw new Error("You are not authorized to review QA work.");
    return this.workItems.getQaQueueForUser(
      actor.sharePointUserId,
      continuation,
    );
  }

  public review(
    workItemId: number,
    action: ReviewAction,
    comment?: string,
  ): Promise<IPmoWorkItem> {
    return this.reviews.apply(workItemId, action, comment);
  }
}
