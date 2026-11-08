import { PMO_FIELDS as F } from "../config/sharePointSchema";
import type {
  IPmoProject,
  IPmoProjectCost,
  IPmoProjectFinancials,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../models/domain";
import { MetricsService } from "../services/domain/MetricsService";
import type {
  IPmoResolvedUserContext,
  PmoCapability,
  PmoSecurityRole,
} from "../services/domain/UserCapabilityService";

const manager = { id: 10, displayName: "Manager" };
const employee = { id: 11, displayName: "Employee" };

const project = (): IPmoProject => ({
  id: 1,
  etag: '"p-1"',
  title: "Project",
  projectCode: "PRJ-2026-00001",
  projectType: "Internal",
  description: "Description",
  scopeSummary: "Scope",
  projectManager: manager,
  pmoOwner: manager,
  status: "Active",
  priority: "Normal",
  plannedStart: new Date("2026-11-01T00:00:00Z"),
  baselineEnd: new Date("2026-12-31T00:00:00Z"),
  currentApprovedEnd: new Date("2026-12-31T00:00:00Z"),
  baselineEffortHours: 40,
  approvedEffortHours: 40,
  actualEffortHours: 0,
  currencyCode: "OMR",
  percentComplete: 0,
  overallHealth: "Not Set",
  baselineVersion: 1,
  currentPlanVersion: 1,
  confidentiality: "Internal",
  isActive: true,
});

const workItem = (
  id: number,
  effort: number,
  completion: number,
): IPmoWorkItem => ({
  id,
  etag: `"w-${id}"`,
  title: `Task ${id}`,
  projectId: 1,
  projectCode: "PRJ-2026-00001",
  itemType: "Task",
  assignedEmployeeId: 11,
  assignedTo: employee,
  qaRequired: false,
  status: "In Progress",
  priority: "Normal",
  plannedEnd: new Date("2026-12-31T00:00:00Z"),
  approvedEffortHours: effort,
  actualEffortHours: 3,
  percentComplete: completion,
  dependencyIds: [],
  isCritical: false,
  planVersion: 1,
  isActive: true,
});

const timeEntry: IPmoTimeEntry = {
  id: 1,
  etag: '"t-1"',
  title: "Time",
  employeeId: 11,
  employeeUser: employee,
  workDate: new Date("2026-11-08T00:00:00Z"),
  projectId: 1,
  projectCode: "PRJ-2026-00001",
  workItemId: 1,
  workCategory: "Project Task",
  hours: 6,
  workPerformed: "Work",
  entryStatus: "Approved",
  isBillable: false,
  isLocked: false,
};

const financialSummary = (): IPmoProjectFinancials => ({
  id: 2,
  etag: '"f-1"',
  title: "Financials",
  projectId: 1,
  projectCode: "PRJ-2026-00001",
  projectValue: 1000,
  currencyCode: "OMR",
  actualCost: 0,
  forecastCost: 80,
  calculationStatus: "Complete",
});

const cost: IPmoProjectCost = {
  id: 3,
  etag: '"c-1"',
  title: "Cost",
  costNumber: "CST-2026-00003",
  projectId: 1,
  projectCode: "PRJ-2026-00001",
  costType: "Vendor",
  costDate: new Date("2026-11-08T00:00:00Z"),
  amount: 100,
  currencyCode: "OMR",
  description: "Vendor",
  costStatus: "Approved",
};

const authorizedActor = (): IPmoResolvedUserContext => ({
  sharePointUserId: 10,
  displayName: "Owner",
  email: "owner@example.com",
  loginName: "owner@example.com",
  eligibility: {
    isProjectManager: false,
    isQa: false,
    isApprover: false,
    isResourceManager: false,
  },
  securityRoles: new Set<PmoSecurityRole>(["owner"]),
  capabilities: new Set<PmoCapability>(["projects.manage", "finance.view"]),
});

describe("MetricsService", () => {
  it("recalculates operational and restricted summaries idempotently", async () => {
    let currentProject = project();
    let summary = financialSummary();
    const projects = {
      getById: async (): Promise<IPmoProject> => currentProject,
      update: async (
        _id: number,
        values: Readonly<Record<string, unknown>>,
      ): Promise<IPmoProject> => {
        currentProject = {
          ...currentProject,
          etag: `"p-${Number(currentProject.etag.replace(/\D/g, "")) + 1}"`,
          actualEffortHours: values[F.projects.ActualEffortHours] as number,
          forecastEffortHours: values[F.projects.ForecastEffortHours] as number,
          percentComplete: values[F.projects.PercentComplete] as number,
          overallHealth: values[
            F.projects.OverallHealth
          ] as IPmoProject["overallHealth"],
        };
        return currentProject;
      },
    };
    const financials = {
      getByProjectId: async (): Promise<IPmoProjectFinancials> => summary,
      update: async (
        _id: number,
        values: Readonly<Record<string, unknown>>,
      ): Promise<IPmoProjectFinancials> => {
        summary = {
          ...summary,
          etag: '"f-2"',
          actualCost: values[F.projectFinancials.ActualCost] as number,
          forecastCost: values[F.projectFinancials.ForecastCost] as number,
          forecastMarginAmount: values[
            F.projectFinancials.ForecastMarginAmount
          ] as number,
          forecastMarginPercent: values[
            F.projectFinancials.ForecastMarginPercent
          ] as number,
        };
        return summary;
      },
    };
    const service = new MetricsService(
      projects,
      {
        getByProject: async () => ({
          items: [workItem(1, 10, 100), workItem(2, 30, 0)],
        }),
      },
      { getApprovedByProject: async () => ({ items: [timeEntry] }) },
      { getByProject: async () => ({ items: [] }) },
      { getApprovedByProject: async () => ({ items: [cost] }) },
      financials,
      () => new Date("2026-11-08T10:00:00Z"),
    );

    const first = await service.refreshProject(1, authorizedActor(), true);
    const second = await service.refreshProject(1, authorizedActor(), true);
    expect(first).toMatchObject({
      percentComplete: 25,
      actualEffortHours: 6,
      forecastEffortHours: 40,
      financialsRecalculated: true,
    });
    expect(second.percentComplete).toBe(first.percentComplete);
    expect(summary).toMatchObject({
      actualCost: 100,
      forecastCost: 100,
      forecastMarginAmount: 900,
      forecastMarginPercent: 90,
    });
  });

  it("never queries restricted repositories for an unauthorized financial refresh", async () => {
    const restrictedQuery = jest.fn();
    const actor: IPmoResolvedUserContext = {
      ...authorizedActor(),
      securityRoles: new Set<PmoSecurityRole>(["projectManager"]),
      capabilities: new Set<PmoCapability>(["projects.manage"]),
    };
    const service = new MetricsService(
      {
        getById: async () => project(),
        update: async () => project(),
      },
      { getByProject: async () => ({ items: [] }) },
      { getApprovedByProject: async () => ({ items: [] }) },
      { getByProject: async () => ({ items: [] }) },
      { getApprovedByProject: restrictedQuery },
      { getByProjectId: restrictedQuery, update: restrictedQuery },
    );
    await expect(service.refreshProject(1, actor, true)).rejects.toThrow(
      /restricted financial access/,
    );
    expect(restrictedQuery).not.toHaveBeenCalled();
  });
});
