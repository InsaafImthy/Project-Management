import type {
  IPmoApprovalRequest,
  IPmoProject,
  IPmoQualityItem,
  IPmoTaskAction,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../../models/domain";
import type {
  ApprovalRequestsRepository,
  ProjectsRepository,
  QualityItemsRepository,
  TaskActionsRepository,
  TimeEntriesRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import { calculateRequiredDailyHours } from "./DomainRules";
import type { IPmoResolvedUserContext } from "./UserCapabilityService";
import { hasCapability } from "./UserCapabilityService";
import type { UserCapabilityService } from "./UserCapabilityService";

export type ActionCenterCategory =
  | "awaitingAcceptance"
  | "dueSoon"
  | "overdue"
  | "blocked"
  | "reviewsAndQa"
  | "pendingApprovals"
  | "returned"
  | "incompleteWorkday"
  | "failedTaskActions"
  | "staleMetrics";

export interface IActionCenterIncompleteDay {
  readonly workDate: Date;
  readonly requiredHours: number;
  readonly recordedHours: number;
  readonly missingHours: number;
}

export interface IActionCenterResult {
  readonly counts: Readonly<Record<ActionCenterCategory, number>>;
  readonly awaitingAcceptance: readonly IPmoWorkItem[];
  readonly dueSoon: readonly IPmoWorkItem[];
  readonly overdue: readonly IPmoWorkItem[];
  readonly blocked: readonly IPmoWorkItem[];
  readonly reviews: readonly IPmoWorkItem[];
  readonly qaWork: readonly (IPmoWorkItem | IPmoQualityItem)[];
  readonly pendingApprovals: readonly IPmoApprovalRequest[];
  readonly returnedTime: readonly IPmoTimeEntry[];
  readonly returnedWork: readonly IPmoTaskAction[];
  readonly incompleteWorkday?: IActionCenterIncompleteDay;
  readonly failedTaskActions: readonly IPmoTaskAction[];
  readonly staleMetrics: readonly IPmoProject[];
}

export interface IActionCenterOptions {
  readonly dueSoonDays?: number;
  readonly metricStaleAfterHours?: number;
  readonly isWorkingDay?: boolean;
  readonly approvedLeaveHours?: number;
}

export class ActionCenterService {
  public constructor(
    private readonly workItems: Pick<
      WorkItemsRepository,
      "getAssignedTo" | "getReviewQueueForUser" | "getQaQueueForUser"
    >,
    private readonly qualityItems: Pick<
      QualityItemsRepository,
      "getAssignedTo"
    >,
    private readonly approvals: Pick<
      ApprovalRequestsRepository,
      "getPendingForApprover"
    >,
    private readonly timeEntries: Pick<
      TimeEntriesRepository,
      "getEmployeeRange"
    >,
    private readonly taskActions: Pick<
      TaskActionsRepository,
      "getForRequestor" | "getFailed"
    >,
    private readonly projects: Pick<ProjectsRepository, "getStale">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async getActions(
    user: IPmoResolvedUserContext,
    options: IActionCenterOptions = {},
  ): Promise<IActionCenterResult> {
    const now = this.now();
    const employeeId = user.employee?.id;
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setHours(23, 59, 59, 999);
    const dueSoonEnd = new Date(endToday);
    dueSoonEnd.setDate(dueSoonEnd.getDate() + (options.dueSoonDays ?? 7));

    const [assigned, reviews, qaWorkItems, assignedQuality, pendingApprovals] =
      await Promise.all([
        employeeId
          ? this.loadAll((continuation) =>
              this.workItems.getAssignedTo(employeeId, continuation),
            )
          : Promise.resolve([] as IPmoWorkItem[]),
        this.loadAll((continuation) =>
          this.workItems.getReviewQueueForUser(
            user.sharePointUserId,
            continuation,
          ),
        ),
        this.loadAll((continuation) =>
          this.workItems.getQaQueueForUser(user.sharePointUserId, continuation),
        ),
        this.loadAll((continuation) =>
          this.qualityItems.getAssignedTo(user.sharePointUserId, continuation),
        ),
        this.loadAll((continuation) =>
          this.approvals.getPendingForApprover(
            user.sharePointUserId,
            continuation,
          ),
        ),
      ]);

    const [todayEntries, ownActions] = employeeId
      ? await Promise.all([
          this.loadAll((continuation) =>
            this.timeEntries.getEmployeeRange(
              employeeId,
              startToday,
              endToday,
              continuation,
            ),
          ),
          this.loadAll((continuation) =>
            this.taskActions.getForRequestor(
              user.sharePointUserId,
              continuation,
            ),
          ),
        ])
      : [[], []];

    const failedTaskActions = hasCapability(user, "support.failed-actions")
      ? await this.loadAll((continuation) =>
          this.taskActions.getFailed(continuation),
        )
      : ownActions.filter((action) => action.processingStatus === "Failed");

    const staleBefore = new Date(
      now.valueOf() - (options.metricStaleAfterHours ?? 24) * 3_600_000,
    );
    const staleMetrics =
      hasCapability(user, "projects.manage") ||
      hasCapability(user, "portfolio.view")
        ? await this.loadAll((continuation) =>
            this.projects.getStale(staleBefore, continuation),
          )
        : [];

    const actionable = assigned.filter(
      (item) => item.status !== "Cancelled" && item.status !== "Accepted",
    );
    const awaitingAcceptance = actionable.filter(
      (item) => item.status === "Assigned",
    );
    const overdue = actionable.filter(
      (item) => item.plannedEnd !== undefined && item.plannedEnd < startToday,
    );
    const dueSoon = actionable.filter(
      (item) =>
        item.plannedEnd !== undefined &&
        item.plannedEnd >= startToday &&
        item.plannedEnd <= dueSoonEnd,
    );
    const blocked = actionable.filter((item) => item.status === "Blocked");
    const returnedTime = todayEntries.filter(
      (entry) => entry.entryStatus === "Returned",
    );
    const returnedWork = ownActions.filter(
      (action) => action.processingStatus === "Rejected",
    );
    const recordedHours = todayEntries
      .filter((entry) => entry.entryStatus !== "Returned")
      .reduce((total, entry) => total + entry.hours, 0);
    const requiredHours = user.employee
      ? calculateRequiredDailyHours({
          standardHoursPerDay: user.employee.standardHoursPerDay,
          capacityPercent: user.employee.capacityPercent,
          isWorkingDay: options.isWorkingDay ?? true,
          approvedLeaveHours: options.approvedLeaveHours,
        })
      : 0;
    const incompleteWorkday =
      requiredHours > recordedHours
        ? {
            workDate: startToday,
            requiredHours,
            recordedHours,
            missingHours: requiredHours - recordedHours,
          }
        : undefined;
    const qaWork: readonly (IPmoWorkItem | IPmoQualityItem)[] = [
      ...qaWorkItems,
      ...assignedQuality,
    ];
    return {
      counts: {
        awaitingAcceptance: awaitingAcceptance.length,
        dueSoon: dueSoon.length,
        overdue: overdue.length,
        blocked: blocked.length,
        reviewsAndQa: reviews.length + qaWork.length,
        pendingApprovals: pendingApprovals.length,
        returned: returnedTime.length + returnedWork.length,
        incompleteWorkday: incompleteWorkday ? 1 : 0,
        failedTaskActions: failedTaskActions.length,
        staleMetrics: staleMetrics.length,
      },
      awaitingAcceptance,
      dueSoon,
      overdue,
      blocked,
      reviews,
      qaWork,
      pendingApprovals,
      returnedTime,
      returnedWork,
      incompleteWorkday,
      failedTaskActions,
      staleMetrics,
    };
  }

  private async loadAll<T>(
    getPage: (continuation?: string) => Promise<{
      readonly items: readonly T[];
      readonly continuation?: string;
    }>,
  ): Promise<T[]> {
    const values: T[] = [];
    let continuation: string | undefined;
    do {
      const page = await getPage(continuation);
      values.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    return values;
  }
}

/** Resolves the signed-in actor once and exposes the Stage 04 service to React. */
export class CurrentUserActionCenterService {
  public constructor(
    private readonly actions: ActionCenterService,
    private readonly capabilities: UserCapabilityService,
  ) {}

  public async getActions(
    options: IActionCenterOptions = {},
  ): Promise<IActionCenterResult> {
    return this.actions.getActions(
      await this.capabilities.resolveCurrent(),
      options,
    );
  }
}
