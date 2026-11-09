import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type {
  IPmoLearningAssignment,
  IPmoProjectMember,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../../models/domain";
import type {
  LearningAssignmentsRepository,
  ProjectMembersRepository,
  TimeEntriesRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import {
  calculateRequiredDailyHours,
  hasExcessDailyHours,
  validateTimeEntry,
} from "./DomainRules";
import { PmoBusinessError } from "./ConfigurationManagementService";
import type { ConfigurationManagementService } from "./ConfigurationManagementService";
import type { UserCapabilityService } from "./UserCapabilityService";

export interface ITimeEntryDraft {
  readonly workDate: string;
  readonly projectId?: number;
  readonly projectCode?: string;
  readonly workItemId?: number;
  readonly workCategory: IPmoTimeEntry["workCategory"];
  readonly hours: number;
  readonly workPerformed: string;
  readonly progressPercent?: number;
  readonly blockerSummary?: string;
  readonly isBillable: boolean;
  readonly correctionReason?: string;
}

export interface ITimeDashboard {
  readonly workDate: Date;
  readonly requiredHours: number;
  readonly recordedHours: number;
  readonly missingHours: number;
  readonly currentWeekHours: number;
  readonly returnedEntries: readonly IPmoTimeEntry[];
  readonly lockedEntries: readonly IPmoTimeEntry[];
  readonly entries: readonly IPmoTimeEntry[];
  readonly weekEntries: readonly IPmoTimeEntry[];
}

export interface ITimePolicy {
  readonly maximumDailyHours: number;
  readonly allowOvertime: boolean;
  readonly approvalEnabled: boolean;
  readonly leaveReducesRequiredHours: boolean;
}

const dateOnly = (value: string): Date => new Date(`${value}T00:00:00`);
const dayStart = (value: Date): Date => {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
};
const dayEnd = (value: Date): Date => {
  const day = dayStart(value);
  day.setHours(23, 59, 59, 999);
  return day;
};
const weekStart = (value: Date): Date => {
  const start = dayStart(value);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};
const all = async <T>(
  page: (continuation?: string) => Promise<{
    readonly items: readonly T[];
    readonly continuation?: string;
  }>,
): Promise<T[]> => {
  const values: T[] = [];
  let continuation: string | undefined;
  do {
    const result = await page(continuation);
    values.push(...result.items);
    continuation = result.continuation;
  } while (continuation);
  return values;
};

/** Own-time mutations and manager decisions. UI components only consume this service. */
export class TimeManagementService {
  public constructor(
    private readonly entries: TimeEntriesRepository,
    private readonly workItems: WorkItemsRepository,
    private readonly members: ProjectMembersRepository,
    private readonly learning: LearningAssignmentsRepository,
    private readonly settings: ConfigurationManagementService,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async policy(): Promise<ITimePolicy> {
    const values = await this.settings.cache.getActive();
    const value = (key: string): string | undefined =>
      values.find((setting) => setting.key === key)?.value;
    const number = (key: string, fallback: number): number => {
      const parsed = Number(value(key));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };
    const enabled = (key: string, fallback: boolean): boolean => {
      const raw = value(key)?.trim().toLowerCase();
      return raw === undefined
        ? fallback
        : ["true", "1", "yes"].indexOf(raw) >= 0;
    };
    return {
      maximumDailyHours: number("MaximumDailyHours", 24),
      allowOvertime: enabled("AllowOvertime", true),
      approvalEnabled: enabled("TimeApprovalEnabled", false),
      leaveReducesRequiredHours: enabled("LeaveReducesRequiredHours", true),
    };
  }

  public async dashboard(date = this.now()): Promise<ITimeDashboard> {
    const actor = await this.requireEmployee();
    const day = dayStart(date);
    const [today, week, policy] = await Promise.all([
      all((continuation) =>
        this.entries.getEmployeeRange(actor.id, day, dayEnd(day), continuation),
      ),
      all((continuation) =>
        this.entries.getEmployeeRange(
          actor.id,
          weekStart(day),
          dayEnd(new Date(day.valueOf() + 6 * 86400000)),
          continuation,
        ),
      ),
      this.policy(),
    ]);
    const active = today.filter((entry) => entry.entryStatus !== "Returned");
    const leave = policy.leaveReducesRequiredHours
      ? active
          .filter((entry) => entry.workCategory === "Leave")
          .reduce((sum, entry) => sum + entry.hours, 0)
      : 0;
    const requiredHours = calculateRequiredDailyHours({
      standardHoursPerDay: actor.standardHoursPerDay,
      capacityPercent: actor.capacityPercent,
      isWorkingDay: day.getDay() !== 0 && day.getDay() !== 6,
      approvedLeaveHours: leave,
    });
    const recordedHours = active.reduce((sum, entry) => sum + entry.hours, 0);
    return {
      workDate: day,
      requiredHours,
      recordedHours,
      missingHours: Math.max(0, requiredHours - recordedHours),
      currentWeekHours: week
        .filter((entry) => entry.entryStatus !== "Returned")
        .reduce((sum, entry) => sum + entry.hours, 0),
      returnedEntries: week.filter((entry) => entry.entryStatus === "Returned"),
      lockedEntries: week.filter(
        (entry) => entry.isLocked || entry.entryStatus === "Locked",
      ),
      entries: today,
      weekEntries: week,
    };
  }

  public async eligibleWork(date = this.now()): Promise<{
    readonly workItems: readonly IPmoWorkItem[];
    readonly memberships: readonly IPmoProjectMember[];
    readonly learningAssignments: readonly IPmoLearningAssignment[];
  }> {
    const actor = await this.requireEmployee();
    const [workItems, memberships, learningAssignments] = await Promise.all([
      all((continuation) =>
        this.workItems.getAssignedTo(actor.id, continuation),
      ),
      all((continuation) =>
        this.members.getActiveForEmployee(actor.id, continuation),
      ),
      all((continuation) =>
        this.learning.getActiveForEmployee(actor.id, date, continuation),
      ),
    ]);
    return {
      workItems: workItems.filter(
        (item) => item.isActive && item.status !== "Cancelled",
      ),
      memberships: memberships.filter(
        (member) =>
          member.membershipStatus === "Active" &&
          member.allocationStart <= date &&
          member.allocationEnd >= date,
      ),
      learningAssignments,
    };
  }

  public async save(
    draft: ITimeEntryDraft,
    existing?: IPmoTimeEntry,
  ): Promise<{ entry: IPmoTimeEntry; warnings: readonly string[] }> {
    const actor = await this.requireEmployee();
    const date = dateOnly(draft.workDate);
    const [dayEntries, policy, eligible] = await Promise.all([
      all((continuation) =>
        this.entries.getEmployeeRange(
          actor.id,
          date,
          dayEnd(date),
          continuation,
        ),
      ),
      this.policy(),
      this.eligibleWork(date),
    ]);
    if (
      existing &&
      (existing.employeeId !== actor.id ||
        existing.isLocked ||
        existing.entryStatus === "Locked")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "Only your unlocked time entries can be changed.",
      );
    }
    const dayHours = dayEntries
      .filter(
        (entry) =>
          entry.id !== existing?.id && entry.entryStatus !== "Returned",
      )
      .reduce((sum, entry) => sum + entry.hours, 0);
    const authorizedProject =
      draft.projectId === undefined ||
      eligible.memberships.some(
        (member) => member.projectId === draft.projectId,
      );
    const item =
      draft.workItemId === undefined
        ? undefined
        : eligible.workItems.find(
            (candidate) =>
              candidate.id === draft.workItemId &&
              candidate.projectId === draft.projectId,
          );
    const errors = [
      ...validateTimeEntry(
        { ...draft, workDate: date, isLocked: Boolean(existing?.isLocked) },
        {
          now: this.now(),
          maximumDailyHours: policy.maximumDailyHours,
          existingDayHours: dayHours,
          isAuthorizedContributor:
            authorizedProject &&
            (draft.workCategory !== "Project Task" || item !== undefined),
          allowOvertime: policy.allowOvertime,
        },
      ),
    ];
    if (
      draft.workCategory === "Approved Learning" &&
      !eligible.learningAssignments.length
    ) {
      errors.push(
        "Approved learning time needs an active learning assignment.",
      );
    }
    if (
      existing?.entryStatus === "Returned" &&
      !draft.correctionReason?.trim()
    ) {
      errors.push("A correction reason is required for a returned entry.");
    }
    if (errors.length)
      throw new PmoBusinessError(
        "validation",
        errors[0] ?? "Invalid time entry.",
      );
    const values = this.valuesFor(
      draft,
      existing?.entryStatus === "Returned"
        ? "Draft"
        : (existing?.entryStatus ?? "Draft"),
    );
    const saved = existing
      ? await this.entries.update(existing.id, values, existing.etag)
      : await this.entries.create({
          ...values,
          [F.timeEntries.EmployeeId]: actor.id,
          [`${F.timeEntries.EmployeeUser}Id`]: actor.user.id,
        });
    const finalized = !existing
      ? await this.entries.update(
          saved.id,
          { [F.timeEntries.Title]: `Time entry ${saved.id}` },
          saved.etag,
        )
      : saved;
    return {
      entry: finalized,
      warnings: hasExcessDailyHours(
        dayHours,
        draft.hours,
        policy.maximumDailyHours,
      )
        ? [
            "Daily total exceeds the normal maximum; approved overtime remains allowed.",
          ]
        : [],
    };
  }

  public async submitDay(date: Date): Promise<readonly IPmoTimeEntry[]> {
    const actor = await this.requireEmployee();
    const dashboard = await this.dashboard(date);
    if (dashboard.missingHours > 0)
      throw new PmoBusinessError(
        "validation",
        `${dashboard.missingHours} required hour(s) are still unaccounted for.`,
      );
    const mutable = dashboard.entries.filter(
      (entry) => !entry.isLocked && entry.entryStatus !== "Locked",
    );
    if (!mutable.length)
      throw new PmoBusinessError(
        "validation",
        "There are no unlocked entries to submit.",
      );
    return Promise.all(
      mutable.map((entry) =>
        this.entries.update(
          entry.id,
          {
            [F.timeEntries.EntryStatus]: "Submitted",
            [F.timeEntries.SubmittedOn]: this.now().toISOString(),
            [F.timeEntries.EmployeeId]: actor.id,
          },
          entry.etag,
        ),
      ),
    );
  }

  public async reviewEntries(
    projectId: number,
    start: Date,
    end: Date,
  ): Promise<readonly IPmoTimeEntry[]> {
    const actor = await this.capabilities.resolveCurrent();
    if (
      !(await this.canReviewProject(
        actor.sharePointUserId,
        projectId,
        actor.securityRoles.has("timeApprover") ||
          actor.securityRoles.has("owner"),
      ))
    ) {
      throw new PmoBusinessError(
        "authorization",
        "You do not have access to this project's time entries.",
      );
    }
    return all((continuation) =>
      this.entries.getProjectRange(projectId, start, end, continuation),
    );
  }

  public async review(
    entry: IPmoTimeEntry,
    action: "Approve" | "Return" | "Lock" | "Reopen",
    reason?: string,
  ): Promise<IPmoTimeEntry> {
    const actor = await this.capabilities.resolveCurrent();
    const policy = await this.policy();
    const privileged = await this.canReviewProject(
      actor.sharePointUserId,
      entry.projectId,
      actor.securityRoles.has("timeApprover") ||
        actor.securityRoles.has("owner"),
    );
    if (
      !privileged ||
      (!policy.approvalEnabled && action !== "Lock" && action !== "Reopen")
    )
      throw new PmoBusinessError(
        "authorization",
        "Time review is not enabled for your role or policy.",
      );
    if ((action === "Return" || action === "Reopen") && !reason?.trim())
      throw new PmoBusinessError("validation", "A reason is required.");
    const person = {
      id: actor.sharePointUserId,
      displayName: actor.displayName,
      email: actor.email,
      loginName: actor.loginName,
    };
    const values =
      action === "Approve"
        ? {
            [F.timeEntries.EntryStatus]: "Approved",
            [`${F.timeEntries.ApprovedBy}Id`]: person.id,
            [F.timeEntries.ApprovedOn]: this.now().toISOString(),
          }
        : action === "Return"
          ? {
              [F.timeEntries.EntryStatus]: "Returned",
              [F.timeEntries.CorrectionReason]: reason!.trim(),
            }
          : action === "Lock"
            ? {
                [F.timeEntries.EntryStatus]: "Locked",
                [F.timeEntries.IsLocked]: true,
              }
            : {
                [F.timeEntries.EntryStatus]: "Returned",
                [F.timeEntries.IsLocked]: false,
                [F.timeEntries.CorrectionReason]: reason!.trim(),
              };
    return this.entries.update(entry.id, values, entry.etag);
  }

  private valuesFor(
    draft: ITimeEntryDraft,
    status: IPmoTimeEntry["entryStatus"],
  ) {
    return {
      [F.timeEntries.WorkDate]: dateOnly(draft.workDate).toISOString(),
      [F.timeEntries.ProjectId]: draft.projectId ?? null,
      [F.timeEntries.ProjectCode]: draft.projectCode ?? null,
      [F.timeEntries.WorkItemId]: draft.workItemId ?? null,
      [F.timeEntries.WorkCategory]: draft.workCategory,
      [F.timeEntries.Hours]: draft.hours,
      [F.timeEntries.WorkPerformed]: draft.workPerformed.trim(),
      [F.timeEntries.ProgressPercent]: draft.progressPercent ?? null,
      [F.timeEntries.BlockerSummary]: draft.blockerSummary?.trim() || null,
      [F.timeEntries.EntryStatus]: status,
      [F.timeEntries.CorrectionReason]: draft.correctionReason?.trim() || null,
      [F.timeEntries.IsBillable]: draft.isBillable,
      [F.timeEntries.IsLocked]: false,
    };
  }

  private async requireEmployee() {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.employee || !actor.capabilities.has("time.edit-own"))
      throw new PmoBusinessError(
        "authorization",
        "An active employee profile is required to manage time.",
      );
    return actor.employee;
  }

  private async canReviewProject(
    sharePointUserId: number,
    projectId: number | undefined,
    privileged: boolean,
  ): Promise<boolean> {
    if (privileged) return true;
    if (!projectId) return false;
    const memberships = await all((continuation) =>
      this.members.getActiveByProject(projectId, continuation),
    );
    return memberships.some(
      (member) =>
        member.employeeUser.id === sharePointUserId &&
        member.projectRole === "Project Manager" &&
        member.membershipStatus === "Active",
    );
  }
}
