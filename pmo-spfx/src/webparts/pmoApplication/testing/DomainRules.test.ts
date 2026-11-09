import type {
  IPmoChangeRequest,
  IPmoQualityItem,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../models/domain";
import {
  approvalStatusForDecision,
  assertApprovalTransition,
  calculateEffortVariance,
  calculateLaborCost,
  calculateMargin,
  calculatePercentComplete,
  calculateRequiredDailyHours,
  calculateScheduleVarianceDays,
  canTransitionProjectStatus,
  canTransitionWorkItemStatus,
  createPlanMeasureSet,
  evaluateProjectHealth,
  generateRecordCode,
  validateChangeRequest,
  validateQualityTransition,
  validateTaskActionEligibility,
  validateTimeEntry,
} from "../services/domain/DomainRules";

const person = { id: 10, displayName: "Employee" };
const workItem = (overrides: Partial<IPmoWorkItem> = {}): IPmoWorkItem => ({
  id: 1,
  etag: '"1"',
  title: "Task",
  workItemCode: "WIT-2026-00001",
  projectId: 2,
  projectCode: "PRJ-2026-00002",
  itemType: "Task",
  assignedEmployeeId: 5,
  assignedTo: person,
  qaRequired: false,
  status: "Assigned",
  priority: "Normal",
  approvedEffortHours: 10,
  actualEffortHours: 2,
  percentComplete: 20,
  dependencyIds: [],
  isCritical: false,
  planVersion: 1,
  isActive: true,
  ...overrides,
});

describe("domain transition rules", () => {
  it("permits governed project transitions and blocks terminal changes", () => {
    expect(
      canTransitionProjectStatus("Draft", "Pending Baseline Approval"),
    ).toBe(true);
    expect(canTransitionProjectStatus("Closed", "Active")).toBe(false);
  });

  it("permits normal work flow and blocks skipping review", () => {
    expect(canTransitionWorkItemStatus("Assigned", "Accepted")).toBe(true);
    expect(canTransitionWorkItemStatus("In Progress", "Accepted")).toBe(false);
  });

  it.each([
    ["Draft", "Assigned"],
    ["Draft", "Ready"],
    ["Assigned", "Accepted"],
    ["Accepted", "In Progress"],
    ["Ready", "In Progress"],
    ["In Progress", "Blocked"],
    ["In Progress", "Submitted for Review"],
    ["Blocked", "In Progress"],
    ["Submitted for Review", "In Review"],
    ["In Review", "Submitted to QA"],
    ["In Review", "Accepted"],
    ["Submitted to QA", "QA In Progress"],
    ["QA In Progress", "Accepted"],
    ["On Hold", "Ready"],
  ] as const)("allows work transition %s to %s", (from, to) => {
    expect(canTransitionWorkItemStatus(from, to)).toBe(true);
  });

  it.each([
    ["Draft", "In Progress"],
    ["Assigned", "Blocked"],
    ["Accepted", "Submitted for Review"],
    ["In Progress", "Accepted"],
    ["Blocked", "Accepted"],
    ["Cancelled", "Ready"],
  ] as const)("rejects work transition %s to %s", (from, to) => {
    expect(canTransitionWorkItemStatus(from, to)).toBe(false);
  });

  it("maps approval decisions and prevents repeated terminal decisions", () => {
    expect(approvalStatusForDecision("Conditionally Approve")).toBe(
      "Conditionally Approved",
    );
    expect(() => assertApprovalTransition("Approved", "Rejected")).toThrow(
      /cannot transition/,
    );
  });
});

describe("task actions and governed validation", () => {
  it("requires assignment and action-specific comments", () => {
    const errors = validateTaskActionEligibility(
      {
        employeeId: 99,
        sharePointUserId: 99,
        isProjectManager: false,
        isQa: false,
        isOwner: false,
      },
      workItem({ status: "In Progress" }),
      { actionType: "Block" },
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/not assigned/),
        expect.stringMatching(/requires a comment/),
      ]),
    );
  });

  it("validates progress and remaining effort ranges", () => {
    const errors = validateTaskActionEligibility(
      {
        employeeId: 5,
        sharePointUserId: 10,
        isProjectManager: false,
        isQa: false,
        isOwner: false,
      },
      workItem({ status: "In Progress" }),
      {
        actionType: "Progress Update",
        progressPercent: 101,
        remainingEffortHours: -1,
      },
    );
    expect(errors).toHaveLength(2);
  });

  it("validates additional-effort arithmetic", () => {
    const request = {
      requestType: "Additional Effort",
      workItemId: 1,
      currentEffortHours: 10,
      additionalHoursRequested: 4,
      proposedEffortHours: 13,
      impactSummary: "Impact",
      reasonDetails: "Reason",
    } as Pick<
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
    >;
    expect(validateChangeRequest(request)).toContain(
      "Proposed effort must equal current plus additional hours.",
    );
  });

  it("requires approved exception evidence", () => {
    const item = {
      qualityType: "Release Exception",
      status: "Deferred",
    } as Pick<
      IPmoQualityItem,
      | "qualityType"
      | "status"
      | "workItemId"
      | "testResult"
      | "severity"
      | "assignedTo"
      | "customerImpact"
      | "approvalRequestId"
    >;
    expect(validateQualityTransition(item, "Approved Exception")).toContain(
      "Approved exceptions require an approval request.",
    );
  });
});

describe("time and calculation rules", () => {
  it("calculates capacity-adjusted required hours less leave", () => {
    expect(
      calculateRequiredDailyHours({
        standardHoursPerDay: 8,
        capacityPercent: 75,
        isWorkingDay: true,
        approvedLeaveHours: 2,
      }),
    ).toBe(4);
  });

  it("validates future, locked, excessive task time", () => {
    const entry = {
      hours: 5,
      workDate: new Date("2026-11-09T00:00:00Z"),
      workCategory: "Project Task",
      projectId: 2,
      workItemId: 1,
      workPerformed: "Work",
      isLocked: true,
    } as Pick<
      IPmoTimeEntry,
      | "hours"
      | "workDate"
      | "workCategory"
      | "projectId"
      | "workItemId"
      | "workPerformed"
      | "isLocked"
    >;
    expect(
      validateTimeEntry(entry, {
        now: new Date("2026-11-08T12:00:00Z"),
        maximumDailyHours: 8,
        existingDayHours: 4,
        isAuthorizedContributor: false,
      }),
    ).toHaveLength(4);
  });

  it("keeps baseline, current, actual and forecast distinct", () => {
    expect(createPlanMeasureSet(100, 120, 70, 130)).toEqual({
      baseline: 100,
      currentApproved: 120,
      actual: 70,
      forecast: 130,
    });
    expect(() => createPlanMeasureSet(-1, 0, 0, 0)).toThrow();
  });

  it("calculates effort-weighted completion", () => {
    expect(
      calculatePercentComplete([
        workItem({ approvedEffortHours: 10, percentComplete: 100 }),
        workItem({ approvedEffortHours: 30, percentComplete: 0 }),
      ]),
    ).toBe(25);
  });

  it("calculates effort and schedule variance", () => {
    expect(calculateEffortVariance(120, 100)).toBe(20);
    expect(
      calculateScheduleVarianceDays(
        new Date("2026-11-11T00:00:00Z"),
        new Date("2026-11-08T00:00:00Z"),
      ),
    ).toBe(3);
  });

  it("calculates hourly/daily costs and margin", () => {
    expect(calculateLaborCost(16, 10, "Hourly", 8)).toBe(160);
    expect(calculateLaborCost(16, 80, "Daily", 8)).toBe(160);
    expect(calculateMargin(1000, 750)).toEqual({ amount: 250, percent: 25 });
    expect(calculateMargin(0, 10).percent).toBeUndefined();
  });

  it("returns transparent health drivers with worst severity", () => {
    const result = evaluateProjectHealth({
      scheduleVarianceDays: 5,
      effortVariancePercent: 25,
      criticalBlockedCount: 0,
      criticalQualityCount: 1,
      hasIncompleteMetrics: true,
    });
    expect(result.health).toBe("Red");
    expect(result.drivers.map((driver) => driver.key)).toEqual([
      "schedule",
      "effort",
      "quality",
      "data",
    ]);
  });

  it.each([
    ["Project", "PRJ"],
    ["Work Item", "WIT"],
    ["Request", "REQ"],
    ["Approval", "APR"],
    ["Risk", "RSK"],
    ["Quality", "QLT"],
    ["Learning", "LRN"],
    ["Cost", "CST"],
    ["Import", "IMP"],
  ] as const)("generates %s codes", (kind, prefix) => {
    expect(
      generateRecordCode(kind, 120, new Date("2026-02-01T00:00:00Z")),
    ).toBe(`${prefix}-2026-00120`);
  });
});
