import type {
  IPmoChangeRequest,
  IPmoQualityItem,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../../models/domain";

export type ProjectStatus =
  | "Draft"
  | "Pending Baseline Approval"
  | "Approved"
  | "Active"
  | "On Hold"
  | "Pending Closure"
  | "Closed"
  | "Cancelled";
export type WorkItemStatus = IPmoWorkItem["status"];
export type TaskActionType =
  | "Accept"
  | "Return"
  | "Start"
  | "Progress Update"
  | "Block"
  | "Unblock"
  | "Submit for Review"
  | "Comment"
  | "Reopen Request";
export type ApprovalStatus =
  | "Submitted"
  | "In Progress"
  | "Clarification Requested"
  | "Approved"
  | "Conditionally Approved"
  | "Rejected"
  | "Cancelled"
  | "Expired";
export type ApprovalDecision =
  | "Approve"
  | "Conditionally Approve"
  | "Reject"
  | "Request Clarification";
export type QualityStatus = IPmoQualityItem["status"];

const PROJECT_TRANSITIONS: Readonly<
  Record<ProjectStatus, readonly ProjectStatus[]>
> = {
  Draft: ["Pending Baseline Approval", "Cancelled"],
  "Pending Baseline Approval": ["Draft", "Approved", "Cancelled"],
  Approved: ["Active", "Cancelled"],
  Active: ["On Hold", "Pending Closure", "Cancelled"],
  "On Hold": ["Active", "Pending Closure", "Cancelled"],
  "Pending Closure": ["Active", "Closed"],
  Closed: [],
  Cancelled: [],
};

const WORK_ITEM_TRANSITIONS: Readonly<
  Record<WorkItemStatus, readonly WorkItemStatus[]>
> = {
  Draft: ["Assigned", "Ready", "Cancelled"],
  Assigned: ["Accepted", "Cancelled"],
  Accepted: ["In Progress", "Cancelled"],
  Ready: ["In Progress", "Cancelled"],
  "In Progress": ["Blocked", "Submitted for Review", "On Hold", "Cancelled"],
  Blocked: ["In Progress", "On Hold", "Cancelled"],
  "Submitted for Review": ["In Review", "In Progress"],
  "In Review": ["Submitted to QA", "Accepted", "In Progress"],
  "Submitted to QA": ["QA In Progress", "In Progress"],
  "QA In Progress": ["Accepted", "In Progress"],
  "On Hold": ["Ready", "In Progress", "Cancelled"],
  Cancelled: [],
};

export const canTransitionProjectStatus = (
  from: ProjectStatus,
  to: ProjectStatus,
): boolean => PROJECT_TRANSITIONS[from].indexOf(to) >= 0;

export const assertProjectStatusTransition = (
  from: ProjectStatus,
  to: ProjectStatus,
): void => {
  if (!canTransitionProjectStatus(from, to)) {
    throw new Error(`Project cannot transition from ${from} to ${to}.`);
  }
};

export const canTransitionWorkItemStatus = (
  from: WorkItemStatus,
  to: WorkItemStatus,
): boolean => WORK_ITEM_TRANSITIONS[from].indexOf(to) >= 0;

export const assertWorkItemStatusTransition = (
  from: WorkItemStatus,
  to: WorkItemStatus,
): void => {
  if (!canTransitionWorkItemStatus(from, to)) {
    throw new Error(`Work item cannot transition from ${from} to ${to}.`);
  }
};

export interface ITaskActionActor {
  readonly employeeId?: number;
  readonly sharePointUserId: number;
  readonly isProjectManager: boolean;
  readonly isQa: boolean;
  readonly isOwner: boolean;
}

export interface ITaskActionInput {
  readonly actionType: TaskActionType;
  readonly comment?: string;
  readonly progressPercent?: number;
  readonly remainingEffortHours?: number;
}

const actionAllowedStatuses: Readonly<
  Record<TaskActionType, readonly WorkItemStatus[]>
> = {
  Accept: ["Assigned"],
  Return: ["Assigned"],
  Start: ["Accepted", "Ready"],
  "Progress Update": ["In Progress", "Blocked"],
  Block: ["In Progress"],
  Unblock: ["Blocked"],
  "Submit for Review": ["In Progress"],
  Comment: [
    "Draft",
    "Assigned",
    "Accepted",
    "Ready",
    "In Progress",
    "Blocked",
    "Submitted for Review",
    "In Review",
    "Submitted to QA",
    "QA In Progress",
    "On Hold",
  ],
  "Reopen Request": ["Submitted for Review", "In Review", "Accepted"],
};

export const validateTaskActionEligibility = (
  actor: ITaskActionActor,
  workItem: IPmoWorkItem,
  input: ITaskActionInput,
): readonly string[] => {
  const errors: string[] = [];
  const assigned =
    actor.employeeId !== undefined &&
    actor.employeeId === workItem.assignedEmployeeId;
  const reviewer = workItem.reviewer?.id === actor.sharePointUserId;
  const qaOwner = workItem.qaOwner?.id === actor.sharePointUserId;
  const manager = actor.isProjectManager || actor.isOwner;
  if (!assigned && !reviewer && !qaOwner && !manager) {
    errors.push("Actor is not assigned or authorized for this work item.");
  }
  if (actionAllowedStatuses[input.actionType].indexOf(workItem.status) < 0) {
    errors.push(
      `${input.actionType} is not available while the work item is ${workItem.status}.`,
    );
  }
  if (
    [
      "Accept",
      "Return",
      "Start",
      "Progress Update",
      "Block",
      "Unblock",
      "Submit for Review",
    ].indexOf(input.actionType) >= 0 &&
    !assigned &&
    !manager
  ) {
    errors.push(
      "Only the assignee or an authorized manager may apply this action.",
    );
  }
  if (
    ["Return", "Block", "Submit for Review", "Reopen Request"].indexOf(
      input.actionType,
    ) >= 0 &&
    !input.comment?.trim()
  ) {
    errors.push(`${input.actionType} requires a comment.`);
  }
  if (input.actionType === "Progress Update") {
    if (
      input.progressPercent === undefined ||
      input.progressPercent < 0 ||
      input.progressPercent > 100
    ) {
      errors.push("Progress percent must be between 0 and 100.");
    }
    if (
      input.remainingEffortHours === undefined ||
      input.remainingEffortHours < 0
    ) {
      errors.push("Remaining effort must be zero or greater.");
    }
  }
  return errors;
};

export const targetStatusForTaskAction = (
  action: TaskActionType,
): WorkItemStatus | undefined => {
  const targets: Readonly<Partial<Record<TaskActionType, WorkItemStatus>>> = {
    Accept: "Accepted",
    Start: "In Progress",
    Block: "Blocked",
    Unblock: "In Progress",
    "Submit for Review": "Submitted for Review",
  };
  return targets[action];
};

const APPROVAL_TRANSITIONS: Readonly<
  Record<ApprovalStatus, readonly ApprovalStatus[]>
> = {
  Submitted: [
    "In Progress",
    "Clarification Requested",
    "Approved",
    "Conditionally Approved",
    "Rejected",
    "Cancelled",
    "Expired",
  ],
  "In Progress": [
    "Clarification Requested",
    "Approved",
    "Conditionally Approved",
    "Rejected",
    "Cancelled",
    "Expired",
  ],
  "Clarification Requested": ["In Progress", "Cancelled", "Expired"],
  Approved: [],
  "Conditionally Approved": [],
  Rejected: [],
  Cancelled: [],
  Expired: [],
};

export const approvalStatusForDecision = (
  decision: ApprovalDecision,
): ApprovalStatus => {
  switch (decision) {
    case "Approve":
      return "Approved";
    case "Conditionally Approve":
      return "Conditionally Approved";
    case "Reject":
      return "Rejected";
    case "Request Clarification":
      return "Clarification Requested";
  }
};

export const assertApprovalTransition = (
  from: ApprovalStatus,
  to: ApprovalStatus,
): void => {
  if (APPROVAL_TRANSITIONS[from].indexOf(to) < 0) {
    throw new Error(`Approval cannot transition from ${from} to ${to}.`);
  }
};

export const validateChangeRequest = (
  request: Pick<
    IPmoChangeRequest,
    | "requestType"
    | "workItemId"
    | "currentEffortHours"
    | "additionalHoursRequested"
    | "proposedEffortHours"
    | "proposedDate"
    | "impactSummary"
    | "mitigationPlan"
    | "reasonDetails"
  >,
): readonly string[] => {
  const errors: string[] = [];
  if (!request.reasonDetails.trim())
    errors.push("Reason details are required.");
  if (!request.impactSummary.trim()) errors.push("Impact summary is required.");
  if (
    request.requestType !== "Project Variation" &&
    request.workItemId === undefined
  ) {
    errors.push("Task-level requests require a work item.");
  }
  if (request.requestType === "Additional Effort") {
    if (request.currentEffortHours === undefined)
      errors.push("Current effort is required.");
    if (
      request.additionalHoursRequested === undefined ||
      request.additionalHoursRequested <= 0
    )
      errors.push("Additional hours must be greater than zero.");
    if (request.proposedEffortHours === undefined)
      errors.push("Proposed effort is required.");
    if (
      request.currentEffortHours !== undefined &&
      request.additionalHoursRequested !== undefined &&
      request.proposedEffortHours !== undefined &&
      request.proposedEffortHours !==
        request.currentEffortHours + request.additionalHoursRequested
    )
      errors.push("Proposed effort must equal current plus additional hours.");
  }
  if (request.requestType === "Due Date Change" && !request.proposedDate) {
    errors.push("A proposed date is required.");
  }
  if (
    request.requestType === "Project Variation" &&
    !request.mitigationPlan?.trim()
  ) {
    errors.push("Project variations require a mitigation plan.");
  }
  return errors;
};

const QUALITY_TRANSITIONS: Readonly<
  Record<QualityStatus, readonly QualityStatus[]>
> = {
  New: ["In Review", "Assigned", "Rejected"],
  "In Review": ["Assigned", "Passed", "Deferred", "Rejected"],
  Assigned: ["In Fix", "Deferred", "Rejected"],
  "In Fix": ["Ready for Retest", "Deferred"],
  "Ready for Retest": ["Passed", "Retest Failed"],
  "Retest Failed": ["Assigned", "In Fix", "Deferred"],
  Passed: ["Closed"],
  Closed: [],
  Deferred: ["Assigned", "In Review", "Approved Exception"],
  Rejected: [],
  "Approved Exception": ["Closed"],
};

export const validateQualityTransition = (
  item: Pick<
    IPmoQualityItem,
    | "qualityType"
    | "status"
    | "workItemId"
    | "testResult"
    | "severity"
    | "assignedTo"
    | "customerImpact"
    | "approvalRequestId"
  >,
  target: QualityStatus,
): readonly string[] => {
  const errors: string[] = [];
  if (QUALITY_TRANSITIONS[item.status].indexOf(target) < 0) {
    errors.push(
      `Quality item cannot transition from ${item.status} to ${target}.`,
    );
  }
  if (
    item.qualityType === "Test Result" &&
    (!item.workItemId || !item.testResult)
  ) {
    errors.push("Test results require a work item and result.");
  }
  if (
    item.qualityType === "Defect" &&
    target === "Assigned" &&
    (!item.severity || !item.assignedTo)
  ) {
    errors.push("Assigned defects require severity and assignee.");
  }
  if (
    item.qualityType === "Production Defect" &&
    !item.customerImpact?.trim()
  ) {
    errors.push("Production defects require customer impact.");
  }
  if (
    item.qualityType === "Release Exception" &&
    target === "Approved Exception" &&
    !item.approvalRequestId
  ) {
    errors.push("Approved exceptions require an approval request.");
  }
  return errors;
};

export interface IRequiredHoursInput {
  readonly standardHoursPerDay: number;
  readonly capacityPercent: number;
  readonly isWorkingDay: boolean;
  readonly approvedLeaveHours?: number;
}

export const calculateRequiredDailyHours = (
  input: IRequiredHoursInput,
): number => {
  if (!input.isWorkingDay) return 0;
  const capacityHours =
    Math.max(0, input.standardHoursPerDay) *
    (Math.min(100, Math.max(0, input.capacityPercent)) / 100);
  return Math.max(0, capacityHours - (input.approvedLeaveHours ?? 0));
};

export interface ITimeEntryValidationContext {
  readonly now: Date;
  readonly maximumDailyHours: number;
  readonly existingDayHours: number;
  readonly isAuthorizedContributor: boolean;
}

export const validateTimeEntry = (
  entry: Pick<
    IPmoTimeEntry,
    | "hours"
    | "workDate"
    | "workCategory"
    | "projectId"
    | "workItemId"
    | "workPerformed"
    | "isLocked"
  >,
  context: ITimeEntryValidationContext,
): readonly string[] => {
  const errors: string[] = [];
  if (entry.hours <= 0) errors.push("Hours must be greater than zero.");
  if (context.existingDayHours + entry.hours > context.maximumDailyHours) {
    errors.push("Daily hours exceed the configured maximum.");
  }
  const workDay = new Date(entry.workDate);
  workDay.setHours(0, 0, 0, 0);
  const today = new Date(context.now);
  today.setHours(0, 0, 0, 0);
  if (workDay > today) errors.push("Future time entries are not allowed.");
  if (!entry.workPerformed.trim()) errors.push("Work performed is required.");
  if (
    entry.workCategory === "Project Task" &&
    (!entry.projectId || !entry.workItemId)
  ) {
    errors.push("Project task time requires project and work item.");
  }
  if (entry.workCategory === "Project Support" && !entry.projectId) {
    errors.push("Project support time requires a project.");
  }
  if (
    (entry.workCategory === "Project Task" ||
      entry.workCategory === "Project Support") &&
    !context.isAuthorizedContributor
  ) {
    errors.push("Employee is not an authorized project contributor.");
  }
  if (entry.isLocked)
    errors.push("Locked time entries require a correction request.");
  return errors;
};

export interface IPlanMeasureSet {
  readonly baseline: number;
  readonly currentApproved: number;
  readonly actual: number;
  readonly forecast: number;
}

export const createPlanMeasureSet = (
  baseline: number,
  currentApproved: number,
  actual: number,
  forecast: number,
): IPlanMeasureSet => {
  const values = [baseline, currentApproved, actual, forecast];
  if (values.some((value) => value < 0 || !Number.isFinite(value))) {
    throw new Error("Plan measures must be finite and zero or greater.");
  }
  return { baseline, currentApproved, actual, forecast };
};

export const calculatePercentComplete = (
  items: readonly Pick<
    IPmoWorkItem,
    "approvedEffortHours" | "percentComplete"
  >[],
): number => {
  const weighted = items.filter((item) => (item.approvedEffortHours ?? 0) > 0);
  const totalWeight = weighted.reduce(
    (total, item) => total + (item.approvedEffortHours ?? 0),
    0,
  );
  if (totalWeight === 0) return 0;
  return (
    weighted.reduce(
      (total, item) =>
        total +
        (item.approvedEffortHours ?? 0) *
          Math.min(100, Math.max(0, item.percentComplete)),
      0,
    ) / totalWeight
  );
};

export const calculateEffortVariance = (
  forecastHours: number,
  approvedHours: number,
): number => forecastHours - approvedHours;

export const calculateScheduleVarianceDays = (
  forecastEnd: Date | undefined,
  currentApprovedEnd: Date,
): number | undefined =>
  forecastEnd
    ? Math.round(
        (forecastEnd.valueOf() - currentApprovedEnd.valueOf()) / 86_400_000,
      )
    : undefined;

export const calculateLaborCost = (
  hours: number,
  rate: number,
  rateType: "Hourly" | "Daily",
  personDayHours: number,
): number => {
  if (hours < 0 || rate < 0 || personDayHours <= 0) {
    throw new Error("Cost inputs are outside the permitted range.");
  }
  return rateType === "Hourly" ? hours * rate : (hours / personDayHours) * rate;
};

export interface IMarginResult {
  readonly amount: number;
  readonly percent?: number;
}

export const calculateMargin = (
  projectValue: number,
  forecastCost: number,
): IMarginResult => ({
  amount: projectValue - forecastCost,
  percent:
    projectValue === 0
      ? undefined
      : ((projectValue - forecastCost) / projectValue) * 100,
});

export type HealthLevel = "Green" | "Amber" | "Red" | "Not Set";
export interface IHealthDriver {
  readonly key: "schedule" | "effort" | "blocked" | "quality" | "data";
  readonly level: Exclude<HealthLevel, "Not Set">;
  readonly message: string;
}
export interface IProjectHealthResult {
  readonly health: HealthLevel;
  readonly drivers: readonly IHealthDriver[];
}
export interface IProjectHealthInput {
  readonly scheduleVarianceDays?: number;
  readonly effortVariancePercent?: number;
  readonly criticalBlockedCount: number;
  readonly criticalQualityCount: number;
  readonly hasIncompleteMetrics: boolean;
}

export const evaluateProjectHealth = (
  input: IProjectHealthInput,
): IProjectHealthResult => {
  const drivers: IHealthDriver[] = [];
  if (
    input.scheduleVarianceDays !== undefined &&
    input.scheduleVarianceDays > 0
  ) {
    drivers.push({
      key: "schedule",
      level: input.scheduleVarianceDays > 10 ? "Red" : "Amber",
      message: `Forecast is ${input.scheduleVarianceDays} day(s) late.`,
    });
  }
  if (
    input.effortVariancePercent !== undefined &&
    input.effortVariancePercent > 0
  ) {
    drivers.push({
      key: "effort",
      level: input.effortVariancePercent > 20 ? "Red" : "Amber",
      message: `Forecast effort is ${input.effortVariancePercent.toFixed(1)}% over approved effort.`,
    });
  }
  if (input.criticalBlockedCount > 0) {
    drivers.push({
      key: "blocked",
      level: "Red",
      message: `${input.criticalBlockedCount} critical work item(s) are blocked.`,
    });
  }
  if (input.criticalQualityCount > 0) {
    drivers.push({
      key: "quality",
      level: "Red",
      message: `${input.criticalQualityCount} critical quality item(s) are open.`,
    });
  }
  if (input.hasIncompleteMetrics) {
    drivers.push({
      key: "data",
      level: "Amber",
      message: "Project metrics are incomplete.",
    });
  }
  const health: HealthLevel = drivers.some((driver) => driver.level === "Red")
    ? "Red"
    : drivers.some((driver) => driver.level === "Amber")
      ? "Amber"
      : "Green";
  return { health, drivers };
};

export type CodeKind =
  | "Project"
  | "Work Item"
  | "Request"
  | "Approval"
  | "Risk"
  | "Quality"
  | "Learning"
  | "Cost"
  | "Import";

const CODE_PREFIX: Readonly<Record<CodeKind, string>> = {
  Project: "PRJ",
  "Work Item": "WIT",
  Request: "REQ",
  Approval: "APR",
  Risk: "RSK",
  Quality: "QLT",
  Learning: "LRN",
  Cost: "CST",
  Import: "IMP",
};

export const generateRecordCode = (
  kind: CodeKind,
  id: number,
  createdOn: Date,
): string => {
  if (!Number.isInteger(id) || id <= 0)
    throw new Error("A positive item ID is required.");
  const idPart = `00000${String(id)}`.slice(-5);
  return `${CODE_PREFIX[kind]}-${createdOn.getUTCFullYear()}-${idPart}`;
};
