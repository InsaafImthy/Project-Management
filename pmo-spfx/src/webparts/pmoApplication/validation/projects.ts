import type {
  IPmoEmployee,
  IPmoPerson,
  IPmoProject,
  IPmoProjectMember,
} from "../models/domain";

export interface IProjectDraft {
  readonly title: string;
  readonly projectType: IPmoProject["projectType"];
  readonly customerName?: string;
  readonly poReference?: string;
  readonly description: string;
  readonly scopeSummary: string;
  readonly exclusions?: string;
  readonly projectManager?: IPmoPerson;
  readonly sponsor?: IPmoPerson;
  readonly pmoOwner?: IPmoPerson;
  readonly priority: IPmoProject["priority"];
  readonly plannedStart: string;
  readonly baselineEnd: string;
  readonly baselineEffortHours?: number;
  readonly currencyCode: string;
  readonly confidentiality: IPmoProject["confidentiality"];
  readonly projectValue?: number;
  readonly baselineCostBudget?: number;
  readonly approvedCostBudget?: number;
}

export interface IProjectMemberDraft {
  readonly employee?: IPmoEmployee;
  readonly projectRole: IPmoProjectMember["projectRole"];
  readonly responsibility?: string;
  readonly allocationPercent?: number;
  readonly allocationStart: string;
  readonly allocationEnd: string;
}

const localDate = (value: string): Date | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? undefined : date;
};

export const validateProjectDraft = (
  draft: IProjectDraft,
): Readonly<Record<string, string>> => {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = "Project name is required.";
  if (!draft.description.trim())
    errors.description = "Project purpose is required.";
  if (!draft.scopeSummary.trim())
    errors.scopeSummary = "Scope summary is required.";
  if (!draft.projectManager)
    errors.projectManager = "Project manager is required.";
  if (!draft.pmoOwner) errors.pmoOwner = "PMO owner is required.";
  const start = localDate(draft.plannedStart);
  const end = localDate(draft.baselineEnd);
  if (!start) errors.plannedStart = "Planned start is required.";
  if (!end) errors.baselineEnd = "Baseline end is required.";
  if (start && end && end < start)
    errors.baselineEnd = "Baseline end cannot be earlier than planned start.";
  if (draft.baselineEffortHours === undefined || draft.baselineEffortHours < 0)
    errors.baselineEffortHours = "Baseline effort must be zero or greater.";
  if (!/^[A-Za-z]{3}$/.test(draft.currencyCode.trim()))
    errors.currencyCode = "Currency must be a three-letter code.";
  if (draft.projectValue !== undefined && draft.projectValue < 0)
    errors.projectValue = "Project value must be zero or greater.";
  if (draft.baselineCostBudget !== undefined && draft.baselineCostBudget < 0)
    errors.baselineCostBudget = "Baseline cost budget must be zero or greater.";
  if (draft.approvedCostBudget !== undefined && draft.approvedCostBudget < 0)
    errors.approvedCostBudget = "Approved cost budget must be zero or greater.";
  return errors;
};

export const validateProjectMemberDraft = (
  draft: IProjectMemberDraft,
  project: Pick<IPmoProject, "plannedStart" | "currentApprovedEnd">,
): Readonly<Record<string, string>> => {
  const errors: Record<string, string> = {};
  if (
    !draft.employee ||
    !draft.employee.isActive ||
    draft.employee.employmentStatus !== "Active"
  )
    errors.employee = "Select an active employee.";
  const start = localDate(draft.allocationStart);
  const end = localDate(draft.allocationEnd);
  if (!start) errors.allocationStart = "Allocation start is required.";
  if (!end) errors.allocationEnd = "Allocation end is required.";
  if (start && end && end < start)
    errors.allocationEnd =
      "Allocation end cannot be earlier than allocation start.";
  if (
    draft.allocationPercent === undefined ||
    draft.allocationPercent < 0 ||
    draft.allocationPercent > 100
  )
    errors.allocationPercent = "Allocation must be between 0 and 100 percent.";
  if (start && end && draft.employee) {
    if (
      draft.employee.employmentStartDate &&
      start < draft.employee.employmentStartDate
    )
      errors.allocationStart =
        "Allocation cannot start before employment starts.";
    if (
      draft.employee.employmentEndDate &&
      end > draft.employee.employmentEndDate
    )
      errors.allocationEnd = "Allocation cannot end after employment ends.";
    if (start < project.plannedStart || end > project.currentApprovedEnd)
      errors.allocationEnd =
        "Allocation must be within the current approved project period.";
  }
  return errors;
};

export const datesOverlap = (
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
): boolean => leftStart <= rightEnd && rightStart <= leftEnd;

export const calculateOverlappingAllocation = (
  memberships: readonly IPmoProjectMember[],
  employeeId: number,
  allocationStart: Date,
  allocationEnd: Date,
  ignoredMembershipId?: number,
): number =>
  memberships
    .filter(
      (member) =>
        member.id !== ignoredMembershipId &&
        member.isActive &&
        member.employeeId === employeeId &&
        datesOverlap(
          member.allocationStart,
          member.allocationEnd,
          allocationStart,
          allocationEnd,
        ),
    )
    .reduce((total, member) => total + member.allocationPercent, 0);
