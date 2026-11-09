import type { IPmoProject, IPmoWorkItem } from "../models/domain";
import { PlanningService } from "../services/domain/PlanningService";

const project: IPmoProject = {
  id: 7,
  etag: '"project"',
  title: "Delivery",
  projectCode: "PRJ-2026-00007",
  projectType: "Internal",
  description: "Delivery",
  scopeSummary: "Scope",
  projectManager: { id: 1, displayName: "Manager" },
  pmoOwner: { id: 2, displayName: "PMO" },
  status: "Approved",
  priority: "Normal",
  plannedStart: new Date("2026-01-01"),
  baselineEnd: new Date("2026-02-01"),
  currentApprovedEnd: new Date("2026-02-01"),
  baselineEffortHours: 20,
  approvedEffortHours: 20,
  actualEffortHours: 0,
  currencyCode: "USD",
  percentComplete: 0,
  overallHealth: "Not Set",
  baselineVersion: 1,
  currentPlanVersion: 0,
  confidentiality: "Internal",
  isActive: true,
};
const item = (
  id: number,
  overrides: Partial<IPmoWorkItem> = {},
): IPmoWorkItem => ({
  id,
  etag: `"${id}"`,
  title: `Task ${id}`,
  projectId: 7,
  projectCode: "PRJ-2026-00007",
  itemType: "Task",
  assignedEmployeeId: 3,
  assignedTo: { id: 3, displayName: "Employee" },
  qaRequired: false,
  status: "Assigned",
  priority: "Normal",
  plannedStart: new Date("2026-01-02"),
  plannedEnd: new Date("2026-01-03"),
  approvedEffortHours: 10,
  actualEffortHours: 0,
  percentComplete: 0,
  acceptanceCriteria: "Done",
  dependencyIds: [],
  isCritical: false,
  planVersion: 0,
  isActive: true,
  ...overrides,
});

const service = new PlanningService(
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
);

describe("PlanningService validation", () => {
  it("reconciles approved effort and warns about unplanned capacity", () => {
    const result = service.validate(project, [item(1)]);
    expect(result.approvedEffort).toBe(10);
    expect(result.remainingUnplannedEffort).toBe(10);
    expect(result.warnings).toContain("10 approved hour(s) remain unplanned.");
  });

  it("detects dependency cycles, missing assignment and QA ownership", () => {
    const result = service.validate(project, [
      item(1, {
        dependencyIds: [2],
        assignedEmployeeId: undefined,
        assignedTo: undefined,
      }),
      item(2, { dependencyIds: [1], qaRequired: true, qaOwner: undefined }),
    ]);
    expect(result.errors.join(" ")).toMatch(/no accountable owner/);
    expect(result.errors.join(" ")).toMatch(/QA-required/);
    expect(result.errors.join(" ")).toMatch(/Circular dependencies/);
  });

  it("blocks plan effort above the project-approved total", () => {
    const result = service.validate(project, [
      item(1, { approvedEffortHours: 21 }),
    ]);
    expect(result.errors).toContain(
      "Planned approved effort exceeds project approved effort.",
    );
  });
});
