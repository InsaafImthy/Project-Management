import {
  allocationForDate,
  appendValidatedSkill,
  calculateRequiredDailyHours,
  canTransitionLearningStatus,
  canViewEmployeeTime,
  hasExcessDailyHours,
  rangesOverlap,
  validateLearningValidation,
  validateTimeEntry,
} from "../services/domain/DomainRules";

describe("Stage 08 time, capacity, and learning rules", () => {
  const today = new Date("2026-11-09T10:00:00");
  const entry = {
    hours: 4,
    workDate: new Date("2026-11-09T00:00:00"),
    workCategory: "Project Task" as const,
    projectId: 4,
    workItemId: 9,
    workPerformed: "Implemented validated work.",
    isLocked: false,
  };

  it("calculates standard, non-working, and leave-reduced requirements", () => {
    expect(
      calculateRequiredDailyHours({
        standardHoursPerDay: 8,
        capacityPercent: 100,
        isWorkingDay: true,
      }),
    ).toBe(8);
    expect(
      calculateRequiredDailyHours({
        standardHoursPerDay: 8,
        capacityPercent: 100,
        isWorkingDay: false,
      }),
    ).toBe(0);
    expect(
      calculateRequiredDailyHours({
        standardHoursPerDay: 8,
        capacityPercent: 100,
        isWorkingDay: true,
        approvedLeaveHours: 3,
      }),
    ).toBe(5);
  });

  it("rejects future dates, missing task linkage, locked entries, and daily boundary breaches", () => {
    expect(
      validateTimeEntry(
        { ...entry, workDate: new Date("2026-11-10T00:00:00") },
        {
          now: today,
          maximumDailyHours: 8,
          existingDayHours: 0,
          isAuthorizedContributor: true,
        },
      ),
    ).toContain("Future time entries are not allowed.");
    expect(
      validateTimeEntry(
        { ...entry, projectId: undefined, workItemId: undefined },
        {
          now: today,
          maximumDailyHours: 8,
          existingDayHours: 0,
          isAuthorizedContributor: true,
        },
      ),
    ).toContain("Project task time requires project and work item.");
    expect(
      validateTimeEntry(
        { ...entry, isLocked: true },
        {
          now: today,
          maximumDailyHours: 8,
          existingDayHours: 0,
          isAuthorizedContributor: true,
        },
      ),
    ).toContain("Locked time entries require a correction request.");
    expect(
      validateTimeEntry(
        { ...entry, hours: 5 },
        {
          now: today,
          maximumDailyHours: 8,
          existingDayHours: 4,
          isAuthorizedContributor: true,
        },
      ),
    ).toContain("Daily hours exceed the configured maximum.");
  });

  it("warns rather than blocks configured overtime", () => {
    expect(hasExcessDailyHours(7, 2, 8)).toBe(true);
    expect(
      validateTimeEntry(
        { ...entry, hours: 2 },
        {
          now: today,
          maximumDailyHours: 8,
          existingDayHours: 7,
          isAuthorizedContributor: true,
          allowOvertime: true,
        },
      ),
    ).toEqual([]);
  });

  it("requires authorization for task time", () => {
    expect(
      validateTimeEntry(entry, {
        now: today,
        maximumDailyHours: 8,
        existingDayHours: 0,
        isAuthorizedContributor: false,
      }),
    ).toContain("Employee is not an authorized project contributor.");
  });

  it("calculates overlapping capacity and capacity breach", () => {
    const rows = [
      {
        allocationPercent: 60,
        allocationStart: new Date("2026-11-01"),
        allocationEnd: new Date("2026-11-30"),
        isActive: true,
        membershipStatus: "Active" as const,
      },
      {
        allocationPercent: 50,
        allocationStart: new Date("2026-11-15"),
        allocationEnd: new Date("2026-12-15"),
        isActive: true,
        membershipStatus: "Active" as const,
      },
    ];
    expect(
      rangesOverlap(
        rows[0]!.allocationStart,
        rows[0]!.allocationEnd,
        rows[1]!.allocationStart,
        rows[1]!.allocationEnd,
      ),
    ).toBe(true);
    expect(allocationForDate(rows, new Date("2026-11-20"))).toBe(110);
  });

  it("enforces learning status validation and appends rather than erasing skills", () => {
    expect(canTransitionLearningStatus("Submitted", "Validated")).toBe(true);
    expect(canTransitionLearningStatus("Draft", "Validated")).toBe(false);
    expect(validateLearningValidation("Submitted", "Passed", "")).toContain(
      "Validation comment is required.",
    );
    expect(appendValidatedSkill("TypeScript; React", "TypeScript")).toBe(
      "TypeScript; React",
    );
    expect(appendValidatedSkill("React", "SharePoint")).toBe(
      "React; SharePoint",
    );
  });

  it("keeps time visibility to the employee or authorized manager scope", () => {
    expect(canViewEmployeeTime(12, 12, false, false)).toBe(true);
    expect(canViewEmployeeTime(12, 13, false, false)).toBe(false);
    expect(canViewEmployeeTime(12, 13, true, false)).toBe(true);
    expect(canViewEmployeeTime(12, 13, false, true)).toBe(true);
  });
});
