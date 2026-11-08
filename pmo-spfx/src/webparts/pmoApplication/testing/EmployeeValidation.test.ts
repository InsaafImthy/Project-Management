import {
  getEmployeeActionVisibility,
  isEmployeeAssignmentEligible,
  validateEmployeeDraft,
} from "../validation/employees";

const validDraft = {
  name: "Aisha Noor",
  employeeNumber: "EMP-100",
  user: { id: 15, displayName: "Aisha Noor", email: "aisha@example.com" },
  email: "aisha@example.com",
  department: "Delivery",
  employmentStatus: "Active" as const,
  standardHoursPerDay: 8,
  capacityPercent: 100,
  isProjectManager: true,
  isQa: false,
  isApprover: false,
  isResourceManager: false,
  isActive: true,
};

describe("Employee validation and action rules", () => {
  it("accepts capacity boundaries and rejects out-of-range values", () => {
    expect(
      validateEmployeeDraft({ ...validDraft, capacityPercent: 0 }, 8),
    ).toEqual({});
    expect(
      validateEmployeeDraft({ ...validDraft, capacityPercent: 100 }, 8),
    ).toEqual({});
    expect(
      validateEmployeeDraft({ ...validDraft, capacityPercent: 101 }, 8)
        .capacityPercent,
    ).toMatch(/between 0 and 100/);
  });

  it("enforces positive standard hours and the configured daily maximum", () => {
    expect(
      validateEmployeeDraft({ ...validDraft, standardHoursPerDay: 0 }, 8)
        .standardHoursPerDay,
    ).toBeDefined();
    expect(
      validateEmployeeDraft({ ...validDraft, standardHoursPerDay: 8.01 }, 8)
        .standardHoursPerDay,
    ).toMatch(/no more than 8/);
    expect(validateEmployeeDraft(validDraft, 8)).toEqual({});
  });

  it("prevents inactive employees from being assignment eligible", () => {
    expect(
      isEmployeeAssignmentEligible({
        isActive: true,
        employmentStatus: "Active",
      }),
    ).toBe(true);
    expect(
      isEmployeeAssignmentEligible({
        isActive: false,
        employmentStatus: "Inactive",
      }),
    ).toBe(false);
    expect(
      isEmployeeAssignmentEligible({
        isActive: true,
        employmentStatus: "On Leave",
      }),
    ).toBe(false);
  });

  it("does not expose management actions without capability or on My Profile", () => {
    expect(getEmployeeActionVisibility([]).canEdit).toBe(false);
    expect(getEmployeeActionVisibility(["employees.manage"]).canSetActive).toBe(
      true,
    );
    expect(getEmployeeActionVisibility(["employees.manage"], true)).toEqual({
      canCreate: false,
      canEdit: false,
      canSetActive: false,
    });
  });
});
