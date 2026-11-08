import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type {
  IPmoProject,
  IPmoQualityItem,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../../models/domain";
import type {
  ProjectCostsRepository,
  ProjectFinancialsRepository,
  ProjectsRepository,
  QualityItemsRepository,
  TimeEntriesRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import type { IPmoResolvedUserContext } from "./UserCapabilityService";
import {
  canReadRestrictedFinancials,
  hasCapability,
} from "./UserCapabilityService";
import {
  calculateEffortVariance,
  calculateMargin,
  calculatePercentComplete,
  calculateScheduleVarianceDays,
  evaluateProjectHealth,
} from "./DomainRules";

export interface IProjectMetricsResult {
  readonly projectId: number;
  readonly percentComplete: number;
  readonly actualEffortHours: number;
  readonly forecastEffortHours: number;
  readonly overallHealth: "Green" | "Amber" | "Red" | "Not Set";
  readonly financialsRecalculated: boolean;
  readonly warnings: readonly string[];
  readonly healthDrivers: readonly string[];
}

export class MetricsService {
  public constructor(
    private readonly projects: Pick<ProjectsRepository, "getById" | "update">,
    private readonly workItems: Pick<WorkItemsRepository, "getByProject">,
    private readonly timeEntries: Pick<
      TimeEntriesRepository,
      "getApprovedByProject"
    >,
    private readonly qualityItems: Pick<QualityItemsRepository, "getByProject">,
    private readonly projectCosts: Pick<
      ProjectCostsRepository,
      "getApprovedByProject"
    >,
    private readonly financials: Pick<
      ProjectFinancialsRepository,
      "getByProjectId" | "update"
    >,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async refreshProject(
    projectId: number,
    actor: IPmoResolvedUserContext,
    includeFinancials = false,
  ): Promise<IProjectMetricsResult> {
    if (
      !hasCapability(actor, "projects.manage") &&
      !actor.securityRoles.has("owner")
    ) {
      throw new Error(
        "Project metric refresh requires project management access.",
      );
    }
    const project = await this.projects.getById(projectId);
    const warnings: string[] = [];
    const workItems = await this.loadAllWorkItems(projectId);
    const timeEntries = await this.loadAllApprovedTime(projectId);
    const qualityItems = await this.loadAllQuality(projectId);
    const actualEffortHours = timeEntries.reduce(
      (total, entry) => total + entry.hours,
      0,
    );
    if (workItems.some((item) => item.approvedEffortHours === undefined)) {
      warnings.push("One or more work items are missing approved effort.");
    }
    if (workItems.some((item) => !item.plannedEnd)) {
      warnings.push("One or more work items are missing planned end dates.");
    }
    const percentComplete = calculatePercentComplete(workItems);
    const forecastEffortHours = workItems.reduce(
      (total, item) =>
        total +
        (item.forecastEffortHours ??
          Math.max(item.actualEffortHours, item.approvedEffortHours ?? 0)),
      0,
    );
    const effortVariance = calculateEffortVariance(
      forecastEffortHours,
      project.approvedEffortHours,
    );
    const effortVariancePercent =
      project.approvedEffortHours > 0
        ? (effortVariance / project.approvedEffortHours) * 100
        : undefined;
    const forecastEnd = this.latestForecastEnd(project, workItems);
    const scheduleVarianceDays = calculateScheduleVarianceDays(
      forecastEnd,
      project.currentApprovedEnd,
    );
    const criticalBlockedCount = workItems.filter(
      (item) => item.isCritical && item.status === "Blocked",
    ).length;
    const criticalQualityCount = qualityItems.filter(
      (item) =>
        item.severity === "Critical" &&
        item.status !== "Closed" &&
        item.status !== "Passed" &&
        item.status !== "Approved Exception",
    ).length;
    const health = evaluateProjectHealth({
      scheduleVarianceDays,
      effortVariancePercent,
      criticalBlockedCount,
      criticalQualityCount,
      hasIncompleteMetrics: warnings.length > 0,
    });
    await this.projects.update(
      project.id,
      {
        [F.projects.ActualEffortHours]: actualEffortHours,
        [F.projects.ForecastEffortHours]: forecastEffortHours,
        [F.projects.PercentComplete]: percentComplete,
        [F.projects.ForecastEnd]: forecastEnd?.toISOString(),
        [F.projects.OverallHealth]: health.health,
        [F.projects.MetricsCalculatedOn]: this.now().toISOString(),
      },
      project.etag,
    );

    let financialsRecalculated = false;
    if (includeFinancials) {
      if (!canReadRestrictedFinancials(actor)) {
        throw new Error(
          "Financial metric refresh requires restricted financial access.",
        );
      }
      await this.refreshFinancials(project, warnings);
      financialsRecalculated = true;
    }
    return {
      projectId,
      percentComplete,
      actualEffortHours,
      forecastEffortHours,
      overallHealth: health.health,
      financialsRecalculated,
      warnings,
      healthDrivers: health.drivers.map((driver) => driver.message),
    };
  }

  public async refreshProjects(
    projectIds: readonly number[],
    actor: IPmoResolvedUserContext,
    includeFinancials = false,
  ): Promise<readonly IProjectMetricsResult[]> {
    if (
      !actor.securityRoles.has("owner") &&
      !actor.securityRoles.has("finance") &&
      !actor.securityRoles.has("executive")
    ) {
      throw new Error(
        "Multi-project refresh requires an authorized portfolio role.",
      );
    }
    if (projectIds.length > 50) {
      throw new Error(
        "Refresh at most 50 explicitly selected projects at once.",
      );
    }
    const results: IProjectMetricsResult[] = [];
    for (const projectId of projectIds) {
      results.push(
        await this.refreshProject(projectId, actor, includeFinancials),
      );
    }
    return results;
  }

  private async loadAllWorkItems(projectId: number): Promise<IPmoWorkItem[]> {
    const values: IPmoWorkItem[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.workItems.getByProject(projectId, continuation);
      values.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    return values;
  }

  private async loadAllApprovedTime(
    projectId: number,
  ): Promise<IPmoTimeEntry[]> {
    const values: IPmoTimeEntry[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.timeEntries.getApprovedByProject(
        projectId,
        continuation,
      );
      values.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    return values;
  }

  private async loadAllQuality(projectId: number): Promise<IPmoQualityItem[]> {
    const values: IPmoQualityItem[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.qualityItems.getByProject(
        projectId,
        continuation,
      );
      values.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    return values;
  }

  private latestForecastEnd(
    project: IPmoProject,
    workItems: Awaited<ReturnType<MetricsService["loadAllWorkItems"]>>,
  ): Date | undefined {
    const candidates = workItems
      .map((item) => item.plannedEnd)
      .filter((date): date is Date => date !== undefined);
    if (project.forecastEnd) candidates.push(project.forecastEnd);
    return candidates.length > 0
      ? new Date(Math.max(...candidates.map((date) => date.valueOf())))
      : undefined;
  }

  private async refreshFinancials(
    project: IPmoProject,
    warnings: string[],
  ): Promise<void> {
    const summary = await this.financials.getByProjectId(project.id);
    if (!summary) {
      warnings.push("Project financial summary is missing.");
      return;
    }
    const costs = [];
    let continuation: string | undefined;
    do {
      const page = await this.projectCosts.getApprovedByProject(
        project.id,
        continuation,
      );
      costs.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    const actualCost = costs.reduce((total, cost) => total + cost.amount, 0);
    const forecastCost = Math.max(actualCost, summary.forecastCost);
    const projectValue = summary.projectValue;
    const status = projectValue === undefined ? "Missing Value" : "Complete";
    if (projectValue === undefined) {
      warnings.push("Project value is missing; margin was not calculated.");
    }
    const margin =
      projectValue === undefined
        ? undefined
        : calculateMargin(projectValue, forecastCost);
    await this.financials.update(
      summary.id,
      {
        [F.projectFinancials.ActualCost]: actualCost,
        [F.projectFinancials.ForecastCost]: forecastCost,
        [F.projectFinancials.ForecastMarginAmount]: margin?.amount,
        [F.projectFinancials.ForecastMarginPercent]: margin?.percent,
        [F.projectFinancials.CalculationStatus]: status,
        [F.projectFinancials.CalculatedOn]: this.now().toISOString(),
      },
      summary.etag,
    );
  }
}
