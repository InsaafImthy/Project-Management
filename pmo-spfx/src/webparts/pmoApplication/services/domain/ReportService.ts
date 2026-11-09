import type {
  IPmoApprovalRequest,
  IPmoChangeRequest,
  IPmoProject,
  IPmoProjectFinancials,
  IPmoProjectStatusReport,
  IPmoQualityItem,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../../models/domain";
import type {
  ApprovalRequestsRepository,
  ChangeRequestsRepository,
  LearningAssignmentsRepository,
  ProjectFinancialsRepository,
  ProjectMembersRepository,
  ProjectsRepository,
  ProjectStatusReportsRepository,
  QualityItemsRepository,
  TimeEntriesRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import { PmoBusinessError } from "./ConfigurationManagementService";
import type { ResourceManagementService } from "./ResourceManagementService";
import type { UserCapabilityService } from "./UserCapabilityService";
import {
  canReadRestrictedFinancials,
  hasCapability,
} from "./UserCapabilityService";

export type PmoReportKey =
  | "project-status"
  | "portfolio"
  | "work-items"
  | "time-compliance"
  | "utilization"
  | "changes-approvals"
  | "quality"
  | "employee-contribution"
  | "project-closure"
  | "financials";

export interface IReportFilters {
  readonly projectId?: number;
  readonly employeeId?: number;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly status?: string;
}

export interface IReportColumn {
  readonly key: string;
  readonly label: string;
}

export interface IReportRow {
  readonly id: string;
  readonly values: Readonly<
    Record<string, string | number | boolean | undefined>
  >;
  readonly route?: Readonly<Record<string, string>>;
}

export interface IReportResult {
  readonly key: PmoReportKey;
  readonly name: string;
  readonly asOf: Date;
  readonly confidentiality: "Internal" | "Restricted";
  readonly columns: readonly IReportColumn[];
  readonly rows: readonly IReportRow[];
  readonly filters: IReportFilters;
  readonly printFriendly: boolean;
}

const reportNames: Readonly<Record<PmoReportKey, string>> = {
  "project-status": "Project status report",
  portfolio: "Portfolio report",
  "work-items": "Work items report",
  "time-compliance": "Time entries and compliance report",
  utilization: "Utilization report",
  "changes-approvals": "Change requests and approvals report",
  quality: "Quality report",
  "employee-contribution": "Employee contribution report",
  "project-closure": "Project closure report",
  financials: "Financial report",
};

const MAX_REPORT_ROWS = 1000;

const all = async <T>(
  page: (continuation?: string) => Promise<{
    readonly items: readonly T[];
    readonly continuation?: string;
  }>,
): Promise<T[]> => {
  const values: T[] = [];
  let continuation: string | undefined;
  do {
    const result = await page(continuation);
    if (values.length + result.items.length > MAX_REPORT_ROWS) {
      throw new PmoBusinessError(
        "validation",
        `This report exceeds ${MAX_REPORT_ROWS} rows. Narrow the project, employee, status, or date filters and run it again.`,
      );
    }
    values.push(...result.items);
    continuation = result.continuation;
    if (continuation && values.length >= MAX_REPORT_ROWS) {
      throw new PmoBusinessError(
        "validation",
        `This report exceeds ${MAX_REPORT_ROWS} rows. Narrow the project, employee, status, or date filters and run it again.`,
      );
    }
  } while (continuation);
  return values;
};

const date = (value?: Date): string => value?.toISOString().slice(0, 10) ?? "";
const value = (number?: number): string | number => number ?? "Data incomplete";

export class ReportService {
  public constructor(
    private readonly projects: ProjectsRepository,
    private readonly workItems: WorkItemsRepository,
    private readonly timeEntries: TimeEntriesRepository,
    private readonly changes: ChangeRequestsRepository,
    private readonly approvals: ApprovalRequestsRepository,
    private readonly quality: QualityItemsRepository,
    private readonly statusReports: ProjectStatusReportsRepository,
    private readonly financials: ProjectFinancialsRepository,
    private readonly members: ProjectMembersRepository,
    private readonly learning: LearningAssignmentsRepository,
    private readonly resources: ResourceManagementService,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async run(
    key: PmoReportKey,
    filters: IReportFilters,
  ): Promise<IReportResult> {
    const actor = await this.capabilities.resolveCurrent();
    if (key === "financials" && !canReadRestrictedFinancials(actor)) {
      throw new PmoBusinessError(
        "authorization",
        "Restricted financial exports require Finance, Executive, or PMO Owner access.",
      );
    }
    const operational =
      hasCapability(actor, "projects.view") ||
      hasCapability(actor, "work.view-own") ||
      hasCapability(actor, "quality.view") ||
      hasCapability(actor, "resources.view");
    if (!operational && key !== "financials") {
      throw new PmoBusinessError(
        "authorization",
        "You do not have access to operational reports.",
      );
    }
    if (
      ["project-status", "portfolio", "project-closure"].indexOf(key) >= 0 &&
      !hasCapability(actor, "projects.view")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "Project reporting requires project view access.",
      );
    }
    if (key === "quality" && !hasCapability(actor, "quality.view")) {
      throw new PmoBusinessError(
        "authorization",
        "Quality reporting requires quality view access.",
      );
    }
    if (key === "utilization" && !hasCapability(actor, "resources.view")) {
      throw new PmoBusinessError(
        "authorization",
        "Utilization reporting requires resource view access.",
      );
    }
    if (
      key === "work-items" &&
      (filters.projectId !== undefined ||
        (filters.employeeId !== undefined &&
          filters.employeeId !== actor.employee?.id)) &&
      !hasCapability(actor, "projects.view")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "Cross-project work-item reporting requires project view access.",
      );
    }
    if (
      key === "time-compliance" &&
      (filters.projectId !== undefined ||
        (filters.employeeId !== undefined &&
          filters.employeeId !== actor.employee?.id)) &&
      !hasCapability(actor, "time.review")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "Other employees' time evidence requires time-review access.",
      );
    }
    if (
      key === "employee-contribution" &&
      filters.employeeId !== undefined &&
      filters.employeeId !== actor.employee?.id &&
      !hasCapability(actor, "resources.view")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "Other employees' contribution reports require resource view access.",
      );
    }
    if (
      key === "changes-approvals" &&
      (filters.projectId !== undefined || filters.status !== undefined) &&
      !hasCapability(actor, "approvals.view") &&
      !hasCapability(actor, "projects.manage")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "Cross-project change and approval reporting requires approval or project-management access.",
      );
    }
    const loaded = await this.load(
      key,
      filters,
      actor.employee?.id,
      actor.sharePointUserId,
    );
    return {
      key,
      name: reportNames[key],
      asOf: this.now(),
      confidentiality: key === "financials" ? "Restricted" : "Internal",
      filters,
      printFriendly: key === "project-status" || key === "project-closure",
      ...loaded,
    };
  }

  private async load(
    key: PmoReportKey,
    filters: IReportFilters,
    ownEmployeeId: number | undefined,
    sharePointUserId: number,
  ): Promise<Pick<IReportResult, "columns" | "rows">> {
    switch (key) {
      case "project-status":
        return this.projectStatus(filters);
      case "portfolio":
        return this.portfolio(filters);
      case "work-items":
        return this.workItemReport(filters, ownEmployeeId);
      case "time-compliance":
        return this.timeReport(filters, ownEmployeeId);
      case "utilization":
        return this.utilization(filters);
      case "changes-approvals":
        return this.changeReport(filters, sharePointUserId);
      case "quality":
        return this.qualityReport(filters);
      case "employee-contribution":
        return this.contribution(filters, ownEmployeeId);
      case "project-closure":
        return this.closure(filters);
      case "financials":
        return this.financialReport(filters);
    }
  }

  private async projectStatus(filters: IReportFilters) {
    const items = await all<IPmoProjectStatusReport>((continuation) =>
      this.statusReports.getPage(
        {
          projectId: filters.projectId,
          periodStart: filters.dateFrom,
          periodEnd: filters.dateTo,
          reportStatus: filters.status as
            | IPmoProjectStatusReport["reportStatus"]
            | undefined,
        },
        continuation,
      ),
    );
    const columns = [
      { key: "project", label: "Project" },
      { key: "reportingDate", label: "Reporting date" },
      { key: "status", label: "Status" },
      { key: "completion", label: "Completion %" },
      { key: "forecastEnd", label: "Forecast end" },
      { key: "forecastEffort", label: "Forecast effort" },
      { key: "highlights", label: "Highlights" },
      { key: "risks", label: "Risks and issues" },
      { key: "decisions", label: "Decisions required" },
    ];
    return {
      columns,
      rows: items.map((item) => ({
        id: String(item.id),
        values: {
          project: item.projectCode,
          reportingDate: date(item.reportingDate),
          status: `${item.overallStatus} / ${item.reportStatus}`,
          completion: item.percentComplete,
          forecastEnd: date(item.forecastEnd),
          forecastEffort: value(item.forecastEffortHours),
          highlights: item.highlights,
          risks: item.risksIssuesSummary,
          decisions: item.decisionsRequired,
        },
        route: { view: "status-report-detail", reportId: String(item.id) },
      })),
    };
  }

  private async portfolio(filters: IReportFilters) {
    const items = await all<IPmoProject>((continuation) =>
      this.projects.getPage(
        {
          status: filters.status as IPmoProject["status"] | undefined,
          isActive: filters.status === "Closed" ? false : true,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        },
        continuation,
        100,
      ),
    );
    const columns = [
      { key: "code", label: "Code" },
      { key: "project", label: "Project" },
      { key: "manager", label: "Manager" },
      { key: "status", label: "Status" },
      { key: "health", label: "Health" },
      { key: "completion", label: "Completion %" },
      { key: "baselineEnd", label: "Baseline end" },
      { key: "approvedEnd", label: "Approved end" },
      { key: "forecastEnd", label: "Forecast end" },
      { key: "baselineEffort", label: "Baseline effort" },
      { key: "approvedEffort", label: "Approved effort" },
      { key: "actualEffort", label: "Actual effort" },
      { key: "forecastEffort", label: "Forecast effort" },
    ];
    return {
      columns,
      rows: items.map((item) => ({
        id: String(item.id),
        values: {
          code: item.projectCode,
          project: item.title,
          manager: item.projectManager.displayName,
          status: item.status,
          health: item.overallHealth,
          completion: item.percentComplete,
          baselineEnd: date(item.baselineEnd),
          approvedEnd: date(item.currentApprovedEnd),
          forecastEnd: date(item.forecastEnd),
          baselineEffort: item.baselineEffortHours,
          approvedEffort: item.approvedEffortHours,
          actualEffort: item.actualEffortHours,
          forecastEffort: value(item.forecastEffortHours),
        },
        route: { view: "project-overview", projectId: String(item.id) },
      })),
    };
  }

  private async workItemReport(
    filters: IReportFilters,
    ownEmployeeId?: number,
  ) {
    const employeeId =
      filters.employeeId ?? (!filters.projectId ? ownEmployeeId : undefined);
    if (!filters.projectId && !employeeId) {
      throw new PmoBusinessError(
        "validation",
        "Enter a project ID or employee ID.",
      );
    }
    const items = await all<IPmoWorkItem>((continuation) =>
      filters.projectId
        ? this.workItems.getByProject(filters.projectId, continuation)
        : this.workItems.getAssignedTo(employeeId as number, continuation),
    );
    const filtered = filters.status
      ? items.filter((item) => item.status === filters.status)
      : items;
    const columns = [
      { key: "project", label: "Project" },
      { key: "item", label: "Work item" },
      { key: "type", label: "Type" },
      { key: "owner", label: "Owner" },
      { key: "status", label: "Status" },
      { key: "start", label: "Start" },
      { key: "end", label: "End" },
      { key: "approved", label: "Approved effort" },
      { key: "actual", label: "Actual effort" },
      { key: "remaining", label: "Remaining effort" },
    ];
    return {
      columns,
      rows: filtered.map((item) => ({
        id: String(item.id),
        values: {
          project: item.projectCode,
          item: item.title,
          type: item.itemType,
          owner: item.assignedTo?.displayName,
          status: item.status,
          start: date(item.plannedStart),
          end: date(item.plannedEnd),
          approved: value(item.approvedEffortHours),
          actual: item.actualEffortHours,
          remaining: Math.max(
            0,
            (item.forecastEffortHours ?? item.approvedEffortHours ?? 0) -
              item.actualEffortHours,
          ),
        },
        route: { view: "task", workItemId: String(item.id) },
      })),
    };
  }

  private async timeReport(filters: IReportFilters, ownEmployeeId?: number) {
    const start =
      filters.dateFrom ?? new Date(this.now().valueOf() - 6 * 86400000);
    const end = filters.dateTo ?? this.now();
    const employeeId =
      filters.employeeId ?? (!filters.projectId ? ownEmployeeId : undefined);
    const entries = await all<IPmoTimeEntry>((continuation) =>
      filters.projectId
        ? this.timeEntries.getProjectRange(
            filters.projectId,
            start,
            end,
            continuation,
          )
        : employeeId
          ? this.timeEntries.getEmployeeRange(
              employeeId,
              start,
              end,
              continuation,
            )
          : this.timeEntries.getRange(start, end, continuation),
    );
    const columns = [
      { key: "date", label: "Work date" },
      { key: "employee", label: "Employee" },
      { key: "project", label: "Project" },
      { key: "category", label: "Category" },
      { key: "hours", label: "Recorded hours" },
      { key: "status", label: "Status" },
      { key: "correction", label: "Correction" },
    ];
    return {
      columns,
      rows: entries
        .filter(
          (entry) => !filters.status || entry.entryStatus === filters.status,
        )
        .map((entry) => ({
          id: String(entry.id),
          values: {
            date: date(entry.workDate),
            employee: entry.employeeUser.displayName,
            project: entry.projectCode ?? "Non-project",
            category: entry.workCategory,
            hours: entry.hours,
            status: entry.entryStatus,
            correction: entry.correctionReason,
          },
        })),
    };
  }

  private async utilization(filters: IReportFilters) {
    const start = filters.dateFrom ?? this.now();
    const end = filters.dateTo ?? new Date(start.valueOf() + 30 * 86400000);
    const dashboard = await this.resources.dashboard(start, end);
    const columns = [
      { key: "employee", label: "Employee" },
      { key: "department", label: "Department" },
      { key: "capacity", label: "Capacity %" },
      { key: "allocation", label: "Allocation %" },
      { key: "availability", label: "Availability" },
      { key: "warnings", label: "Warnings" },
    ];
    return {
      columns,
      rows: dashboard.rows
        .filter(
          (row) =>
            !filters.employeeId || row.employee.id === filters.employeeId,
        )
        .map((row) => ({
          id: String(row.employee.id),
          values: {
            employee: row.employee.name,
            department: row.employee.department,
            capacity: row.capacityPercent,
            allocation: row.allocationPercent,
            availability: row.availability,
            warnings: row.warnings.join(" "),
          },
          route: { view: "employee", employeeId: String(row.employee.id) },
        })),
    };
  }

  private async changeReport(filters: IReportFilters, userId: number) {
    const changes = await all<IPmoChangeRequest>((continuation) =>
      filters.projectId
        ? this.changes.getByProject(filters.projectId, continuation)
        : filters.status
          ? this.changes.getByStatus(
              filters.status as IPmoChangeRequest["requestStatus"],
              continuation,
            )
          : this.changes.getForRequester(userId, continuation),
    );
    const approvals = await all<IPmoApprovalRequest>((continuation) =>
      filters.projectId
        ? this.approvals.getByProject(filters.projectId, continuation)
        : filters.status
          ? this.approvals.getByStatus(
              filters.status as IPmoApprovalRequest["approvalStatus"],
              continuation,
            )
          : this.approvals.getPendingForApprover(userId, continuation),
    );
    const columns = [
      { key: "kind", label: "Record type" },
      { key: "number", label: "Number" },
      { key: "project", label: "Project" },
      { key: "type", label: "Type" },
      { key: "requested", label: "Requested" },
      { key: "status", label: "Status" },
      { key: "owner", label: "Approver" },
      { key: "decision", label: "Decision" },
    ];
    return {
      columns,
      rows: [
        ...changes.map((item) => ({
          id: `change-${item.id}`,
          values: {
            kind: "Change request",
            number: item.requestNumber,
            project: item.projectCode,
            type: item.requestType,
            requested: date(item.requestedOn),
            status: item.requestStatus,
            owner: item.currentApprover?.displayName,
            decision: item.decisionComment,
          },
          route: { view: "change-request", requestId: String(item.id) },
        })),
        ...approvals.map((item) => ({
          id: `approval-${item.id}`,
          values: {
            kind: "Approval",
            number: item.approvalNumber,
            project: item.projectCode,
            type: item.approvalType,
            requested: date(item.requestedOn),
            status: item.approvalStatus,
            owner: item.approver.displayName,
            decision: item.decision,
          },
          route: { view: "approval-detail", approvalId: String(item.id) },
        })),
      ],
    };
  }

  private async qualityReport(filters: IReportFilters) {
    const items = await all<IPmoQualityItem>((continuation) =>
      this.quality.getPage(
        {
          projectId: filters.projectId,
          status: filters.status as IPmoQualityItem["status"] | undefined,
        },
        continuation,
        100,
      ),
    );
    const columns = [
      { key: "number", label: "Number" },
      { key: "project", label: "Project" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "result", label: "Result" },
      { key: "severity", label: "Severity" },
      { key: "owner", label: "Owner" },
      { key: "releaseBlocking", label: "Release blocking" },
    ];
    return {
      columns,
      rows: items.map((item) => ({
        id: String(item.id),
        values: {
          number: item.qualityNumber,
          project: item.projectCode,
          type: item.qualityType,
          status: item.status,
          result: item.testResult,
          severity: item.severity,
          owner: item.assignedTo?.displayName,
          releaseBlocking: item.isReleaseBlocking ? "Yes" : "No",
        },
        route: { view: "quality-detail", qualityId: String(item.id) },
      })),
    };
  }

  private async contribution(filters: IReportFilters, ownEmployeeId?: number) {
    const employeeId = filters.employeeId ?? ownEmployeeId;
    if (!employeeId)
      throw new PmoBusinessError("validation", "Enter an employee ID.");
    const start =
      filters.dateFrom ?? new Date(this.now().valueOf() - 30 * 86400000);
    const end = filters.dateTo ?? this.now();
    const [work, time, learning, memberships] = await Promise.all([
      all<IPmoWorkItem>((continuation) =>
        this.workItems.getAssignedTo(employeeId, continuation),
      ),
      all<IPmoTimeEntry>((continuation) =>
        this.timeEntries.getEmployeeRange(employeeId, start, end, continuation),
      ),
      all((continuation) =>
        this.learning.getForEmployee(employeeId, continuation),
      ),
      all((continuation) =>
        this.members.getActiveForEmployee(employeeId, continuation),
      ),
    ]);
    const projectCodes = Array.from(
      new Set([
        ...work.map((item) => item.projectCode),
        ...time
          .map((item) => item.projectCode)
          .filter((code): code is string => Boolean(code)),
        ...memberships.map((item) => item.projectCode),
      ]),
    );
    const columns = [
      { key: "project", label: "Project" },
      { key: "tasks", label: "Assigned tasks" },
      { key: "accepted", label: "Accepted delivery" },
      { key: "hours", label: "Recorded hours" },
      { key: "allocation", label: "Allocation %" },
      { key: "learning", label: "Learning hours" },
    ];
    const learningHours = learning.reduce(
      (sum, item) => sum + item.actualHours,
      0,
    );
    return {
      columns,
      rows: projectCodes.map((projectCode) => ({
        id: projectCode,
        values: {
          project: projectCode,
          tasks: work.filter((item) => item.projectCode === projectCode).length,
          accepted: work.filter(
            (item) =>
              item.projectCode === projectCode && item.status === "Accepted",
          ).length,
          hours: time
            .filter((item) => item.projectCode === projectCode)
            .reduce((sum, item) => sum + item.hours, 0),
          allocation: memberships
            .filter((item) => item.projectCode === projectCode)
            .reduce((sum, item) => sum + item.allocationPercent, 0),
          learning: learningHours,
        },
      })),
    };
  }

  private async closure(filters: IReportFilters) {
    if (!filters.projectId)
      throw new PmoBusinessError("validation", "Enter a project ID.");
    const [project, work, quality, approvals] = await Promise.all([
      this.projects.getById(filters.projectId),
      all<IPmoWorkItem>((continuation) =>
        this.workItems.getByProject(filters.projectId as number, continuation),
      ),
      all<IPmoQualityItem>((continuation) =>
        this.quality.getByProject(filters.projectId as number, continuation),
      ),
      all<IPmoApprovalRequest>((continuation) =>
        this.approvals.getByProject(filters.projectId as number, continuation),
      ),
    ]);
    const columns = [
      { key: "project", label: "Project" },
      { key: "status", label: "Closure status" },
      { key: "baselineEnd", label: "Baseline end" },
      { key: "approvedEnd", label: "Final approved end" },
      { key: "actualEnd", label: "Actual or forecast end" },
      { key: "baselineEffort", label: "Baseline effort" },
      { key: "approvedEffort", label: "Final approved effort" },
      { key: "actualEffort", label: "Actual effort" },
      { key: "openWork", label: "Open work items" },
      { key: "criticalQuality", label: "Critical quality blockers" },
      { key: "pendingApprovals", label: "Pending approvals" },
    ];
    return {
      columns,
      rows: [
        {
          id: String(project.id),
          values: {
            project: `${project.projectCode ?? project.id} ${project.title}`,
            status: project.status,
            baselineEnd: date(project.baselineEnd),
            approvedEnd: date(project.currentApprovedEnd),
            actualEnd: date(project.forecastEnd ?? project.currentApprovedEnd),
            baselineEffort: project.baselineEffortHours,
            approvedEffort: project.approvedEffortHours,
            actualEffort: project.actualEffortHours,
            openWork: work.filter(
              (item) => ["Accepted", "Cancelled"].indexOf(item.status) < 0,
            ).length,
            criticalQuality: quality.filter(
              (item) =>
                item.severity === "Critical" &&
                ["Closed", "Passed", "Approved Exception"].indexOf(
                  item.status,
                ) < 0,
            ).length,
            pendingApprovals: approvals.filter(
              (item) =>
                ["Submitted", "In Progress"].indexOf(item.approvalStatus) >= 0,
            ).length,
          },
          route: { view: "project-overview", projectId: String(project.id) },
        },
      ],
    };
  }

  private async financialReport(filters: IReportFilters) {
    const items = filters.projectId
      ? [await this.financials.getByProjectId(filters.projectId)].filter(
          (item): item is IPmoProjectFinancials => item !== undefined,
        )
      : await all<IPmoProjectFinancials>((continuation) =>
          this.financials.getPage(undefined, continuation),
        );
    const columns = [
      { key: "project", label: "Project" },
      { key: "value", label: "Project value" },
      { key: "baselineCost", label: "Baseline cost" },
      { key: "approvedCost", label: "Approved cost" },
      { key: "actualCost", label: "Actual cost" },
      { key: "forecastCost", label: "Forecast cost" },
      { key: "contribution", label: "Forecast contribution" },
      { key: "margin", label: "Forecast margin %" },
      { key: "status", label: "Data status" },
    ];
    return {
      columns,
      rows: items.map((item) => ({
        id: String(item.id),
        values: {
          project: item.projectCode,
          value: value(item.projectValue),
          baselineCost: value(item.baselineCostBudget),
          approvedCost: value(item.approvedCostBudget),
          actualCost: item.actualCost,
          forecastCost: item.forecastCost,
          contribution: value(item.forecastMarginAmount),
          margin: value(item.forecastMarginPercent),
          status: item.calculationStatus,
        },
        route: {
          view: "project-financials",
          projectId: String(item.projectId),
        },
      })),
    };
  }
}
