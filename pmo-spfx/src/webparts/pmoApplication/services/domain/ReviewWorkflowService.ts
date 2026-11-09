import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type { IPmoWorkItem } from "../../models/domain";
import type { WorkItemsRepository } from "../repositories/repositories";
import { assertWorkItemStatusTransition } from "./DomainRules";
import type { UserCapabilityService } from "./UserCapabilityService";

export type ReviewAction =
  | "Accept"
  | "Return"
  | "Request Clarification"
  | "Route to QA";

/** Governed reviewer/QA mutations; employees use TaskWorkflowService instead. */
export class ReviewWorkflowService {
  public constructor(
    private readonly workItems: Pick<WorkItemsRepository, "getById" | "update">,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async apply(
    workItemId: number,
    action: ReviewAction,
    comment?: string,
  ): Promise<IPmoWorkItem> {
    const actor = await this.capabilities.resolveCurrent();
    const item = await this.workItems.getById(workItemId);
    const isReviewer = item.reviewer?.id === actor.sharePointUserId;
    const isQaOwner = item.qaOwner?.id === actor.sharePointUserId;
    const isManager =
      actor.capabilities.has("projects.manage") ||
      actor.securityRoles.has("owner");
    if (!isReviewer && !isQaOwner && !isManager)
      throw new Error(
        "Only the assigned reviewer, QA owner, or project manager can review this work.",
      );
    if (
      (action === "Return" || action === "Request Clarification") &&
      !comment?.trim()
    )
      throw new Error(`${action} requires a comment.`);
    let current = item;
    // Review and QA gates are explicit persisted states, so audit/version
    // history never appears to skip an approval boundary.
    if (current.status === "Submitted for Review") {
      assertWorkItemStatusTransition(current.status, "In Review");
      current = await this.workItems.update(
        current.id,
        { [F.workItems.Status]: "In Review" },
        current.etag,
      );
    }
    if (current.status === "Submitted to QA") {
      assertWorkItemStatusTransition(current.status, "QA In Progress");
      current = await this.workItems.update(
        current.id,
        { [F.workItems.Status]: "QA In Progress" },
        current.etag,
      );
    }
    let target: IPmoWorkItem["status"];
    if (action === "Return" || action === "Request Clarification")
      target = "In Progress";
    else if (
      action === "Route to QA" ||
      (action === "Accept" && item.qaRequired)
    )
      target = "Submitted to QA";
    else target = "Accepted";
    assertWorkItemStatusTransition(current.status, target);
    const values: Record<string, unknown> = { [F.workItems.Status]: target };
    if (target === "Accepted") {
      values[F.workItems.AcceptedOn] = this.now().toISOString();
      values[F.workItems.CompletedOn] = this.now().toISOString();
      values[F.workItems.PercentComplete] = 100;
    }
    return this.workItems.update(current.id, values, current.etag);
  }
}
