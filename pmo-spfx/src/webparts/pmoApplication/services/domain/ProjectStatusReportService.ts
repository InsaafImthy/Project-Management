import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type { IPmoProject, IPmoProjectStatusReport } from "../../models/domain";
import type { IRepositoryPage } from "../repositories/contracts";
import type {
  ProjectStatusReportsRepository,
  ProjectsRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import {
  assertCapability,
  type UserCapabilityService,
} from "./UserCapabilityService";

const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const startOfWeek = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const mondayOffset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);
  return result;
};

export interface IStatusReportDraft {
  readonly projectId: number;
  readonly projectCode: string;
  readonly title: string;
  readonly reportingDate: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly overallStatus: IPmoProjectStatusReport["overallStatus"];
  readonly percentComplete: number;
  readonly forecastEnd?: string;
  readonly forecastEffortHours?: number;
  readonly highlights: string;
  readonly risksIssuesSummary: string;
  readonly decisionsRequired?: string;
  readonly nextSteps: string;
}

export const validateStatusReport = (
  draft: IStatusReportDraft,
): Readonly<Record<string, string>> => {
  const errors: Record<string, string> = {};
  if (!draft.projectId) errors.projectId = "A project is required.";
  if (!draft.highlights.trim()) errors.highlights = "Highlights are required.";
  if (!draft.risksIssuesSummary.trim())
    errors.risksIssuesSummary = "A risks and issues narrative is required.";
  if (!draft.nextSteps.trim()) errors.nextSteps = "Next steps are required.";
  if (draft.percentComplete < 0 || draft.percentComplete > 100)
    errors.percentComplete = "Percent complete must be between 0 and 100.";
  if (new Date(draft.periodStart) > new Date(draft.periodEnd))
    errors.periodEnd = "Period end must not precede period start.";
  return errors;
};

/** Periodic project snapshot service. Persisted operational values never refresh. */
export class ProjectStatusReportService {
  public constructor(
    private readonly reports: ProjectStatusReportsRepository,
    private readonly projects: ProjectsRepository,
    private readonly workItems: WorkItemsRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(
    filters: Parameters<ProjectStatusReportsRepository["getPage"]>[0],
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProjectStatusReport>> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.view");
    return this.reports.getPage(filters, continuation);
  }

  public async get(id: number): Promise<IPmoProjectStatusReport> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.view");
    return this.reports.getById(id);
  }

  /** Creates an unsaved editor model; narrative fields are intentionally blank. */
  public async prepareCurrentPeriod(
    projectId: number,
  ): Promise<IStatusReportDraft> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
    const [project, workItems] = await Promise.all([
      this.projects.getById(projectId),
      this.workItems.getByProject(projectId),
    ]);
    const start = startOfWeek(this.now());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const percentComplete = this.operationalPercent(project, workItems.items);
    return {
      projectId: project.id,
      projectCode: project.projectCode ?? "",
      title: `${project.projectCode ?? project.title} status ${dateOnly(end)}`,
      reportingDate: dateOnly(this.now()),
      periodStart: dateOnly(start),
      periodEnd: dateOnly(end),
      overallStatus:
        project.overallHealth === "Red"
          ? "Red"
          : project.overallHealth === "Amber"
            ? "Amber"
            : "Green",
      percentComplete,
      forecastEnd: project.forecastEnd
        ? dateOnly(project.forecastEnd)
        : dateOnly(project.currentApprovedEnd),
      forecastEffortHours:
        project.forecastEffortHours ?? project.approvedEffortHours,
      highlights: "",
      risksIssuesSummary: "",
      decisionsRequired: "",
      nextSteps: "",
    };
  }

  public async saveDraft(
    draft: IStatusReportDraft,
    existing?: IPmoProjectStatusReport,
  ): Promise<IPmoProjectStatusReport> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
    const validation = validateStatusReport(draft);
    const firstKey = Object.keys(validation)[0];
    const first = firstKey ? validation[firstKey] : undefined;
    if (first) throw new Error(first);
    if (existing && existing.reportStatus !== "Draft")
      throw new Error("Submitted and approved report snapshots are immutable.");
    const narrative = {
      [F.projectStatusReports.Highlights]: draft.highlights.trim(),
      [F.projectStatusReports.RisksIssuesSummary]:
        draft.risksIssuesSummary.trim(),
      [F.projectStatusReports.DecisionsRequired]:
        draft.decisionsRequired?.trim() || null,
      [F.projectStatusReports.NextSteps]: draft.nextSteps.trim(),
    };
    if (existing)
      return this.reports.update(existing.id, narrative, existing.etag);
    return this.reports.create({
      [F.projectStatusReports.Title]: draft.title,
      [F.projectStatusReports.ProjectId]: draft.projectId,
      [F.projectStatusReports.ProjectCode]: draft.projectCode,
      [F.projectStatusReports.ReportingDate]: new Date(
        `${draft.reportingDate}T00:00:00`,
      ).toISOString(),
      [F.projectStatusReports.PeriodStart]: new Date(
        `${draft.periodStart}T00:00:00`,
      ).toISOString(),
      [F.projectStatusReports.PeriodEnd]: new Date(
        `${draft.periodEnd}T00:00:00`,
      ).toISOString(),
      [F.projectStatusReports.OverallStatus]: draft.overallStatus,
      [F.projectStatusReports.PercentComplete]: draft.percentComplete,
      [F.projectStatusReports.ForecastEnd]: draft.forecastEnd
        ? new Date(`${draft.forecastEnd}T00:00:00`).toISOString()
        : null,
      [F.projectStatusReports.ForecastEffortHours]:
        draft.forecastEffortHours ?? null,
      ...narrative,
      [F.projectStatusReports.ReportStatus]: "Draft",
    });
  }

  public async submit(
    report: IPmoProjectStatusReport,
  ): Promise<IPmoProjectStatusReport> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
    if (report.reportStatus !== "Draft")
      throw new Error("Only a draft report can be submitted.");
    const validation = validateStatusReport(this.toDraft(report));
    const firstKey = Object.keys(validation)[0];
    const first = firstKey ? validation[firstKey] : undefined;
    if (first) throw new Error(first);
    return this.reports.update(
      report.id,
      {
        [F.projectStatusReports.ReportStatus]: "Submitted",
        [`${F.projectStatusReports.SubmittedBy}Id`]: actor.sharePointUserId,
        [F.projectStatusReports.SubmittedOn]: this.now().toISOString(),
      },
      report.etag,
    );
  }

  public async approve(
    report: IPmoProjectStatusReport,
  ): Promise<IPmoProjectStatusReport> {
    const actor = await this.capabilities.resolveCurrent();
    if (
      !actor.capabilities.has("approvals.decide") &&
      !actor.securityRoles.has("owner")
    )
      throw new Error("Only an in-app approver may approve a status report.");
    if (report.reportStatus !== "Submitted")
      throw new Error("Only a submitted report can be approved.");
    if (report.submittedBy?.id === actor.sharePointUserId)
      throw new Error("The report author cannot approve the same report.");
    return this.reports.update(
      report.id,
      {
        [F.projectStatusReports.ReportStatus]: "Approved",
        [`${F.projectStatusReports.ApprovedBy}Id`]: actor.sharePointUserId,
        [F.projectStatusReports.ApprovedOn]: this.now().toISOString(),
      },
      report.etag,
    );
  }

  private operationalPercent(
    project: IPmoProject,
    workItems: readonly {
      readonly itemType: string;
      readonly percentComplete: number;
    }[],
  ): number {
    const tasks = workItems.filter(
      (item) => item.itemType === "Task" || item.itemType === "Subtask",
    );
    if (!tasks.length) return project.percentComplete;
    return Math.round(
      tasks.reduce((sum, task) => sum + task.percentComplete, 0) / tasks.length,
    );
  }

  private toDraft(report: IPmoProjectStatusReport): IStatusReportDraft {
    return {
      projectId: report.projectId,
      projectCode: report.projectCode,
      title: report.title,
      reportingDate: dateOnly(report.reportingDate),
      periodStart: dateOnly(report.periodStart),
      periodEnd: dateOnly(report.periodEnd),
      overallStatus: report.overallStatus,
      percentComplete: report.percentComplete,
      forecastEnd: report.forecastEnd
        ? dateOnly(report.forecastEnd)
        : undefined,
      forecastEffortHours: report.forecastEffortHours,
      highlights: report.highlights,
      risksIssuesSummary: report.risksIssuesSummary,
      decisionsRequired: report.decisionsRequired,
      nextSteps: report.nextSteps,
    };
  }
}
