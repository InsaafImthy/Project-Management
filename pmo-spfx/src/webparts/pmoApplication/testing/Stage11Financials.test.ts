import { PMO_FIELDS as F } from "../config/sharePointSchema";
import type {
  IPmoEmployeeRate,
  IPmoProject,
  IPmoProjectCost,
  IPmoProjectFinancials,
  IPmoTimeEntry,
} from "../models/domain";
import {
  FinancialManagementService,
  type IEmployeeRateDraft,
} from "../services/domain/FinancialManagementService";
import {
  calculateLaborCost,
  calculateMargin,
} from "../services/domain/DomainRules";
import type {
  IPmoResolvedUserContext,
  PmoCapability,
  PmoSecurityRole,
  UserCapabilityService,
} from "../services/domain/UserCapabilityService";
import { canOpenRoute } from "../services/domain/UserCapabilityService";
import type { RepositoryValues } from "../services/repositories/contracts";

const person = {
  id: 9,
  displayName: "Finance User",
  email: "finance@example.com",
};

const actor = (
  roles: readonly PmoSecurityRole[],
  capabilities: readonly PmoCapability[],
): IPmoResolvedUserContext => ({
  sharePointUserId: person.id,
  displayName: person.displayName,
  email: person.email,
  loginName: person.email,
  eligibility: {
    isProjectManager: roles.indexOf("projectManager") >= 0,
    isQa: false,
    isApprover: false,
    isResourceManager: false,
  },
  securityRoles: new Set(roles),
  capabilities: new Set(capabilities),
});

const project = (id = 1, currencyCode = "OMR"): IPmoProject => ({
  id,
  etag: `"p-${id}"`,
  title: `Project ${id}`,
  projectCode: `PRJ-2026-0000${id}`,
  projectType: "Customer",
  description: "Description",
  scopeSummary: "Scope",
  projectManager: person,
  pmoOwner: person,
  status: "Active",
  priority: "Normal",
  plannedStart: new Date("2026-01-01T00:00:00Z"),
  baselineEnd: new Date("2026-12-31T00:00:00Z"),
  currentApprovedEnd: new Date("2026-12-31T00:00:00Z"),
  baselineEffortHours: 100,
  approvedEffortHours: 100,
  actualEffortHours: 10,
  currencyCode,
  percentComplete: 10,
  overallHealth: "Green",
  baselineVersion: 1,
  currentPlanVersion: 1,
  confidentiality: "Restricted",
  isActive: true,
});

const rate = (overrides: Partial<IPmoEmployeeRate> = {}): IPmoEmployeeRate => ({
  id: 1,
  etag: '"r-1"',
  title: "Rate",
  employeeId: 4,
  employeeNumber: "EMP-004",
  employeeName: "Employee",
  rateType: "Hourly",
  costRate: 12,
  currencyCode: "OMR",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  isCurrent: true,
  ...overrides,
});

const entry = (overrides: Partial<IPmoTimeEntry> = {}): IPmoTimeEntry => ({
  id: 21,
  etag: '"t-1"',
  title: "Time",
  employeeId: 4,
  employeeUser: { id: 4, displayName: "Employee" },
  workDate: new Date("2026-06-15T00:00:00Z"),
  projectId: 1,
  projectCode: "PRJ-2026-00001",
  workItemId: 3,
  workCategory: "Project Task",
  hours: 4,
  workPerformed: "Approved work",
  entryStatus: "Approved",
  isBillable: true,
  isLocked: false,
  ...overrides,
});

const cost = (overrides: Partial<IPmoProjectCost> = {}): IPmoProjectCost => ({
  id: 31,
  etag: '"c-1"',
  title: "Cost",
  costNumber: "CST-2026-00031",
  projectId: 1,
  projectCode: "PRJ-2026-00001",
  costType: "Labor",
  sourceTimeEntryId: 21,
  costDate: new Date("2026-06-15T00:00:00Z"),
  employeeId: 4,
  amount: 48,
  currencyCode: "OMR",
  description: "Approved labor cost synchronization",
  costStatus: "Approved",
  ...overrides,
});

const summary = (
  id: number,
  overrides: Partial<IPmoProjectFinancials> = {},
): IPmoProjectFinancials => ({
  id,
  etag: `"f-${id}"`,
  title: `Financials ${id}`,
  projectId: id,
  projectCode: `PRJ-2026-0000${id}`,
  projectValue: 1000,
  currencyCode: "OMR",
  baselineCostBudget: 500,
  approvedCostBudget: 600,
  actualCost: 100,
  forecastCost: 400,
  forecastMarginAmount: 600,
  forecastMarginPercent: 60,
  calculationStatus: "Complete",
  ...overrides,
});

interface ITestRepositories {
  readonly rates: {
    getById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    getPage: jest.Mock;
    getForEmployee: jest.Mock;
    getEffectiveForEmployee: jest.Mock;
  };
  readonly costs: {
    getById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    getPage: jest.Mock;
    getApprovedByProject: jest.Mock;
    getForSourceTimeEntry: jest.Mock;
    getUnapproved: jest.Mock;
  };
  readonly financials: {
    getByProjectId: jest.Mock;
    getPage: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  readonly timeEntries: {
    getById: jest.Mock;
    getApprovedForCostSync: jest.Mock;
    getApprovedByProject: jest.Mock;
  };
  readonly projects: { getById: jest.Mock; getActive: jest.Mock };
}

const repositories = (): ITestRepositories => ({
  rates: {
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getPage: jest.fn().mockResolvedValue({ items: [] }),
    getForEmployee: jest.fn().mockResolvedValue({ items: [] }),
    getEffectiveForEmployee: jest.fn().mockResolvedValue({ items: [] }),
  },
  costs: {
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getPage: jest.fn().mockResolvedValue({ items: [] }),
    getApprovedByProject: jest.fn().mockResolvedValue({ items: [] }),
    getForSourceTimeEntry: jest.fn().mockResolvedValue({ items: [] }),
    getUnapproved: jest.fn().mockResolvedValue({ items: [] }),
  },
  financials: {
    getByProjectId: jest.fn(),
    getPage: jest.fn().mockResolvedValue({ items: [] }),
    create: jest.fn(),
    update: jest.fn(),
  },
  timeEntries: {
    getById: jest.fn(),
    getApprovedForCostSync: jest.fn().mockResolvedValue({ items: [] }),
    getApprovedByProject: jest.fn().mockResolvedValue({ items: [] }),
  },
  projects: {
    getById: jest.fn(),
    getActive: jest.fn().mockResolvedValue({ items: [] }),
  },
});

const service = (
  repos: ITestRepositories,
  resolvedActor = actor(["finance"], ["finance.view", "finance.manage"]),
): FinancialManagementService =>
  new FinancialManagementService(
    repos.rates,
    repos.costs,
    repos.financials,
    repos.timeEntries,
    repos.projects,
    {
      resolveCurrent: jest.fn().mockResolvedValue(resolvedActor),
    } as unknown as UserCapabilityService,
    async () => 8,
    async () => 20,
    () => new Date("2026-11-09T10:00:00Z"),
  );

describe("Stage 11 financial calculations and security", () => {
  it("calculates hourly and daily labor cost and zero-value margin", () => {
    expect(calculateLaborCost(4, 12, "Hourly", 8)).toBe(48);
    expect(calculateLaborCost(4, 80, "Daily", 8)).toBe(40);
    expect(calculateMargin(0, 30)).toEqual({ amount: -30, percent: undefined });
  });

  it("prevents overlapping effective periods before writing", async () => {
    const repos = repositories();
    repos.rates.getForEmployee.mockResolvedValue({
      items: [rate({ effectiveTo: new Date("2026-12-31T00:00:00Z") })],
    });
    const draft: IEmployeeRateDraft = {
      employeeId: 4,
      employeeNumber: "EMP-004",
      employeeName: "Employee",
      rateType: "Hourly",
      costRate: 15,
      currencyCode: "OMR",
      effectiveFrom: "2026-06-01",
      effectiveTo: "2026-08-31",
    };
    await expect(service(repos).saveRate(draft)).rejects.toThrow(/overlaps/);
    expect(repos.rates.create).not.toHaveBeenCalled();
  });

  it("queues a missing rate without creating a zero-cost record", async () => {
    const repos = repositories();
    repos.timeEntries.getApprovedForCostSync.mockResolvedValue({
      items: [entry()],
    });
    repos.projects.getById.mockResolvedValue(project());
    repos.rates.getEffectiveForEmployee.mockResolvedValue({ items: [] });
    const result = await service(repos).synchronizeLaborCosts();
    expect(result).toMatchObject({ created: 0, skipped: 0 });
    expect(result.missingRates).toHaveLength(1);
    expect(repos.rates.getEffectiveForEmployee).toHaveBeenCalledWith(
      4,
      entry().workDate,
    );
    expect(repos.costs.create).not.toHaveBeenCalled();
  });

  it("synchronizes approved time idempotently", async () => {
    const repos = repositories();
    let approved: IPmoProjectCost | undefined;
    repos.timeEntries.getApprovedForCostSync.mockResolvedValue({
      items: [entry()],
    });
    repos.projects.getById.mockResolvedValue(project());
    repos.rates.getEffectiveForEmployee.mockResolvedValue({ items: [rate()] });
    repos.costs.getForSourceTimeEntry.mockImplementation(async () => ({
      items: approved ? [approved] : [],
    }));
    repos.costs.create.mockImplementation(async (values: RepositoryValues) => {
      approved = cost({ amount: values[F.projectCosts.Amount] as number });
      return approved;
    });
    repos.costs.update.mockImplementation(
      async () => approved as IPmoProjectCost,
    );
    const target = service(repos);
    expect(await target.synchronizeLaborCosts()).toMatchObject({
      created: 1,
      skipped: 0,
    });
    expect(await target.synchronizeLaborCosts()).toMatchObject({
      created: 0,
      skipped: 1,
    });
    expect(repos.costs.create).toHaveBeenCalledTimes(1);
  });

  it("reverses and replaces corrected approved labor cost", async () => {
    const repos = repositories();
    const original = cost();
    repos.timeEntries.getById.mockResolvedValue(entry());
    repos.costs.getForSourceTimeEntry.mockResolvedValue({ items: [original] });
    repos.projects.getById.mockResolvedValue(project());
    repos.rates.getEffectiveForEmployee.mockResolvedValue({ items: [rate()] });
    let nextId = 40;
    repos.costs.update.mockImplementation(
      async (
        _id: number,
        values: RepositoryValues,
      ): Promise<IPmoProjectCost> => ({
        ...original,
        id: _id,
        etag: `"updated-${_id}"`,
        costStatus:
          (values[
            F.projectCosts.CostStatus
          ] as IPmoProjectCost["costStatus"]) ?? original.costStatus,
      }),
    );
    repos.costs.create.mockImplementation(
      async (values: RepositoryValues): Promise<IPmoProjectCost> =>
        cost({
          id: nextId++,
          etag: `"created-${nextId}"`,
          costStatus: values[
            F.projectCosts.CostStatus
          ] as IPmoProjectCost["costStatus"],
          reversalOfCostId: values[F.projectCosts.ReversalOfCostId] as
            | number
            | undefined,
        }),
    );
    await service(repos).replaceCorrectedLaborCost(21, "Approved correction");
    expect(repos.costs.create).toHaveBeenCalledTimes(2);
    expect(repos.costs.update).toHaveBeenCalledWith(
      original.id,
      expect.objectContaining({ [F.projectCosts.CostStatus]: "Reversed" }),
      original.etag,
    );
    expect(repos.costs.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        [F.projectCosts.CostType]: "Labor",
        [F.projectCosts.ReversalOfCostId]: original.id,
      }),
    );
  });

  it("totals multiple projects and applies the margin threshold", async () => {
    const repos = repositories();
    repos.financials.getPage.mockResolvedValue({
      items: [
        summary(1, {
          projectValue: 1000,
          actualCost: 300,
          forecastCost: 500,
          forecastMarginPercent: 50,
        }),
        summary(2, {
          projectValue: 500,
          actualCost: 100,
          forecastCost: 450,
          forecastMarginPercent: 10,
        }),
      ],
    });
    const result = await service(repos).dashboard();
    expect(result).toMatchObject({
      currencyCode: "OMR",
      portfolioValue: 1500,
      actualCost: 400,
      forecastCost: 950,
      forecastContribution: 550,
      belowMarginThreshold: 1,
    });
  });

  it("creates one missing financial summary per project without duplicates", async () => {
    const repos = repositories();
    repos.projects.getActive.mockResolvedValue({
      items: [project(1), project(2)],
    });
    repos.financials.getPage.mockResolvedValue({ items: [summary(1)] });
    repos.financials.create.mockResolvedValue(summary(2));
    await expect(
      service(repos).initializeMissingProjectFinancials(),
    ).resolves.toBe(1);
    expect(repos.financials.create).toHaveBeenCalledTimes(1);
    expect(repos.financials.create).toHaveBeenCalledWith(
      expect.objectContaining({ [F.projectFinancials.ProjectId]: 2 }),
    );
  });

  it("recalculates actual plus remaining forecast and blanks zero-value margin percent", async () => {
    const repos = repositories();
    const current = summary(1, {
      projectValue: 0,
      actualCost: 100,
      forecastCost: 250,
    });
    repos.financials.getByProjectId.mockResolvedValue(current);
    repos.costs.getApprovedByProject.mockResolvedValue({
      items: [cost({ amount: 120 })],
    });
    repos.timeEntries.getApprovedByProject.mockResolvedValue({ items: [] });
    repos.financials.update.mockImplementation(
      async (
        _id: number,
        values: RepositoryValues,
      ): Promise<IPmoProjectFinancials> => ({
        ...current,
        actualCost: values[F.projectFinancials.ActualCost] as number,
        forecastCost: values[F.projectFinancials.ForecastCost] as number,
        forecastMarginAmount: values[
          F.projectFinancials.ForecastMarginAmount
        ] as number,
        forecastMarginPercent:
          (values[F.projectFinancials.ForecastMarginPercent] as
            | number
            | null) ?? undefined,
      }),
    );
    const result = await service(repos).recalculateProjectFinancials(1);
    expect(result.actualCost).toBe(120);
    expect(result.forecastCost).toBe(270);
    expect(result.forecastMarginPercent).toBeUndefined();
  });

  it("does not invoke any restricted repository for an unauthorized user", async () => {
    const repos = repositories();
    const unauthorized = actor(["employee"], ["time.view-own"]);
    const target = service(repos, unauthorized);
    await expect(target.listRates("current")).rejects.toThrow(/access/);
    await expect(target.listCosts({})).rejects.toThrow(/access/);
    await expect(target.listFinancials()).rejects.toThrow(/access/);
    await expect(target.synchronizeLaborCosts()).rejects.toThrow(/permission/);
    await expect(target.getProjectFinancials(1)).rejects.toThrow(/access/);
    expect(repos.rates.getPage).not.toHaveBeenCalled();
    expect(repos.costs.getPage).not.toHaveBeenCalled();
    expect(repos.financials.getPage).not.toHaveBeenCalled();
    expect(repos.timeEntries.getApprovedForCostSync).not.toHaveBeenCalled();
    expect(repos.projects.getById).not.toHaveBeenCalled();
  });

  it("authorizes a project manager before querying their aggregate summary", async () => {
    const repos = repositories();
    const manager = actor(
      ["projectManager"],
      ["projects.view", "finance.project-summary"],
    );
    repos.projects.getById.mockResolvedValue(project());
    repos.financials.getByProjectId.mockResolvedValue(summary(1));
    await expect(
      service(repos, manager).getProjectFinancials(1),
    ).resolves.toBeDefined();
    expect(repos.projects.getById.mock.invocationCallOrder[0]).toBeLessThan(
      repos.financials.getByProjectId.mock.invocationCallOrder[0] as number,
    );
  });

  it("keeps detailed finance routes separate from project-summary access", () => {
    const manager = actor(
      ["projectManager"],
      ["projects.view", "finance.project-summary"],
    );
    const executive = actor(
      ["executive"],
      ["finance.view", "finance.project-summary", "portfolio.view"],
    );
    expect(canOpenRoute(manager, "project-financials")).toBe(true);
    expect(canOpenRoute(manager, "employee-rates")).toBe(false);
    expect(canOpenRoute(manager, "project-costs")).toBe(false);
    expect(canOpenRoute(executive, "employee-rates")).toBe(true);
    expect(canOpenRoute(executive, "project-costs")).toBe(true);
  });
});
