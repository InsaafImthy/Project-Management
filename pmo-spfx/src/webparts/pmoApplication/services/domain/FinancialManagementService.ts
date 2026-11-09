import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type {
  IPmoEmployeeRate,
  IPmoProject,
  IPmoProjectCost,
  IPmoProjectFinancials,
  IPmoTimeEntry,
} from "../../models/domain";
import type { IRepositoryPage } from "../repositories/contracts";
import type {
  EmployeeRatesRepository,
  ProjectCostsRepository,
  ProjectFinancialsRepository,
  ProjectsRepository,
  TimeEntriesRepository,
} from "../repositories/repositories";
import { PmoBusinessError } from "./ConfigurationManagementService";
import { calculateLaborCost, calculateMargin } from "./DomainRules";
import type {
  IPmoResolvedUserContext,
  UserCapabilityService,
} from "./UserCapabilityService";
import {
  canReadProjectFinancialSummary,
  canReadRestrictedFinancials,
} from "./UserCapabilityService";

export type RateView = "current" | "future" | "expired";

export interface IEmployeeRateDraft {
  readonly employeeId: number;
  readonly employeeNumber: string;
  readonly employeeName: string;
  readonly rateType: IPmoEmployeeRate["rateType"];
  readonly costRate: number;
  readonly currencyCode: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly approvalReference?: string;
  readonly notes?: string;
}

export interface IManualProjectCostDraft {
  readonly projectId: number;
  readonly projectCode: string;
  readonly costType: Exclude<IPmoProjectCost["costType"], "Labor">;
  readonly costDate: string;
  readonly amount: number;
  readonly currencyCode: string;
  readonly description: string;
}

export interface IProjectFinancialDraft {
  readonly projectValue?: number;
  readonly baselineCostBudget?: number;
  readonly approvedCostBudget?: number;
}

export interface IMissingRateItem {
  readonly timeEntryId: number;
  readonly projectId: number;
  readonly employeeId: number;
  readonly workDate: Date;
  readonly reason: "Missing rate" | "Overlapping rates" | "Currency mismatch";
}

export interface ILaborSyncResult {
  readonly created: number;
  readonly skipped: number;
  readonly missingRates: readonly IMissingRateItem[];
}

export interface IFinanceDashboard {
  readonly currencyCode: string;
  readonly portfolioValue: number;
  readonly actualCost: number;
  readonly forecastCost: number;
  readonly forecastContribution: number;
  readonly forecastMarginPercent?: number;
  readonly belowMarginThreshold: number;
  readonly missingRate: number;
  readonly missingValue: number;
  readonly unapprovedCosts: number;
  readonly awaitingCostSynchronization: number;
  readonly calculatedOn: Date;
}

interface ILaborPreview {
  readonly ready: readonly {
    readonly entry: IPmoTimeEntry;
    readonly project: IPmoProject;
    readonly rate: IPmoEmployeeRate;
  }[];
  readonly skipped: number;
  readonly missing: readonly IMissingRateItem[];
}

const dateOnly = (value: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PmoBusinessError("validation", "Enter a valid effective date.");
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.valueOf())) {
    throw new PmoBusinessError("validation", "Enter a valid effective date.");
  }
  return parsed;
};

const endOfTime = new Date("9999-12-31T00:00:00Z");
const overlaps = (
  leftStart: Date,
  leftEnd: Date | undefined,
  rightStart: Date,
  rightEnd: Date | undefined,
): boolean =>
  leftStart <= (rightEnd ?? endOfTime) && rightStart <= (leftEnd ?? endOfTime);

const all = async <T>(
  page: (continuation?: string) => Promise<IRepositoryPage<T>>,
): Promise<T[]> => {
  const values: T[] = [];
  let continuation: string | undefined;
  do {
    const result = await page(continuation);
    values.push(...result.items);
    continuation = result.continuation;
  } while (continuation);
  return values;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

/**
 * Sole application boundary for restricted rates, cost rows, and financial
 * summaries. Authorization is resolved before every restricted repository
 * access and the service retains no confidential result cache.
 */
export class FinancialManagementService {
  public constructor(
    private readonly rates: Pick<
      EmployeeRatesRepository,
      | "getById"
      | "create"
      | "update"
      | "getPage"
      | "getForEmployee"
      | "getEffectiveForEmployee"
    >,
    private readonly costs: Pick<
      ProjectCostsRepository,
      | "getById"
      | "create"
      | "update"
      | "getPage"
      | "getApprovedByProject"
      | "getForSourceTimeEntry"
      | "getUnapproved"
    >,
    private readonly financials: Pick<
      ProjectFinancialsRepository,
      "getByProjectId" | "getPage" | "create" | "update"
    >,
    private readonly timeEntries: Pick<
      TimeEntriesRepository,
      "getById" | "getApprovedForCostSync" | "getApprovedByProject"
    >,
    private readonly projects: Pick<
      ProjectsRepository,
      "getById" | "getActive"
    >,
    private readonly capabilities: UserCapabilityService,
    private readonly personDayHours: () => Promise<number>,
    private readonly marginThreshold: () => Promise<number>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async listRates(
    view: RateView,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoEmployeeRate>> {
    await this.requireDetailedFinancialAccess();
    const asOf = new Date(this.now());
    asOf.setHours(0, 0, 0, 0);
    return this.rates.getPage(view, asOf, continuation);
  }

  public async saveRate(
    draft: IEmployeeRateDraft,
    existing?: IPmoEmployeeRate,
  ): Promise<IPmoEmployeeRate> {
    await this.requireManageAccess();
    const start = dateOnly(draft.effectiveFrom);
    const end = draft.effectiveTo ? dateOnly(draft.effectiveTo) : undefined;
    this.validateRateDraft(draft, start, end);
    const employeeRates = await all((continuation) =>
      this.rates.getForEmployee(draft.employeeId, draft.rateType, continuation),
    );
    if (
      employeeRates.some(
        (rate) =>
          rate.id !== existing?.id &&
          overlaps(rate.effectiveFrom, rate.effectiveTo, start, end),
      )
    ) {
      throw new PmoBusinessError(
        "validation",
        "The effective period overlaps another rate for this employee and rate type.",
      );
    }
    const asOf = new Date(this.now());
    asOf.setHours(0, 0, 0, 0);
    const current = start <= asOf && (!end || end >= asOf);
    const values = {
      [F.employeeRates.Title]:
        `${draft.employeeNumber.trim()} ${draft.effectiveFrom}`,
      [F.employeeRates.EmployeeId]: draft.employeeId,
      [F.employeeRates.EmployeeNumber]: draft.employeeNumber.trim(),
      [F.employeeRates.EmployeeName]: draft.employeeName.trim(),
      [F.employeeRates.RateType]: draft.rateType,
      [F.employeeRates.CostRate]: draft.costRate,
      [F.employeeRates.CurrencyCode]: draft.currencyCode.trim().toUpperCase(),
      [F.employeeRates.EffectiveFrom]: start.toISOString(),
      [F.employeeRates.EffectiveTo]: end?.toISOString() ?? null,
      [F.employeeRates.IsCurrent]: current,
      [F.employeeRates.ApprovalReference]:
        draft.approvalReference?.trim() || null,
      [F.employeeRates.Notes]: draft.notes?.trim() || null,
    };
    return existing
      ? this.rates.update(existing.id, values, existing.etag)
      : this.rates.create(values);
  }

  public async closeCurrentAndAdd(
    current: IPmoEmployeeRate,
    replacement: IEmployeeRateDraft,
  ): Promise<IPmoEmployeeRate> {
    await this.requireManageAccess();
    const nextStart = dateOnly(replacement.effectiveFrom);
    if (
      replacement.employeeId !== current.employeeId ||
      replacement.rateType !== current.rateType
    ) {
      throw new PmoBusinessError(
        "validation",
        "A replacement rate must keep the employee and rate type.",
      );
    }
    if (nextStart <= current.effectiveFrom) {
      throw new PmoBusinessError(
        "validation",
        "The replacement rate must start after the current rate.",
      );
    }
    const closeDate = new Date(nextStart);
    closeDate.setDate(closeDate.getDate() - 1);
    const asOf = new Date(this.now());
    asOf.setHours(0, 0, 0, 0);
    const remainsCurrentUntilReplacement = closeDate >= asOf;
    const closed = await this.rates.update(
      current.id,
      {
        [F.employeeRates.EffectiveTo]: closeDate.toISOString(),
        [F.employeeRates.IsCurrent]: remainsCurrentUntilReplacement,
      },
      current.etag,
    );
    try {
      return await this.saveRate(replacement);
    } catch (error) {
      await this.rates.update(
        closed.id,
        {
          [F.employeeRates.EffectiveTo]:
            current.effectiveTo?.toISOString() ?? null,
          [F.employeeRates.IsCurrent]: current.isCurrent,
        },
        closed.etag,
      );
      throw error;
    }
  }

  public async listCosts(
    filters: Parameters<ProjectCostsRepository["getPage"]>[0],
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProjectCost>> {
    await this.requireDetailedFinancialAccess();
    return this.costs.getPage(filters, continuation);
  }

  public async createManualCost(
    draft: IManualProjectCostDraft,
  ): Promise<IPmoProjectCost> {
    await this.requireManageAccess();
    if (!Number.isFinite(draft.amount) || draft.amount < 0) {
      throw new PmoBusinessError(
        "validation",
        "Cost amount must be zero or greater.",
      );
    }
    if (!/^[A-Za-z]{3}$/.test(draft.currencyCode.trim())) {
      throw new PmoBusinessError(
        "validation",
        "Currency must be a three-letter code.",
      );
    }
    if (!draft.description.trim()) {
      throw new PmoBusinessError(
        "validation",
        "A cost description is required.",
      );
    }
    const project = await this.projects.getById(draft.projectId);
    if (project.projectCode !== draft.projectCode) {
      throw new PmoBusinessError(
        "validation",
        "The selected project identifiers do not match.",
      );
    }
    if (
      project.currencyCode.toUpperCase() !==
      draft.currencyCode.trim().toUpperCase()
    ) {
      throw new PmoBusinessError(
        "validation",
        "Cost currency must match the project reporting currency.",
      );
    }
    const created = await this.costs.create({
      [F.projectCosts.Title]: `${draft.projectCode} ${draft.costType}`,
      [F.projectCosts.CostNumber]: `PENDING-${this.now().valueOf()}`,
      [F.projectCosts.ProjectId]: draft.projectId,
      [F.projectCosts.ProjectCode]: draft.projectCode,
      [F.projectCosts.CostType]: draft.costType,
      [F.projectCosts.CostDate]: dateOnly(draft.costDate).toISOString(),
      [F.projectCosts.Amount]: draft.amount,
      [F.projectCosts.CurrencyCode]: draft.currencyCode.trim().toUpperCase(),
      [F.projectCosts.Description]: draft.description.trim(),
      [F.projectCosts.CostStatus]: "Draft",
    });
    return this.costs.update(
      created.id,
      { [F.projectCosts.CostNumber]: this.costNumber(created.id) },
      created.etag,
    );
  }

  public async approveCost(cost: IPmoProjectCost): Promise<IPmoProjectCost> {
    const actor = await this.requireManageAccess();
    if (cost.costStatus !== "Draft") {
      throw new PmoBusinessError(
        "validation",
        "Only a draft cost can be approved.",
      );
    }
    return this.costs.update(
      cost.id,
      {
        [F.projectCosts.CostStatus]: "Approved",
        [`${F.projectCosts.ApprovedBy}Id`]: actor.sharePointUserId,
        [F.projectCosts.ApprovedOn]: this.now().toISOString(),
      },
      cost.etag,
    );
  }

  public async reverseCost(
    cost: IPmoProjectCost,
    reason: string,
  ): Promise<IPmoProjectCost> {
    await this.requireManageAccess();
    return this.reverseApprovedCost(cost, reason);
  }

  public async previewLaborSynchronization(limit = 100): Promise<{
    readonly ready: number;
    readonly missingRates: readonly IMissingRateItem[];
    readonly skipped: number;
  }> {
    await this.requireDetailedFinancialAccess();
    const preview = await this.buildLaborPreview(limit);
    return {
      ready: preview.ready.length,
      missingRates: preview.missing,
      skipped: preview.skipped,
    };
  }

  public async synchronizeLaborCosts(limit = 100): Promise<ILaborSyncResult> {
    const actor = await this.requireManageAccess();
    const preview = await this.buildLaborPreview(limit);
    let created = 0;
    for (const item of preview.ready) {
      await this.createApprovedLaborCost(
        item.entry,
        item.project,
        item.rate,
        actor.sharePointUserId,
      );
      created += 1;
    }
    return {
      created,
      skipped: preview.skipped,
      missingRates: preview.missing,
    };
  }

  public async replaceCorrectedLaborCost(
    timeEntryId: number,
    reason: string,
  ): Promise<IPmoProjectCost | undefined> {
    const actor = await this.requireManageAccess();
    if (!reason.trim()) {
      throw new PmoBusinessError(
        "validation",
        "A correction reason is required.",
      );
    }
    const entry = await this.timeEntries.getById(timeEntryId);
    if (entry.entryStatus !== "Approved" || entry.projectId === undefined) {
      throw new PmoBusinessError(
        "validation",
        "Only approved project time can replace a labor cost.",
      );
    }
    const rows = await all((continuation) =>
      this.costs.getForSourceTimeEntry(entry.id, continuation),
    );
    const approved = rows.find(
      (cost) => cost.costType === "Labor" && cost.costStatus === "Approved",
    );
    if (!approved) {
      throw new PmoBusinessError(
        "validation",
        "No approved labor cost exists for the corrected time entry.",
      );
    }
    const project = await this.projects.getById(entry.projectId);
    const rateResult = await this.resolveEffectiveRate(entry, project);
    if (!("rate" in rateResult)) return undefined;
    await this.reverseApprovedCost(approved, reason);
    return this.createApprovedLaborCost(
      entry,
      project,
      rateResult.rate,
      actor.sharePointUserId,
      approved.id,
    );
  }

  public async getProjectFinancials(
    projectId: number,
  ): Promise<IPmoProjectFinancials | undefined> {
    const actor = await this.capabilities.resolveCurrent();
    if (!canReadProjectFinancialSummary(actor)) {
      throw new PmoBusinessError(
        "authorization",
        "You do not have access to project financial summaries.",
      );
    }
    if (!canReadRestrictedFinancials(actor)) {
      const project = await this.projects.getById(projectId);
      if (project.projectManager.id !== actor.sharePointUserId) {
        throw new PmoBusinessError(
          "authorization",
          "You do not have access to this project's financial summary.",
        );
      }
    }
    return this.financials.getByProjectId(projectId);
  }

  public async listFinancials(
    status?: IPmoProjectFinancials["calculationStatus"],
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProjectFinancials>> {
    await this.requireDetailedFinancialAccess();
    return this.financials.getPage(status, continuation);
  }

  public async saveProjectFinancials(
    projectId: number,
    draft: IProjectFinancialDraft,
  ): Promise<IPmoProjectFinancials> {
    await this.requireManageAccess();
    for (const value of [
      draft.projectValue,
      draft.baselineCostBudget,
      draft.approvedCostBudget,
    ]) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new PmoBusinessError(
          "validation",
          "Financial values and budgets must be zero or greater.",
        );
      }
    }
    const project = await this.projects.getById(projectId);
    const existing = await this.financials.getByProjectId(projectId);
    const values = {
      [F.projectFinancials.Title]:
        `${project.projectCode ?? project.id} ${project.title}`,
      [F.projectFinancials.ProjectId]: project.id,
      [F.projectFinancials.ProjectCode]: project.projectCode ?? "",
      [F.projectFinancials.ProjectValue]: draft.projectValue ?? null,
      [F.projectFinancials.CurrencyCode]: project.currencyCode,
      [F.projectFinancials.BaselineCostBudget]:
        draft.baselineCostBudget ?? null,
      [F.projectFinancials.ApprovedCostBudget]:
        draft.approvedCostBudget ?? draft.baselineCostBudget ?? null,
      [F.projectFinancials.ActualCost]: existing?.actualCost ?? 0,
      [F.projectFinancials.ForecastCost]: existing?.forecastCost ?? 0,
      [F.projectFinancials.CalculationStatus]:
        draft.projectValue === undefined ? "Missing Value" : "Complete",
    };
    return existing
      ? this.financials.update(existing.id, values, existing.etag)
      : this.financials.create(values);
  }

  public async recalculateProjectFinancials(
    projectId: number,
    remainingForecastCost?: number,
  ): Promise<IPmoProjectFinancials> {
    await this.requireManageAccess();
    const summary = await this.financials.getByProjectId(projectId);
    if (!summary) {
      throw new PmoBusinessError(
        "validation",
        "Create the project financial summary before recalculating it.",
      );
    }
    const costs = await all((continuation) =>
      this.costs.getApprovedByProject(projectId, continuation),
    );
    const approvedTime = await all((continuation) =>
      this.timeEntries.getApprovedByProject(projectId, continuation),
    );
    let missingRate = false;
    for (const entry of approvedTime) {
      const rows = await all((continuation) =>
        this.costs.getForSourceTimeEntry(entry.id, continuation),
      );
      if (
        !rows.some(
          (cost) => cost.costType === "Labor" && cost.costStatus === "Approved",
        )
      ) {
        missingRate = true;
        break;
      }
    }
    const actualCost = roundMoney(
      costs.reduce((total, cost) => total + cost.amount, 0),
    );
    const remaining =
      remainingForecastCost ??
      Math.max(0, summary.forecastCost - summary.actualCost);
    if (!Number.isFinite(remaining) || remaining < 0) {
      throw new PmoBusinessError(
        "validation",
        "Remaining forecast cost must be zero or greater.",
      );
    }
    const forecastCost = roundMoney(actualCost + remaining);
    const margin =
      summary.projectValue === undefined
        ? undefined
        : calculateMargin(summary.projectValue, forecastCost);
    return this.financials.update(
      summary.id,
      {
        [F.projectFinancials.ActualCost]: actualCost,
        [F.projectFinancials.ForecastCost]: forecastCost,
        [F.projectFinancials.ForecastMarginAmount]: margin?.amount ?? null,
        [F.projectFinancials.ForecastMarginPercent]: margin?.percent ?? null,
        [F.projectFinancials.CalculationStatus]: missingRate
          ? "Missing Rate"
          : summary.projectValue === undefined
            ? "Missing Value"
            : "Complete",
        [F.projectFinancials.CalculatedOn]: this.now().toISOString(),
      },
      summary.etag,
    );
  }

  public async dashboard(): Promise<IFinanceDashboard> {
    await this.requireDetailedFinancialAccess();
    const [financials, projects, unapproved, preview, threshold] =
      await Promise.all([
        all((continuation) => this.financials.getPage(undefined, continuation)),
        all((continuation) => this.projects.getActive(continuation, 100)),
        all((continuation) => this.costs.getUnapproved(continuation)),
        this.buildLaborPreview(100),
        this.marginThreshold(),
      ]);
    const currencies = Array.from(
      new Set(financials.map((item) => item.currencyCode.toUpperCase())),
    );
    if (currencies.length > 1) {
      throw new PmoBusinessError(
        "validation",
        "Portfolio totals require one reporting currency; currency conversion is not configured.",
      );
    }
    const portfolioValue = financials.reduce(
      (total, item) => total + (item.projectValue ?? 0),
      0,
    );
    const actualCost = financials.reduce(
      (total, item) => total + item.actualCost,
      0,
    );
    const forecastCost = financials.reduce(
      (total, item) => total + item.forecastCost,
      0,
    );
    const forecastContribution = portfolioValue - forecastCost;
    return {
      currencyCode: currencies[0] ?? "OMR",
      portfolioValue,
      actualCost,
      forecastCost,
      forecastContribution,
      forecastMarginPercent:
        portfolioValue === 0
          ? undefined
          : (forecastContribution / portfolioValue) * 100,
      belowMarginThreshold: financials.filter(
        (item) =>
          item.projectValue !== undefined &&
          item.projectValue > 0 &&
          item.forecastMarginPercent !== undefined &&
          item.forecastMarginPercent < threshold,
      ).length,
      missingRate: preview.missing.length,
      missingValue:
        financials.filter(
          (item) =>
            item.projectValue === undefined ||
            item.calculationStatus === "Missing Value",
        ).length +
        projects.filter(
          (project) =>
            !financials.some((item) => item.projectId === project.id),
        ).length,
      unapprovedCosts: unapproved.length,
      awaitingCostSynchronization:
        preview.ready.length + preview.missing.length,
      calculatedOn: this.now(),
    };
  }

  public async initializeMissingProjectFinancials(): Promise<number> {
    await this.requireManageAccess();
    const [projects, financials] = await Promise.all([
      all((continuation) => this.projects.getActive(continuation, 100)),
      all((continuation) => this.financials.getPage(undefined, continuation)),
    ]);
    const existingProjectIds = new Set(
      financials.map((item) => item.projectId),
    );
    let created = 0;
    for (const project of projects) {
      if (existingProjectIds.has(project.id)) continue;
      await this.financials.create({
        [F.projectFinancials.Title]:
          `${project.projectCode ?? project.id} ${project.title}`,
        [F.projectFinancials.ProjectId]: project.id,
        [F.projectFinancials.ProjectCode]: project.projectCode ?? "",
        [F.projectFinancials.ProjectValue]: null,
        [F.projectFinancials.CurrencyCode]: project.currencyCode,
        [F.projectFinancials.BaselineCostBudget]: null,
        [F.projectFinancials.ApprovedCostBudget]: null,
        [F.projectFinancials.ActualCost]: 0,
        [F.projectFinancials.ForecastCost]: 0,
        [F.projectFinancials.CalculationStatus]: "Missing Value",
      });
      created += 1;
    }
    return created;
  }

  /** Feature pages call this on unmount. This service intentionally has no data cache. */
  public clearConfidentialData(): void {
    // No-op by design: confidential rows live only in mounted feature state.
  }

  private async buildLaborPreview(limit: number): Promise<ILaborPreview> {
    const entries = await this.timeEntries.getApprovedForCostSync(
      undefined,
      Math.min(Math.max(limit, 1), 100),
    );
    const ready: ILaborPreview["ready"][number][] = [];
    const missing: IMissingRateItem[] = [];
    let skipped = 0;
    for (const entry of entries.items) {
      if (entry.projectId === undefined) {
        skipped += 1;
        continue;
      }
      const costs = await all((continuation) =>
        this.costs.getForSourceTimeEntry(entry.id, continuation),
      );
      if (
        costs.some(
          (cost) => cost.costType === "Labor" && cost.costStatus === "Approved",
        )
      ) {
        skipped += 1;
        continue;
      }
      const project = await this.projects.getById(entry.projectId);
      const rate = await this.resolveEffectiveRate(entry, project);
      if ("rate" in rate) ready.push({ entry, project, rate: rate.rate });
      else missing.push(rate.missing);
    }
    return { ready, missing, skipped };
  }

  private async resolveEffectiveRate(
    entry: IPmoTimeEntry,
    project: IPmoProject,
  ): Promise<
    { readonly rate: IPmoEmployeeRate } | { readonly missing: IMissingRateItem }
  > {
    const result = await this.rates.getEffectiveForEmployee(
      entry.employeeId,
      entry.workDate,
    );
    const base = {
      timeEntryId: entry.id,
      projectId: project.id,
      employeeId: entry.employeeId,
      workDate: entry.workDate,
    };
    if (!result.items.length) {
      return { missing: { ...base, reason: "Missing rate" } };
    }
    if (result.items.length > 1) {
      return { missing: { ...base, reason: "Overlapping rates" } };
    }
    const rate = result.items[0] as IPmoEmployeeRate;
    if (
      rate.currencyCode.toUpperCase() !== project.currencyCode.toUpperCase()
    ) {
      return { missing: { ...base, reason: "Currency mismatch" } };
    }
    return { rate };
  }

  private async createApprovedLaborCost(
    entry: IPmoTimeEntry,
    project: IPmoProject,
    rate: IPmoEmployeeRate,
    approverId: number,
    reversalOfCostId?: number,
  ): Promise<IPmoProjectCost> {
    const amount = roundMoney(
      calculateLaborCost(
        entry.hours,
        rate.costRate,
        rate.rateType,
        await this.personDayHours(),
      ),
    );
    const created = await this.costs.create({
      [F.projectCosts.Title]:
        `${project.projectCode ?? project.id} labor ${entry.id}`,
      [F.projectCosts.CostNumber]: `PENDING-${this.now().valueOf()}`,
      [F.projectCosts.ProjectId]: project.id,
      [F.projectCosts.ProjectCode]: project.projectCode ?? "",
      [F.projectCosts.CostType]: "Labor",
      [F.projectCosts.SourceTimeEntryId]: entry.id,
      [F.projectCosts.CostDate]: entry.workDate.toISOString(),
      [F.projectCosts.EmployeeId]: entry.employeeId,
      [F.projectCosts.Amount]: amount,
      [F.projectCosts.CurrencyCode]: project.currencyCode,
      [F.projectCosts.Description]: "Approved labor cost synchronization",
      [F.projectCosts.CostStatus]: "Approved",
      [`${F.projectCosts.ApprovedBy}Id`]: approverId,
      [F.projectCosts.ApprovedOn]: this.now().toISOString(),
      [F.projectCosts.ReversalOfCostId]: reversalOfCostId ?? null,
    });
    return this.costs.update(
      created.id,
      { [F.projectCosts.CostNumber]: this.costNumber(created.id) },
      created.etag,
    );
  }

  private async reverseApprovedCost(
    cost: IPmoProjectCost,
    reason: string,
  ): Promise<IPmoProjectCost> {
    if (cost.costStatus !== "Approved") {
      throw new PmoBusinessError(
        "validation",
        "Only an approved cost can be reversed.",
      );
    }
    if (!reason.trim()) {
      throw new PmoBusinessError(
        "validation",
        "A reversal reason is required.",
      );
    }
    const reversed = await this.costs.update(
      cost.id,
      {
        [F.projectCosts.CostStatus]: "Reversed",
        [F.projectCosts.Description]:
          `${cost.description}\nReversed: ${reason.trim()}`,
      },
      cost.etag,
    );
    try {
      const marker = await this.costs.create({
        [F.projectCosts.Title]: `${cost.projectCode} reversal ${cost.id}`,
        [F.projectCosts.CostNumber]: `PENDING-${this.now().valueOf()}`,
        [F.projectCosts.ProjectId]: cost.projectId,
        [F.projectCosts.ProjectCode]: cost.projectCode,
        [F.projectCosts.CostType]: cost.costType,
        [F.projectCosts.SourceTimeEntryId]: cost.sourceTimeEntryId ?? null,
        [F.projectCosts.CostDate]: this.now().toISOString(),
        [F.projectCosts.EmployeeId]: cost.employeeId ?? null,
        [F.projectCosts.Amount]: cost.amount,
        [F.projectCosts.CurrencyCode]: cost.currencyCode,
        [F.projectCosts.Description]: `Reversal record: ${reason.trim()}`,
        [F.projectCosts.CostStatus]: "Reversed",
        [F.projectCosts.ReversalOfCostId]: cost.id,
      });
      return this.costs.update(
        marker.id,
        { [F.projectCosts.CostNumber]: this.costNumber(marker.id) },
        marker.etag,
      );
    } catch (error) {
      await this.costs.update(
        reversed.id,
        {
          [F.projectCosts.CostStatus]: "Approved",
          [F.projectCosts.Description]: cost.description,
        },
        reversed.etag,
      );
      throw error;
    }
  }

  private validateRateDraft(
    draft: IEmployeeRateDraft,
    start: Date,
    end: Date | undefined,
  ): void {
    if (!Number.isInteger(draft.employeeId) || draft.employeeId <= 0) {
      throw new PmoBusinessError("validation", "Select an employee.");
    }
    if (!Number.isFinite(draft.costRate) || draft.costRate < 0) {
      throw new PmoBusinessError(
        "validation",
        "Cost rate must be zero or greater.",
      );
    }
    if (!/^[A-Za-z]{3}$/.test(draft.currencyCode.trim())) {
      throw new PmoBusinessError(
        "validation",
        "Currency must be a three-letter code.",
      );
    }
    if (end && end < start) {
      throw new PmoBusinessError(
        "validation",
        "Effective to cannot be earlier than effective from.",
      );
    }
  }

  private costNumber(id: number): string {
    return `CST-${this.now().getUTCFullYear()}-${`00000${id}`.slice(-5)}`;
  }

  private async requireDetailedFinancialAccess(): Promise<IPmoResolvedUserContext> {
    const actor = await this.capabilities.resolveCurrent();
    if (!canReadRestrictedFinancials(actor)) {
      throw new PmoBusinessError(
        "authorization",
        "You do not have access to restricted financial data.",
      );
    }
    return actor;
  }

  private async requireManageAccess(): Promise<IPmoResolvedUserContext> {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.capabilities.has("finance.manage")) {
      throw new PmoBusinessError(
        "authorization",
        "You do not have permission to manage financial data.",
      );
    }
    return actor;
  }
}
