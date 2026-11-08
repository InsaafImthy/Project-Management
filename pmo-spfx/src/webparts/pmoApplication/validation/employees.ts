import type { IPmoEmployee, IPmoPerson } from "../models/domain";

export interface IPmoEmployeeDraft {
  readonly name: string;
  readonly employeeNumber: string;
  readonly user?: IPmoPerson;
  readonly email: string;
  readonly department: string;
  readonly jobTitle?: string;
  readonly manager?: IPmoPerson;
  readonly location?: string;
  readonly employmentStatus: IPmoEmployee["employmentStatus"];
  readonly employmentStartDate?: string;
  readonly employmentEndDate?: string;
  readonly standardHoursPerDay?: number;
  readonly capacityPercent?: number;
  readonly skillsSummary?: string;
  readonly isProjectManager: boolean;
  readonly isQa: boolean;
  readonly isApprover: boolean;
  readonly isResourceManager: boolean;
  readonly isActive: boolean;
}

export const isEmployeeAssignmentEligible = (
  employee: Pick<IPmoEmployee, "isActive" | "employmentStatus">,
): boolean => employee.isActive && employee.employmentStatus === "Active";

export const getEmployeeActionVisibility = (
  capabilities: readonly string[],
  readOnlyProfile = false,
): {
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canSetActive: boolean;
} => {
  const canManage =
    !readOnlyProfile && capabilities.indexOf("employees.manage") >= 0;
  return {
    canCreate: canManage,
    canEdit: canManage,
    canSetActive: canManage,
  };
};

export const validateEmployeeDraft = (
  draft: IPmoEmployeeDraft,
  maximumDailyHours = 24,
): Readonly<Record<string, string>> => {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = "Employee name is required.";
  if (!draft.employeeNumber.trim()) {
    errors.employeeNumber = "Employee number is required.";
  }
  if (!draft.user) errors.user = "Microsoft 365 user is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!draft.department.trim()) errors.department = "Department is required.";
  if (
    draft.capacityPercent === undefined ||
    draft.capacityPercent < 0 ||
    draft.capacityPercent > 100
  ) {
    errors.capacityPercent = "Capacity must be between 0 and 100 percent.";
  }
  if (
    draft.standardHoursPerDay === undefined ||
    draft.standardHoursPerDay <= 0 ||
    draft.standardHoursPerDay > maximumDailyHours
  ) {
    errors.standardHoursPerDay = `Standard hours must be greater than 0 and no more than ${maximumDailyHours}.`;
  }
  if (
    draft.employmentStartDate &&
    draft.employmentEndDate &&
    draft.employmentEndDate < draft.employmentStartDate
  ) {
    errors.employmentEndDate = "End date cannot be earlier than start date.";
  }
  if (!draft.isActive && draft.employmentStatus !== "Inactive") {
    errors.employmentStatus =
      "A deactivated employee must have Inactive status.";
  }
  return errors;
};
