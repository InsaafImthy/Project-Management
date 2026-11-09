import {
  PMO_FIELDS as F,
  PMO_LIBRARIES,
  PMO_LISTS,
  type PmoContainerName,
} from "../../config/sharePointSchema";
import type {
  IPmoApprovalRequest,
  IPmoChangeRequest,
  IPmoConfig,
  IPmoEmployee,
  IPmoEmployeeRate,
  IPmoEntity,
  IPmoImportBatch,
  IPmoLearningAssignment,
  IPmoProject,
  IPmoProjectCost,
  IPmoProjectDocument,
  IPmoProjectFinancials,
  IPmoProjectMember,
  IPmoProjectStatusReport,
  IPmoQualityItem,
  IPmoRiskIssue,
  IPmoTaskAction,
  IPmoTimeEntry,
  IPmoWorkItem,
} from "../../models/domain";
import type { ISharePointItemWire } from "../../models/sharePoint";
import type {
  ISharePointClient,
  ISharePointQuery,
} from "../sharepoint/SharePointClient";
import { escapeODataString } from "../sharepoint/SharePointClient";
import type {
  IEntityRepository,
  IRepositoryPage,
  RepositoryValues,
} from "./contracts";
import { mapRepositoryPage } from "./contracts";
import {
  mapApprovalRequest,
  mapChangeRequest,
  mapConfig,
  mapEmployee,
  mapEmployeeRate,
  mapImportBatch,
  mapLearningAssignment,
  mapProject,
  mapProjectCost,
  mapProjectDocument,
  mapProjectFinancials,
  mapProjectMember,
  mapProjectStatusReport,
  mapQualityItem,
  mapRiskIssue,
  mapTaskAction,
  mapTimeEntry,
  mapWorkItem,
  type SharePointMapper,
} from "./mappers";

const allFields = (fields: Readonly<Record<string, string>>): string[] =>
  Array.from(new Set(Object.keys(fields).map((key) => fields[key] as string)));

const odataDate = (date: Date): string => date.toISOString();
const odataString = (value: string): string => `'${escapeODataString(value)}'`;
const requiredIndexedFilter = (filter: string | undefined): string => {
  if (!filter?.trim())
    throw new Error("An indexed repository filter is required.");
  return filter;
};

export abstract class SharePointRepository<T extends IPmoEntity>
  implements IEntityRepository<T>
{
  private readonly select: readonly string[];
  private readonly expand: readonly string[];

  protected constructor(
    protected readonly client: ISharePointClient,
    private readonly containerName: PmoContainerName,
    select: readonly string[],
    private readonly mapper: SharePointMapper<T>,
    expand: readonly string[] = [],
  ) {
    this.expand = expand;
    this.select = select
      .filter((field) => expand.indexOf(field) < 0)
      .concat(
        ...expand.map((field) => [
          `${field}/Id`,
          `${field}/Title`,
          `${field}/EMail`,
          `${field}/Name`,
        ]),
      );
  }

  public async getById(id: number): Promise<T> {
    return this.mapper(
      await this.client.getById<ISharePointItemWire>(
        this.containerName,
        id,
        this.select,
        this.expand,
      ),
    );
  }

  public async create(values: RepositoryValues): Promise<T> {
    const created = await this.client.create(this.containerName, values);
    return this.getById(created.id);
  }

  public async update(
    id: number,
    values: RepositoryValues,
    etag: string,
  ): Promise<T> {
    await this.client.update(this.containerName, id, values, etag);
    return this.getById(id);
  }

  protected async queryPage(
    query: Omit<ISharePointQuery, "select" | "expand">,
  ): Promise<IRepositoryPage<T>> {
    const page = await this.client.query<ISharePointItemWire>(
      this.containerName,
      {
        ...query,
        select: this.select,
        expand: this.expand,
        filter: requiredIndexedFilter(query.filter),
      },
    );
    return mapRepositoryPage(page, this.mapper);
  }
}

export class ConfigRepository extends SharePointRepository<IPmoConfig> {
  public constructor(client: ISharePointClient) {
    super(client, PMO_LISTS.config, allFields(F.config), mapConfig);
  }

  public getActive(
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoConfig>> {
    return this.queryPage({
      filter: `${F.config.IsActive} eq 1`,
      orderBy: [`${F.config.Category} asc`, `${F.config.SortOrder} asc`],
      top: 50,
      continuation,
    });
  }

  public getPage(
    filters: {
      readonly category?: IPmoConfig["category"];
      readonly isActive?: boolean;
      readonly search?: string;
    },
    continuation?: string,
    top = 50,
  ): Promise<IRepositoryPage<IPmoConfig>> {
    const clauses: string[] = [];
    if (filters.category) {
      clauses.push(`${F.config.Category} eq ${odataString(filters.category)}`);
    } else if (filters.isActive !== undefined) {
      clauses.push(`${F.config.IsActive} eq ${filters.isActive ? 1 : 0}`);
    } else {
      clauses.push(`${F.config.ID} gt 0`);
    }
    if (filters.category && filters.isActive !== undefined) {
      clauses.push(`${F.config.IsActive} eq ${filters.isActive ? 1 : 0}`);
    }
    const search = filters.search?.trim();
    if (search) {
      clauses.push(
        `(substringof(${odataString(search)},${F.config.Title}) or substringof(${odataString(search)},${F.config.Description}) or substringof(${odataString(search)},${F.config.ConfigValue}))`,
      );
    }
    return this.queryPage({
      filter: clauses.join(" and "),
      orderBy: [`${F.config.Category} asc`, `${F.config.SortOrder} asc`],
      top,
      continuation,
    });
  }

  public async getByKey(key: string): Promise<IPmoConfig | undefined> {
    const page = await this.queryPage({
      filter: `${F.config.Title} eq ${odataString(key)}`,
      top: 1,
    });
    return page.items[0];
  }
}

const employeeExpand = [F.employees.EmployeeUser, F.employees.Manager];
export class EmployeesRepository extends SharePointRepository<IPmoEmployee> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.employees,
      allFields(F.employees),
      mapEmployee,
      employeeExpand,
    );
  }

  public async getActiveByEmail(
    email: string,
  ): Promise<IPmoEmployee | undefined> {
    const result = await this.queryPage({
      filter: `${F.employees.Email} eq ${odataString(email.toLowerCase())} and ${F.employees.IsActive} eq 1`,
      top: 1,
    });
    return result.items[0];
  }

  public getActive(
    continuation?: string,
    top = 50,
  ): Promise<IRepositoryPage<IPmoEmployee>> {
    return this.queryPage({
      filter: `${F.employees.IsActive} eq 1`,
      orderBy: [`${F.employees.Title} asc`],
      top,
      continuation,
    });
  }

  public getPage(
    filters: {
      readonly employmentStatus?: IPmoEmployee["employmentStatus"];
      readonly department?: string;
      readonly eligibility?:
        | "projectManager"
        | "qa"
        | "approver"
        | "resourceManager";
      readonly isActive?: boolean;
      readonly search?: string;
    },
    continuation?: string,
    top = 50,
  ): Promise<IRepositoryPage<IPmoEmployee>> {
    const clauses: string[] = [];
    if (filters.employmentStatus) {
      clauses.push(
        `${F.employees.EmploymentStatus} eq ${odataString(filters.employmentStatus)}`,
      );
    } else if (filters.department) {
      clauses.push(
        `${F.employees.Department} eq ${odataString(filters.department)}`,
      );
    } else if (filters.isActive !== undefined) {
      clauses.push(`${F.employees.IsActive} eq ${filters.isActive ? 1 : 0}`);
    } else {
      clauses.push(`${F.employees.ID} gt 0`);
    }
    if (filters.department && !clauses[0]?.startsWith(F.employees.Department)) {
      clauses.push(
        `${F.employees.Department} eq ${odataString(filters.department)}`,
      );
    }
    if (
      filters.isActive !== undefined &&
      !clauses[0]?.startsWith(F.employees.IsActive)
    ) {
      clauses.push(`${F.employees.IsActive} eq ${filters.isActive ? 1 : 0}`);
    }
    const eligibilityFields = {
      projectManager: F.employees.IsProjectManager,
      qa: F.employees.IsQA,
      approver: F.employees.IsApprover,
      resourceManager: F.employees.IsResourceManager,
    } as const;
    if (filters.eligibility) {
      clauses.push(`${eligibilityFields[filters.eligibility]} eq 1`);
    }
    const search = filters.search?.trim();
    if (search) {
      clauses.push(
        `(substringof(${odataString(search)},${F.employees.Title}) or substringof(${odataString(search)},${F.employees.EmployeeNumber}) or substringof(${odataString(search.toLowerCase())},${F.employees.Email}))`,
      );
    }
    return this.queryPage({
      filter: clauses.join(" and "),
      orderBy: [`${F.employees.Title} asc`],
      top,
      continuation,
    });
  }

  public async getByEmployeeNumber(
    employeeNumber: string,
  ): Promise<IPmoEmployee | undefined> {
    const page = await this.queryPage({
      filter: `${F.employees.EmployeeNumber} eq ${odataString(employeeNumber)}`,
      top: 1,
    });
    return page.items[0];
  }

  public async getByEmail(email: string): Promise<IPmoEmployee | undefined> {
    const page = await this.queryPage({
      filter: `${F.employees.Email} eq ${odataString(email.toLowerCase())}`,
      top: 1,
    });
    return page.items[0];
  }

  public async getActiveBySharePointUserId(
    sharePointUserId: number,
  ): Promise<IPmoEmployee | undefined> {
    const page = await this.queryPage({
      filter: `${F.employees.EmployeeUser}Id eq ${sharePointUserId} and ${F.employees.IsActive} eq 1`,
      top: 1,
    });
    return page.items[0];
  }
}

export class EmployeeRatesRepository extends SharePointRepository<IPmoEmployeeRate> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.employeeRates,
      allFields(F.employeeRates),
      mapEmployeeRate,
    );
  }

  public getCurrentForEmployee(
    employeeId: number,
  ): Promise<IRepositoryPage<IPmoEmployeeRate>> {
    return this.queryPage({
      filter: `${F.employeeRates.EmployeeId} eq ${employeeId} and ${F.employeeRates.IsCurrent} eq 1`,
      orderBy: [`${F.employeeRates.EffectiveFrom} desc`],
      top: 10,
    });
  }
}

const projectExpand = [
  F.projects.ProjectManager,
  F.projects.Sponsor,
  F.projects.PMOOwner,
  F.projects.BaselineApprovedBy,
];
export class ProjectsRepository extends SharePointRepository<IPmoProject> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.projects,
      allFields(F.projects),
      mapProject,
      projectExpand,
    );
  }

  public getActive(
    continuation?: string,
    top = 50,
  ): Promise<IRepositoryPage<IPmoProject>> {
    return this.queryPage({
      filter: `${F.projects.IsActive} eq 1 and ${F.projects.Status} ne ${odataString("Closed")}`,
      orderBy: [
        `${F.projects.OverallHealth} desc`,
        `${F.projects.ForecastEnd} asc`,
      ],
      top,
      continuation,
    });
  }

  public getManagedBy(
    sharePointUserId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProject>> {
    return this.queryPage({
      filter: `${F.projects.ProjectManager}Id eq ${sharePointUserId} and ${F.projects.IsActive} eq 1`,
      orderBy: [`${F.projects.Title} asc`],
      top: 50,
      continuation,
    });
  }

  public getStale(
    calculatedBefore: Date,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProject>> {
    return this.queryPage({
      filter: `${F.projects.IsActive} eq 1 and (${F.projects.MetricsCalculatedOn} eq null or ${F.projects.MetricsCalculatedOn} lt datetime'${odataDate(calculatedBefore)}')`,
      orderBy: [`${F.projects.MetricsCalculatedOn} asc`],
      top: 50,
      continuation,
    });
  }

  /**
   * Portfolio paging deliberately starts from an indexed predicate.  Free-text
   * matching is capped and applied only to a single page so it cannot turn the
   * project list into an unbounded list scan.
   */
  public getPage(
    filters: {
      readonly status?: IPmoProject["status"];
      readonly projectManagerId?: number;
      readonly customerName?: string;
      readonly overallHealth?: IPmoProject["overallHealth"];
      readonly atRisk?: boolean;
      readonly isActive?: boolean;
      readonly dateFrom?: Date;
      readonly dateTo?: Date;
      readonly search?: string;
    },
    continuation?: string,
    top = 50,
  ): Promise<IRepositoryPage<IPmoProject>> {
    const clauses: string[] = [
      `${F.projects.IsActive} eq ${filters.isActive === false ? 0 : 1}`,
    ];
    if (filters.status) {
      clauses.push(`${F.projects.Status} eq ${odataString(filters.status)}`);
    }
    if (filters.projectManagerId) {
      clauses.push(
        `${F.projects.ProjectManager}Id eq ${filters.projectManagerId}`,
      );
    }
    if (filters.customerName?.trim()) {
      clauses.push(
        `${F.projects.CustomerName} eq ${odataString(filters.customerName.trim())}`,
      );
    }
    if (filters.overallHealth) {
      clauses.push(
        `${F.projects.OverallHealth} eq ${odataString(filters.overallHealth)}`,
      );
    }
    if (filters.atRisk) {
      clauses.push(
        `(${F.projects.OverallHealth} eq ${odataString("Amber")} or ${F.projects.OverallHealth} eq ${odataString("Red")})`,
      );
    }
    if (filters.dateFrom) {
      clauses.push(
        `${F.projects.CurrentApprovedEnd} ge datetime'${odataDate(filters.dateFrom)}'`,
      );
    }
    if (filters.dateTo) {
      clauses.push(
        `${F.projects.CurrentApprovedEnd} le datetime'${odataDate(filters.dateTo)}'`,
      );
    }
    const search = filters.search?.trim();
    if (search) {
      if (search.length < 2 || search.length > 80) {
        throw new Error(
          "Project search must contain between 2 and 80 characters.",
        );
      }
      clauses.push(
        `(startswith(${F.projects.ProjectCode},${odataString(search)}) or startswith(${F.projects.Title},${odataString(search)}))`,
      );
    }
    return this.queryPage({
      filter: clauses.join(" and "),
      orderBy: [`${F.projects.CurrentApprovedEnd} asc`, `${F.projects.ID} asc`],
      top: Math.min(top, search ? 50 : 100),
      continuation,
    });
  }
}

export class ProjectFinancialsRepository extends SharePointRepository<IPmoProjectFinancials> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.projectFinancials,
      allFields(F.projectFinancials),
      mapProjectFinancials,
      [F.projectFinancials.ApprovedBy],
    );
  }

  public async getByProjectId(
    projectId: number,
  ): Promise<IPmoProjectFinancials | undefined> {
    const page = await this.queryPage({
      filter: `${F.projectFinancials.ProjectId} eq ${projectId}`,
      top: 1,
    });
    return page.items[0];
  }
}

export class ProjectMembersRepository extends SharePointRepository<IPmoProjectMember> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.projectMembers,
      allFields(F.projectMembers),
      mapProjectMember,
      [F.projectMembers.EmployeeUser],
    );
  }

  public getActiveByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProjectMember>> {
    return this.queryPage({
      filter: `${F.projectMembers.ProjectId} eq ${projectId} and ${F.projectMembers.IsActive} eq 1`,
      orderBy: [`${F.projectMembers.EmployeeId} asc`],
      top: 100,
      continuation,
    });
  }

  public getActiveForEmployee(
    employeeId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProjectMember>> {
    return this.queryPage({
      filter: `${F.projectMembers.EmployeeId} eq ${employeeId} and ${F.projectMembers.IsActive} eq 1`,
      orderBy: [`${F.projectMembers.AllocationEnd} asc`],
      top: 100,
      continuation,
    });
  }

  public getForProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProjectMember>> {
    return this.queryPage({
      filter: `${F.projectMembers.ProjectId} eq ${projectId}`,
      orderBy: [`${F.projectMembers.AllocationEnd} desc`],
      top: 100,
      continuation,
    });
  }
}

const workItemExpand = [
  F.workItems.AssignedTo,
  F.workItems.Reviewer,
  F.workItems.QAOwner,
];
export class WorkItemsRepository extends SharePointRepository<IPmoWorkItem> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.workItems,
      allFields(F.workItems),
      mapWorkItem,
      workItemExpand,
    );
  }

  public getByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    return this.queryPage({
      filter: `${F.workItems.ProjectId} eq ${projectId} and ${F.workItems.IsActive} eq 1`,
      orderBy: [
        `${F.workItems.ItemType} asc`,
        `${F.workItems.PlannedStart} asc`,
      ],
      top: 200,
      continuation,
    });
  }

  public getAssignedTo(
    employeeId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    return this.queryPage({
      filter: `${F.workItems.AssignedEmployeeId} eq ${employeeId} and ${F.workItems.IsActive} eq 1`,
      orderBy: [`${F.workItems.PlannedEnd} asc`],
      top: 50,
      continuation,
    });
  }

  public getReviewQueueForUser(
    sharePointUserId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    return this.queryPage({
      filter: `${F.workItems.Reviewer}Id eq ${sharePointUserId} and ${F.workItems.Status} eq ${odataString("Submitted for Review")} and ${F.workItems.IsActive} eq 1`,
      orderBy: [`${F.workItems.SubmittedOn} asc`],
      top: 50,
      continuation,
    });
  }

  public getQaQueueForUser(
    sharePointUserId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    return this.queryPage({
      filter: `${F.workItems.QAOwner}Id eq ${sharePointUserId} and (${F.workItems.Status} eq ${odataString("Submitted to QA")} or ${F.workItems.Status} eq ${odataString("QA In Progress")}) and ${F.workItems.IsActive} eq 1`,
      orderBy: [`${F.workItems.SubmittedOn} asc`],
      top: 50,
      continuation,
    });
  }

  public getByProjectAndStatuses(
    projectId: number,
    statuses: readonly IPmoWorkItem["status"][],
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    const statusFilter = statuses
      .map((status) => `${F.workItems.Status} eq ${odataString(status)}`)
      .join(" or ");
    return this.queryPage({
      filter: `${F.workItems.ProjectId} eq ${projectId} and ${F.workItems.IsActive} eq 1 and (${statusFilter})`,
      orderBy: [`${F.workItems.PlannedEnd} asc`],
      top: 200,
      continuation,
    });
  }
}

export class TaskActionsRepository extends SharePointRepository<IPmoTaskAction> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.taskActions,
      allFields(F.taskActions),
      mapTaskAction,
      [F.taskActions.RequestedBy],
    );
  }

  public getByWorkItem(
    workItemId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTaskAction>> {
    return this.queryPage({
      filter: `${F.taskActions.WorkItemId} eq ${workItemId}`,
      orderBy: [`${F.taskActions.RequestedOn} desc`],
      top: 50,
      continuation,
    });
  }

  public getFailed(
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTaskAction>> {
    return this.queryPage({
      filter: `${F.taskActions.ProcessingStatus} eq ${odataString("Failed")}`,
      orderBy: [`${F.taskActions.RequestedOn} asc`],
      top: 50,
      continuation,
    });
  }

  public getForRequestor(
    sharePointUserId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTaskAction>> {
    return this.queryPage({
      filter: `${F.taskActions.RequestedBy}Id eq ${sharePointUserId}`,
      orderBy: [`${F.taskActions.RequestedOn} desc`],
      top: 50,
      continuation,
    });
  }
}

export class TimeEntriesRepository extends SharePointRepository<IPmoTimeEntry> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.timeEntries,
      allFields(F.timeEntries),
      mapTimeEntry,
      [F.timeEntries.EmployeeUser, F.timeEntries.ApprovedBy],
    );
  }

  public getEmployeeRange(
    employeeId: number,
    start: Date,
    end: Date,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTimeEntry>> {
    return this.queryPage({
      filter: `${F.timeEntries.EmployeeId} eq ${employeeId} and ${F.timeEntries.WorkDate} ge datetime'${odataDate(start)}' and ${F.timeEntries.WorkDate} le datetime'${odataDate(end)}'`,
      orderBy: [`${F.timeEntries.WorkDate} asc`],
      top: 100,
      continuation,
    });
  }

  public getApprovedByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTimeEntry>> {
    return this.queryPage({
      filter: `${F.timeEntries.ProjectId} eq ${projectId} and ${F.timeEntries.EntryStatus} eq ${odataString("Approved")}`,
      orderBy: [`${F.timeEntries.WorkDate} asc`],
      top: 200,
      continuation,
    });
  }

  public getByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTimeEntry>> {
    return this.queryPage({
      filter: `${F.timeEntries.ProjectId} eq ${projectId}`,
      orderBy: [`${F.timeEntries.WorkDate} desc`],
      top: 200,
      continuation,
    });
  }

  public getProjectRange(
    projectId: number,
    start: Date,
    end: Date,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTimeEntry>> {
    return this.queryPage({
      filter: `${F.timeEntries.ProjectId} eq ${projectId} and ${F.timeEntries.WorkDate} ge datetime'${odataDate(start)}' and ${F.timeEntries.WorkDate} le datetime'${odataDate(end)}'`,
      orderBy: [
        `${F.timeEntries.WorkDate} asc`,
        `${F.timeEntries.EmployeeId} asc`,
      ],
      top: 200,
      continuation,
    });
  }

  public getRange(
    start: Date,
    end: Date,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoTimeEntry>> {
    return this.queryPage({
      filter: `${F.timeEntries.WorkDate} ge datetime'${odataDate(start)}' and ${F.timeEntries.WorkDate} le datetime'${odataDate(end)}'`,
      orderBy: [
        `${F.timeEntries.WorkDate} asc`,
        `${F.timeEntries.EmployeeId} asc`,
      ],
      top: 200,
      continuation,
    });
  }
}

export class ChangeRequestsRepository extends SharePointRepository<IPmoChangeRequest> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.changeRequests,
      allFields(F.changeRequests),
      mapChangeRequest,
      [
        F.changeRequests.RequestedBy,
        F.changeRequests.CurrentApprover,
        F.changeRequests.DecidedBy,
      ],
    );
  }

  public getByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoChangeRequest>> {
    return this.queryPage({
      filter: `${F.changeRequests.ProjectId} eq ${projectId}`,
      orderBy: [`${F.changeRequests.RequestedOn} desc`],
      top: 50,
      continuation,
    });
  }

  public getForRequester(
    sharePointUserId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoChangeRequest>> {
    return this.queryPage({
      filter: `${F.changeRequests.RequestedBy}Id eq ${sharePointUserId}`,
      orderBy: [`${F.changeRequests.RequestedOn} desc`],
      top: 50,
      continuation,
    });
  }

  public getByStatus(
    status: IPmoChangeRequest["requestStatus"],
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoChangeRequest>> {
    return this.queryPage({
      filter: `${F.changeRequests.RequestStatus} eq ${odataString(status)}`,
      orderBy: [`${F.changeRequests.RequestedOn} desc`],
      top: 100,
      continuation,
    });
  }
}

export class ApprovalRequestsRepository extends SharePointRepository<IPmoApprovalRequest> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.approvalRequests,
      allFields(F.approvalRequests),
      mapApprovalRequest,
      [
        F.approvalRequests.RequestedBy,
        F.approvalRequests.Approver,
        F.approvalRequests.DecidedBy,
      ],
    );
  }

  public getPendingForApprover(
    sharePointUserId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoApprovalRequest>> {
    return this.queryPage({
      filter: `${F.approvalRequests.Approver}Id eq ${sharePointUserId} and (${F.approvalRequests.ApprovalStatus} eq ${odataString("Submitted")} or ${F.approvalRequests.ApprovalStatus} eq ${odataString("In Progress")})`,
      orderBy: [`${F.approvalRequests.DueOn} asc`],
      top: 50,
      continuation,
    });
  }

  public getForRequester(
    sharePointUserId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoApprovalRequest>> {
    return this.queryPage({
      filter: `${F.approvalRequests.RequestedBy}Id eq ${sharePointUserId}`,
      orderBy: [`${F.approvalRequests.RequestedOn} desc`],
      top: 100,
      continuation,
    });
  }

  public getByStatus(
    status: IPmoApprovalRequest["approvalStatus"],
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoApprovalRequest>> {
    return this.queryPage({
      filter: `${F.approvalRequests.ApprovalStatus} eq ${odataString(status)}`,
      orderBy: [`${F.approvalRequests.DueOn} asc`],
      top: 100,
      continuation,
    });
  }

  public getOverdue(
    before: Date,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoApprovalRequest>> {
    return this.queryPage({
      filter: `${F.approvalRequests.DueOn} lt datetime'${odataDate(before)}' and (${F.approvalRequests.ApprovalStatus} eq ${odataString("Submitted")} or ${F.approvalRequests.ApprovalStatus} eq ${odataString("In Progress")})`,
      orderBy: [`${F.approvalRequests.DueOn} asc`],
      top: 100,
      continuation,
    });
  }

  public getForSource(
    sourceList: PmoContainerName,
    sourceItemId: number,
  ): Promise<IRepositoryPage<IPmoApprovalRequest>> {
    return this.queryPage({
      filter: `${F.approvalRequests.SourceList} eq ${odataString(sourceList)} and ${F.approvalRequests.SourceItemId} eq ${sourceItemId}`,
      orderBy: [`${F.approvalRequests.RequestedOn} desc`],
      top: 50,
    });
  }

  public getByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoApprovalRequest>> {
    return this.queryPage({
      filter: `${F.approvalRequests.ProjectId} eq ${projectId}`,
      orderBy: [`${F.approvalRequests.RequestedOn} desc`],
      top: 100,
      continuation,
    });
  }
}

export interface IRiskIssueListFilters {
  readonly projectId?: number;
  readonly recordType?: IPmoRiskIssue["recordType"];
  readonly status?: IPmoRiskIssue["status"];
  readonly severity?: IPmoRiskIssue["severity"];
  readonly ownerId?: number;
  readonly dueBefore?: Date;
  readonly openOnly?: boolean;
  readonly escalated?: boolean;
}

export class RisksIssuesRepository extends SharePointRepository<IPmoRiskIssue> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.risksIssues,
      allFields(F.risksIssues),
      mapRiskIssue,
      [F.risksIssues.Owner, F.risksIssues.RaisedBy],
    );
  }

  public getOpenByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoRiskIssue>> {
    return this.queryPage({
      filter: `${F.risksIssues.ProjectId} eq ${projectId} and ${F.risksIssues.Status} ne ${odataString("Closed")}`,
      orderBy: [`${F.risksIssues.Severity} desc`],
      top: 100,
      continuation,
    });
  }

  public getPage(
    filters: IRiskIssueListFilters,
    continuation?: string,
    top = 50,
  ): Promise<IRepositoryPage<IPmoRiskIssue>> {
    const clauses: string[] = [];
    if (filters.projectId !== undefined)
      clauses.push(`${F.risksIssues.ProjectId} eq ${filters.projectId}`);
    else if (filters.recordType)
      clauses.push(
        `${F.risksIssues.RecordType} eq ${odataString(filters.recordType)}`,
      );
    else if (filters.ownerId !== undefined)
      clauses.push(`${F.risksIssues.Owner}Id eq ${filters.ownerId}`);
    else if (filters.status)
      clauses.push(`${F.risksIssues.Status} eq ${odataString(filters.status)}`);
    else clauses.push(`${F.risksIssues.ID} gt 0`);
    if (filters.recordType && filters.projectId !== undefined)
      clauses.push(
        `${F.risksIssues.RecordType} eq ${odataString(filters.recordType)}`,
      );
    if (
      filters.status &&
      !clauses.some((clause) => clause.startsWith(`${F.risksIssues.Status} eq`))
    )
      clauses.push(`${F.risksIssues.Status} eq ${odataString(filters.status)}`);
    if (filters.severity)
      clauses.push(
        `${F.risksIssues.Severity} eq ${odataString(filters.severity)}`,
      );
    if (
      filters.ownerId !== undefined &&
      !clauses.some((clause) => clause.startsWith(`${F.risksIssues.Owner}Id`))
    )
      clauses.push(`${F.risksIssues.Owner}Id eq ${filters.ownerId}`);
    if (filters.openOnly)
      clauses.push(
        `${F.risksIssues.Status} ne ${odataString("Closed")} and ${F.risksIssues.Status} ne ${odataString("Resolved")}`,
      );
    if (filters.escalated !== undefined)
      clauses.push(
        `${F.risksIssues.IsEscalated} eq ${filters.escalated ? 1 : 0}`,
      );
    if (filters.dueBefore)
      clauses.push(
        `${F.risksIssues.TargetResolutionDate} lt datetime'${odataDate(filters.dueBefore)}'`,
      );
    return this.queryPage({
      filter: clauses.join(" and "),
      orderBy: [
        `${F.risksIssues.TargetResolutionDate} asc`,
        `${F.risksIssues.RaisedOn} desc`,
      ],
      top,
      continuation,
    });
  }
}

export interface IQualityItemListFilters {
  readonly projectId?: number;
  readonly qualityType?: IPmoQualityItem["qualityType"];
  readonly status?: IPmoQualityItem["status"];
  readonly testResult?: IPmoQualityItem["testResult"];
  readonly severity?: IPmoQualityItem["severity"];
  readonly assignedToId?: number;
  readonly releaseBlocking?: boolean;
  readonly overdueBefore?: Date;
  readonly openOnly?: boolean;
}

export class QualityItemsRepository extends SharePointRepository<IPmoQualityItem> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.qualityItems,
      allFields(F.qualityItems),
      mapQualityItem,
      [
        F.qualityItems.AssignedTo,
        F.qualityItems.RaisedBy,
        F.qualityItems.RetestedBy,
      ],
    );
  }

  public getByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoQualityItem>> {
    return this.queryPage({
      filter: `${F.qualityItems.ProjectId} eq ${projectId}`,
      orderBy: [`${F.qualityItems.RaisedOn} desc`],
      top: 100,
      continuation,
    });
  }

  public getAssignedTo(
    sharePointUserId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoQualityItem>> {
    return this.queryPage({
      filter: `${F.qualityItems.AssignedTo}Id eq ${sharePointUserId} and ${F.qualityItems.Status} ne ${odataString("Closed")}`,
      orderBy: [`${F.qualityItems.TargetFixDate} asc`],
      top: 50,
      continuation,
    });
  }

  public getPage(
    filters: IQualityItemListFilters,
    continuation?: string,
    top = 50,
  ): Promise<IRepositoryPage<IPmoQualityItem>> {
    const clauses: string[] = [];
    if (filters.projectId !== undefined)
      clauses.push(`${F.qualityItems.ProjectId} eq ${filters.projectId}`);
    else if (filters.qualityType)
      clauses.push(
        `${F.qualityItems.QualityType} eq ${odataString(filters.qualityType)}`,
      );
    else if (filters.status)
      clauses.push(
        `${F.qualityItems.Status} eq ${odataString(filters.status)}`,
      );
    else if (filters.testResult)
      clauses.push(
        `${F.qualityItems.TestResult} eq ${odataString(filters.testResult)}`,
      );
    else if (filters.assignedToId !== undefined)
      clauses.push(`${F.qualityItems.AssignedTo}Id eq ${filters.assignedToId}`);
    else if (filters.releaseBlocking !== undefined)
      clauses.push(
        `${F.qualityItems.IsReleaseBlocking} eq ${filters.releaseBlocking ? 1 : 0}`,
      );
    else clauses.push(`${F.qualityItems.ID} gt 0`);
    if (
      filters.qualityType &&
      !clauses.some((clause) =>
        clause.startsWith(`${F.qualityItems.QualityType} eq`),
      )
    )
      clauses.push(
        `${F.qualityItems.QualityType} eq ${odataString(filters.qualityType)}`,
      );
    if (
      filters.status &&
      !clauses.some((clause) =>
        clause.startsWith(`${F.qualityItems.Status} eq`),
      )
    )
      clauses.push(
        `${F.qualityItems.Status} eq ${odataString(filters.status)}`,
      );
    if (
      filters.testResult &&
      !clauses.some((clause) =>
        clause.startsWith(`${F.qualityItems.TestResult} eq`),
      )
    )
      clauses.push(
        `${F.qualityItems.TestResult} eq ${odataString(filters.testResult)}`,
      );
    if (filters.severity)
      clauses.push(
        `${F.qualityItems.Severity} eq ${odataString(filters.severity)}`,
      );
    if (
      filters.assignedToId !== undefined &&
      !clauses.some((clause) =>
        clause.startsWith(`${F.qualityItems.AssignedTo}Id`),
      )
    )
      clauses.push(`${F.qualityItems.AssignedTo}Id eq ${filters.assignedToId}`);
    if (
      filters.releaseBlocking !== undefined &&
      !clauses.some((clause) =>
        clause.startsWith(`${F.qualityItems.IsReleaseBlocking} eq`),
      )
    )
      clauses.push(
        `${F.qualityItems.IsReleaseBlocking} eq ${filters.releaseBlocking ? 1 : 0}`,
      );
    if (filters.openOnly)
      clauses.push(
        `${F.qualityItems.Status} ne ${odataString("Closed")} and ${F.qualityItems.Status} ne ${odataString("Passed")} and ${F.qualityItems.Status} ne ${odataString("Rejected")}`,
      );
    if (filters.overdueBefore)
      clauses.push(
        `${F.qualityItems.TargetFixDate} lt datetime'${odataDate(filters.overdueBefore)}'`,
      );
    return this.queryPage({
      filter: clauses.join(" and "),
      orderBy: [
        `${F.qualityItems.TargetFixDate} asc`,
        `${F.qualityItems.RaisedOn} desc`,
      ],
      top,
      continuation,
    });
  }
}

export class LearningAssignmentsRepository extends SharePointRepository<IPmoLearningAssignment> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.learningAssignments,
      allFields(F.learningAssignments),
      mapLearningAssignment,
      [
        F.learningAssignments.EmployeeUser,
        F.learningAssignments.Mentor,
        F.learningAssignments.ValidatedBy,
      ],
    );
  }

  public getForEmployee(
    employeeId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoLearningAssignment>> {
    return this.queryPage({
      filter: `${F.learningAssignments.EmployeeId} eq ${employeeId}`,
      orderBy: [`${F.learningAssignments.EndDate} asc`],
      top: 50,
      continuation,
    });
  }

  public getActiveForEmployee(
    employeeId: number,
    date: Date,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoLearningAssignment>> {
    return this.queryPage({
      filter: `${F.learningAssignments.EmployeeId} eq ${employeeId} and ${F.learningAssignments.StartDate} le datetime'${odataDate(date)}' and ${F.learningAssignments.EndDate} ge datetime'${odataDate(date)}' and (${F.learningAssignments.Status} eq ${odataString("Assigned")} or ${F.learningAssignments.Status} eq ${odataString("In Progress")})`,
      orderBy: [`${F.learningAssignments.EndDate} asc`],
      top: 50,
      continuation,
    });
  }

  public getAwaitingValidation(
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoLearningAssignment>> {
    return this.queryPage({
      filter: `${F.learningAssignments.Status} eq ${odataString("Submitted")}`,
      orderBy: [`${F.learningAssignments.EndDate} asc`],
      top: 100,
      continuation,
    });
  }
}

export class ProjectCostsRepository extends SharePointRepository<IPmoProjectCost> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.projectCosts,
      allFields(F.projectCosts),
      mapProjectCost,
      [F.projectCosts.ApprovedBy],
    );
  }

  public getApprovedByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProjectCost>> {
    return this.queryPage({
      filter: `${F.projectCosts.ProjectId} eq ${projectId} and ${F.projectCosts.CostStatus} eq ${odataString("Approved")}`,
      orderBy: [`${F.projectCosts.CostDate} asc`],
      top: 200,
      continuation,
    });
  }
}

export class ProjectStatusReportsRepository extends SharePointRepository<IPmoProjectStatusReport> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.projectStatusReports,
      allFields(F.projectStatusReports),
      mapProjectStatusReport,
      [F.projectStatusReports.SubmittedBy, F.projectStatusReports.ApprovedBy],
    );
  }

  public getByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProjectStatusReport>> {
    return this.queryPage({
      filter: `${F.projectStatusReports.ProjectId} eq ${projectId}`,
      orderBy: [`${F.projectStatusReports.ReportingDate} desc`],
      top: 50,
      continuation,
    });
  }

  public getPage(
    filters: {
      readonly projectId?: number;
      readonly reportStatus?: IPmoProjectStatusReport["reportStatus"];
      readonly periodStart?: Date;
      readonly periodEnd?: Date;
    },
    continuation?: string,
    top = 50,
  ): Promise<IRepositoryPage<IPmoProjectStatusReport>> {
    const clauses: string[] = [];
    if (filters.projectId !== undefined)
      clauses.push(
        `${F.projectStatusReports.ProjectId} eq ${filters.projectId}`,
      );
    else if (filters.reportStatus)
      clauses.push(
        `${F.projectStatusReports.ReportStatus} eq ${odataString(filters.reportStatus)}`,
      );
    else if (filters.periodStart)
      clauses.push(
        `${F.projectStatusReports.ReportingDate} ge datetime'${odataDate(filters.periodStart)}'`,
      );
    else clauses.push(`${F.projectStatusReports.ID} gt 0`);
    if (
      filters.reportStatus &&
      !clauses.some((clause) =>
        clause.startsWith(`${F.projectStatusReports.ReportStatus} eq`),
      )
    )
      clauses.push(
        `${F.projectStatusReports.ReportStatus} eq ${odataString(filters.reportStatus)}`,
      );
    if (
      filters.periodStart &&
      !clauses.some((clause) =>
        clause.startsWith(`${F.projectStatusReports.ReportingDate} ge`),
      )
    )
      clauses.push(
        `${F.projectStatusReports.ReportingDate} ge datetime'${odataDate(filters.periodStart)}'`,
      );
    if (filters.periodEnd)
      clauses.push(
        `${F.projectStatusReports.ReportingDate} le datetime'${odataDate(filters.periodEnd)}'`,
      );
    return this.queryPage({
      filter: clauses.join(" and "),
      orderBy: [`${F.projectStatusReports.ReportingDate} desc`],
      top,
      continuation,
    });
  }
}

export class ImportBatchesRepository extends SharePointRepository<IPmoImportBatch> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LISTS.importBatches,
      allFields(F.importBatches),
      mapImportBatch,
      [F.importBatches.UploadedBy],
    );
  }

  public getByProject(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoImportBatch>> {
    return this.queryPage({
      filter: `${F.importBatches.ProjectId} eq ${projectId}`,
      orderBy: [`${F.importBatches.UploadedOn} desc`],
      top: 50,
      continuation,
    });
  }
}

export class ProjectDocumentsRepository extends SharePointRepository<IPmoProjectDocument> {
  public constructor(client: ISharePointClient) {
    super(
      client,
      PMO_LIBRARIES.projectDocuments,
      allFields(F.projectDocuments),
      mapProjectDocument,
    );
  }

  public getByProjectCode(
    projectCode: string,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoProjectDocument>> {
    return this.queryPage({
      filter: `${F.projectDocuments.ProjectCode} eq ${odataString(projectCode)}`,
      orderBy: [`${F.projectDocuments.Modified} desc`],
      top: 50,
      continuation,
    });
  }

  public async upload(
    folderServerRelativeUrl: string,
    fileName: string,
    content: Blob | ArrayBuffer,
    metadata: RepositoryValues,
  ): Promise<IPmoProjectDocument> {
    const result = await this.client.uploadFile(
      PMO_LIBRARIES.projectDocuments,
      folderServerRelativeUrl,
      fileName,
      content,
      metadata,
    );
    return this.getById(result.itemId);
  }
}
