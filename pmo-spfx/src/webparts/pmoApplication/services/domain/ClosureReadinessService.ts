import type { IPmoApprovalRequest, IPmoQualityItem } from "../../models/domain";
import type {
  ApprovalRequestsRepository,
  ProjectStatusReportsRepository,
  QualityItemsRepository,
  RisksIssuesRepository,
  TimeEntriesRepository,
  WorkItemsRepository,
} from "../repositories/repositories";

export type ClosureReadinessCategory =
  | "tasks"
  | "time"
  | "quality"
  | "approvals"
  | "risks"
  | "statusEvidence"
  | "acceptanceEvidence";

export interface IClosureReadinessItem {
  readonly category: ClosureReadinessCategory;
  readonly count: number;
  readonly blocking: boolean;
  readonly message: string;
}

export interface IClosureReadinessPolicy {
  readonly requireApprovedStatusReport?: boolean;
  readonly requireAcceptanceEvidence?: boolean;
  readonly hasAcceptanceEvidence?: boolean;
}

export interface IClosureReadinessResult {
  readonly projectId: number;
  readonly ready: boolean;
  readonly checkedOn: Date;
  readonly blockingItems: readonly IClosureReadinessItem[];
  readonly nonBlockingItems: readonly IClosureReadinessItem[];
}

const pendingApproval = (approval: IPmoApprovalRequest): boolean =>
  ["Submitted", "In Progress", "Clarification Requested"].indexOf(
    approval.approvalStatus,
  ) >= 0;

const openCriticalQuality = (item: IPmoQualityItem): boolean =>
  ["Closed", "Passed", "Rejected", "Approved Exception"].indexOf(item.status) <
    0 &&
  (item.severity === "Critical" || item.isReleaseBlocking);

/** Reusable, read-only closure gate over persisted SharePoint records. */
export class ClosureReadinessService {
  public constructor(
    private readonly workItems: WorkItemsRepository,
    private readonly timeEntries: TimeEntriesRepository,
    private readonly quality: QualityItemsRepository,
    private readonly approvals: ApprovalRequestsRepository,
    private readonly risks: RisksIssuesRepository,
    private readonly reports: ProjectStatusReportsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async check(
    projectId: number,
    policy: IClosureReadinessPolicy = {},
  ): Promise<IClosureReadinessResult> {
    const [work, time, quality, approvals, risks, reports] = await Promise.all([
      this.workItems.getByProject(projectId),
      this.timeEntries.getByProject(projectId),
      this.quality.getByProject(projectId),
      this.approvals.getByProject(projectId),
      this.risks.getOpenByProject(projectId),
      this.reports.getByProject(projectId),
    ]);
    const mandatoryTasks = work.items.filter(
      (item) =>
        item.isActive &&
        item.itemType !== "Phase" &&
        item.status !== "Cancelled" &&
        item.percentComplete < 100,
    );
    const incompleteTime = time.items.filter(
      (item) =>
        item.entryStatus !== "Approved" && item.entryStatus !== "Locked",
    );
    const blockingQuality = quality.items.filter(openCriticalQuality);
    const pending = approvals.items.filter(
      (item) =>
        item.approvalType !== "Project Closure" && pendingApproval(item),
    );
    const criticalRisks = risks.items.filter(
      (item) =>
        item.severity === "Critical" &&
        item.status !== "Resolved" &&
        item.status !== "Accepted" &&
        item.status !== "Closed",
    );
    const approvedReport = reports.items.some(
      (report) => report.reportStatus === "Approved",
    );
    const blockingItems: IClosureReadinessItem[] = [];
    const push = (
      category: ClosureReadinessCategory,
      count: number,
      message: string,
    ): void => {
      if (count > 0)
        blockingItems.push({ category, count, message, blocking: true });
    };
    push("tasks", mandatoryTasks.length, "Mandatory work items remain open.");
    push(
      "time",
      incompleteTime.length,
      "Time entries remain incomplete or unapproved.",
    );
    push(
      "quality",
      blockingQuality.length,
      "Critical or release-blocking quality items remain open without an approved QA exception.",
    );
    push("approvals", pending.length, "Mandatory approvals remain unresolved.");
    push(
      "risks",
      criticalRisks.length,
      "Critical risks or issues remain unresolved or unaccepted.",
    );
    if (policy.requireApprovedStatusReport && !approvedReport)
      push(
        "statusEvidence",
        1,
        "An approved project status report is required.",
      );
    if (policy.requireAcceptanceEvidence && !policy.hasAcceptanceEvidence)
      push(
        "acceptanceEvidence",
        1,
        "Configured acceptance evidence is missing.",
      );

    const nonBlockingItems: IClosureReadinessItem[] = [];
    const acceptedItems = risks.items.filter(
      (item) => item.status === "Accepted",
    );
    if (acceptedItems.length)
      nonBlockingItems.push({
        category: "risks",
        count: acceptedItems.length,
        blocking: false,
        message: "Accepted risks remain visible in the closure package.",
      });
    const approvedExceptions = quality.items.filter(
      (item) => item.status === "Approved Exception",
    );
    if (approvedExceptions.length)
      nonBlockingItems.push({
        category: "quality",
        count: approvedExceptions.length,
        blocking: false,
        message: "Approved QA exceptions remain visible in quality reporting.",
      });
    return {
      projectId,
      ready: blockingItems.length === 0,
      checkedOn: this.now(),
      blockingItems,
      nonBlockingItems,
    };
  }

  public async assertReady(
    projectId: number,
    policy?: IClosureReadinessPolicy,
  ): Promise<IClosureReadinessResult> {
    const result = await this.check(projectId, policy);
    if (!result.ready)
      throw new Error(
        `Project closure is blocked: ${result.blockingItems
          .map((item) => `${item.count} ${item.message.toLowerCase()}`)
          .join(" ")}`,
      );
    return result;
  }
}
