import type { IPmoEmployee, IPmoProjectMember } from "../models/domain";
import { canTransitionProjectStatus } from "../services/domain/DomainRules";
import { generateProjectCode } from "../services/domain/ProjectManagementService";
import {
  calculateOverlappingAllocation,
  validateProjectDraft,
  validateProjectMemberDraft,
} from "../features/projects/validation";
import { parsePmoRoute } from "../routing/pmoRoutes";

const employee = (overrides: Partial<IPmoEmployee> = {}): IPmoEmployee => ({
  id: 8,
  etag: '"employee"',
  name: "Avery",
  employeeNumber: "E-8",
  user: { id: 18, displayName: "Avery" },
  email: "avery@example.com",
  department: "Delivery",
  employmentStatus: "Active",
  standardHoursPerDay: 8,
  capacityPercent: 80,
  isProjectManager: true,
  isQa: false,
  isApprover: false,
  isResourceManager: false,
  isActive: true,
  ...overrides,
});

const membership = (
  overrides: Partial<IPmoProjectMember> = {},
): IPmoProjectMember => ({
  id: 4,
  etag: '"member"',
  title: "PRJ Avery",
  projectId: 4,
  projectCode: "PRJ-2026-00004",
  employeeId: 8,
  employeeUser: { id: 18, displayName: "Avery" },
  projectRole: "Contributor",
  allocationPercent: 60,
  allocationStart: new Date("2026-11-01T00:00:00Z"),
  allocationEnd: new Date("2026-11-30T00:00:00Z"),
  membershipStatus: "Active",
  isActive: true,
  ...overrides,
});

describe("Stage 06 project rules", () => {
  it("generates a stable project code from the SharePoint item ID", () => {
    expect(generateProjectCode(120, new Date("2026-11-08T00:00:00Z"))).toBe(
      "PRJ-2026-00120",
    );
  });

  it("rejects invalid project dates and effort", () => {
    const errors = validateProjectDraft({
      title: "",
      projectType: "Internal",
      description: "",
      scopeSummary: "",
      priority: "Normal",
      plannedStart: "2026-12-10",
      baselineEnd: "2026-12-01",
      baselineEffortHours: -1,
      currencyCode: "US",
      confidentiality: "Internal",
    });
    expect(errors.title).toBeDefined();
    expect(errors.baselineEnd).toMatch(/earlier/);
    expect(errors.baselineEffortHours).toMatch(/zero or greater/);
  });

  it("calculates overlapping cross-project allocation", () => {
    expect(
      calculateOverlappingAllocation(
        [membership()],
        8,
        new Date("2026-11-10"),
        new Date("2026-11-20"),
      ),
    ).toBe(60);
    expect(
      calculateOverlappingAllocation(
        [membership()],
        8,
        new Date("2026-12-01"),
        new Date("2026-12-20"),
      ),
    ).toBe(0);
  });

  it("rejects inactive employees and allocations outside employment dates", () => {
    const errors = validateProjectMemberDraft(
      {
        employee: employee({ isActive: false, employmentStatus: "Inactive" }),
        projectRole: "Contributor",
        allocationPercent: 120,
        allocationStart: "2026-11-01",
        allocationEnd: "2026-11-30",
      },
      {
        plannedStart: new Date("2026-11-01"),
        currentApprovedEnd: new Date("2026-11-30"),
      },
    );
    expect(errors.employee).toMatch(/active/);
    expect(errors.allocationPercent).toMatch(/between/);
  });

  it("allows only domain project status transitions", () => {
    expect(
      canTransitionProjectStatus("Draft", "Pending Baseline Approval"),
    ).toBe(true);
    expect(canTransitionProjectStatus("Approved", "Active")).toBe(true);
    expect(canTransitionProjectStatus("Draft", "Active")).toBe(false);
  });

  it("retains dashboard drill-down filter parameters", () => {
    const route = parsePmoRoute("?view=project-list&status=Draft&health=Red");
    expect(route.view).toBe("project-list");
    expect(route.query.status).toBe("Draft");
    expect(route.query.health).toBe("Red");
  });
});
