import { PMO_FIELDS as F, PMO_LISTS } from "../../config/sharePointSchema";
import type {
  IPmoApprovalRequest,
  IPmoEmployee,
  IPmoProject,
  IPmoProjectMember,
} from "../../models/domain";
import type {
  IProjectDraft,
  IProjectMemberDraft,
} from "../../validation/projects";
import {
  calculateOverlappingAllocation,
  validateProjectDraft,
  validateProjectMemberDraft,
} from "../../validation/projects";
import type { IRepositoryPage } from "../repositories/contracts";
import type {
  ApprovalRequestsRepository,
  EmployeesRepository,
  ProjectFinancialsRepository,
  ProjectMembersRepository,
  ProjectsRepository,
  WorkItemsRepository,
  ChangeRequestsRepository,
  QualityItemsRepository,
  RisksIssuesRepository,
  TimeEntriesRepository,
} from "../repositories/repositories";
import {
  ApprovalWorkflowService,
  type IApprovalWorkflowActor,
} from "./ApprovalWorkflowService";
import {
  assertProjectStatusTransition,
  generateRecordCode,
} from "./DomainRules";
import { PmoBusinessError } from "./ConfigurationManagementService";
import {
  assertCapability,
  type UserCapabilityService,
} from "./UserCapabilityService";
import type { ClosureReadinessService } from "./ClosureReadinessService";

const isoDate = (value: string): string =>
  new Date(`${value}T00:00:00`).toISOString();
const dateOnly = (value: Date): string => value.toISOString().slice(0, 10);

export const generateProjectCode = (id: number, createdOn: Date): string => {
  if (!Number.isInteger(id) || id <= 0)
    throw new Error("A positive project ID is required.");
  const paddedId = `00000${id}`.slice(-5);
  return `PRJ-${createdOn.getUTCFullYear()}-${paddedId}`;
};

export interface IProjectListFilters {
  readonly status?: IPmoProject["status"];
  readonly projectManagerId?: number;
  readonly managedByCurrentUser?: boolean;
  readonly customerName?: string;
  readonly overallHealth?: IPmoProject["overallHealth"];
  readonly atRisk?: boolean;
  readonly isActive?: boolean;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly metricsCalculatedBefore?: Date;
  readonly search?: string;
}

export interface IProjectDashboardSummary {
  readonly active: number;
  readonly drafts: number;
  readonly pendingBaseline: number;
  readonly atRisk: number;
  readonly endingSoon: number;
  readonly managedByMe: number;
}

export interface IAllocationWarning {
  readonly existingPercent: number;
  readonly proposedTotalPercent: number;
  readonly message?: string;
}

/** Domain boundary for Project, Financials and Project Member mutations. */
export class ProjectManagementService {
  public constructor(
    private readonly projects: ProjectsRepository,
    private readonly financials: ProjectFinancialsRepository,
    private readonly members: ProjectMembersRepository,
    private readonly employees: EmployeesRepository,
    private readonly approvals: ApprovalRequestsRepository,
    private readonly workItems: WorkItemsRepository,
    private readonly changes: ChangeRequestsRepository,
    private readonly quality: QualityItemsRepository,
    private readonly time: TimeEntriesRepository,
    private readonly risksIssues: RisksIssuesRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly closureReadiness?: Pick<
      ClosureReadinessService,
      "assertReady"
    >,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(
    filters: IProjectListFilters,
    continuation?: string,
    pageSize = 50,
  ): Promise<IRepositoryPage<IPmoProject>> {
    const { managedByCurrentUser, ...repositoryFilters } = filters;
    if (!managedByCurrentUser) {
      return this.projects.getPage(repositoryFilters, continuation, pageSize);
    }
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.view");
    return this.projects.getPage(
      { ...repositoryFilters, projectManagerId: actor.sharePointUserId },
      continuation,
      pageSize,
    );
  }

  public async get(projectId: number): Promise<IPmoProject> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.view");
    return this.projects.getById(projectId);
  }

  public async getDashboardSummary(): Promise<IProjectDashboardSummary> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.view");
    const ending = new Date(this.now());
    ending.setDate(ending.getDate() + 30);
    const page = async (filters: IProjectListFilters): Promise<number> =>
      (await this.projects.getPage(filters, undefined, 100)).items.length;
    const [
      active,
      drafts,
      pendingBaseline,
      amber,
      red,
      endingSoon,
      managedByMe,
    ] = await Promise.all([
      page({ status: "Active" }),
      page({ status: "Draft" }),
      page({ status: "Pending Baseline Approval" }),
      page({ overallHealth: "Amber" }),
      page({ overallHealth: "Red" }),
      page({ status: "Active", dateTo: ending }),
      page({ projectManagerId: actor.sharePointUserId }),
    ]);
    return {
      active,
      drafts,
      pendingBaseline,
      atRisk: amber + red,
      endingSoon,
      managedByMe,
    };
  }

  public async getManagedProjects(): Promise<readonly IPmoProject[]> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
    const values: IPmoProject[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.projects.getManagedBy(
        actor.sharePointUserId,
        continuation,
      );
      values.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    return values;
  }

  public async createDraft(draft: IProjectDraft): Promise<IPmoProject> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
    const errors = validateProjectDraft(draft);
    this.throwFirstValidationError(errors);
    await this.assertProjectOwners(draft);
    const created = await this.projects.create(this.projectValues(draft, true));
    const projectCode = generateProjectCode(
      created.id,
      created.created ?? this.now(),
    );
    const project = await this.projects.update(
      created.id,
      { [F.projects.ProjectCode]: projectCode },
      created.etag,
    );
    if (actor.capabilities.has("finance.manage")) {
      await this.financials.create({
        [F.projectFinancials.Title]: `${projectCode} ${project.title}`,
        [F.projectFinancials.ProjectId]: project.id,
        [F.projectFinancials.ProjectCode]: projectCode,
        [F.projectFinancials.ProjectValue]: draft.projectValue ?? null,
        [F.projectFinancials.CurrencyCode]: draft.currencyCode
          .trim()
          .toUpperCase(),
        [F.projectFinancials.BaselineCostBudget]:
          draft.baselineCostBudget ?? null,
        [F.projectFinancials.ApprovedCostBudget]:
          draft.approvedCostBudget ?? draft.baselineCostBudget ?? null,
        [F.projectFinancials.ActualCost]: 0,
        [F.projectFinancials.ForecastCost]: 0,
        [F.projectFinancials.CalculationStatus]:
          draft.projectValue === undefined ? "Missing Value" : "Complete",
      });
    }
    return project;
  }

  public async updateDraft(
    project: IPmoProject,
    draft: IProjectDraft,
  ): Promise<IPmoProject> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
    if (project.status !== "Draft") {
      throw new PmoBusinessError(
        "validation",
        "Only Draft projects can be edited from onboarding.",
      );
    }
    const errors = validateProjectDraft(draft);
    this.throwFirstValidationError(errors);
    await this.assertProjectOwners(draft);
    const updated = await this.projects.update(
      project.id,
      this.projectValues(draft, false),
      project.etag,
    );
    if (actor.capabilities.has("finance.manage")) {
      const finance = await this.financials.getByProjectId(project.id);
      if (finance) {
        await this.financials.update(
          finance.id,
          {
            [F.projectFinancials.ProjectValue]: draft.projectValue ?? null,
            [F.projectFinancials.BaselineCostBudget]:
              draft.baselineCostBudget ?? null,
            [F.projectFinancials.ApprovedCostBudget]:
              draft.approvedCostBudget ?? draft.baselineCostBudget ?? null,
          },
          finance.etag,
        );
      }
    }
    return updated;
  }

  public async submitBaseline(
    project: IPmoProject,
    approver: IApprovalWorkflowActor,
  ): Promise<IPmoApprovalRequest> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
    if (project.status !== "Draft") {
      throw new PmoBusinessError(
        "validation",
        "Only a Draft project can be submitted for baseline approval.",
      );
    }
    await this.assertActivePeople(
      project.projectManager.id,
      project.pmoOwner.id,
    );
    await this.assertApprovalAuthority(approver);
    const workflow = new ApprovalWorkflowService(
      this.approvals,
      {
        projects: this.projects,
        workItems: this.workItems,
        changeRequests: this.changes,
        qualityItems: this.quality,
        timeEntries: this.time,
      },
      this.now,
    );
    const approval = await workflow.create({
      title: `Baseline approval for ${project.projectCode ?? project.title}`,
      approvalType: "Project Baseline",
      sourceList: PMO_LISTS.projects,
      sourceItemId: project.id,
      projectId: project.id,
      projectCode: project.projectCode ?? "",
      requestedBy: {
        id: actor.sharePointUserId,
        displayName: actor.displayName,
        email: actor.email,
        loginName: actor.loginName,
      },
      approver,
      segregationOfDuties: true,
    });
    await this.projects.update(
      project.id,
      { [F.projects.Status]: "Pending Baseline Approval" },
      project.etag,
    );
    return approval;
  }

  public getTeam(
    projectId: number,
  ): Promise<IRepositoryPage<IPmoProjectMember>> {
    return this.members.getActiveByProject(projectId);
  }

  public getCandidateEmployees(): Promise<IRepositoryPage<IPmoEmployee>> {
    return this.employees.getActive(undefined, 100);
  }

  public async checkAllocation(
    draft: IProjectMemberDraft,
    existing?: IPmoProjectMember,
  ): Promise<IAllocationWarning> {
    if (!draft.employee || !draft.allocationStart || !draft.allocationEnd) {
      return { existingPercent: 0, proposedTotalPercent: 0 };
    }
    const memberships: IPmoProjectMember[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.members.getActiveForEmployee(
        draft.employee.id,
        continuation,
      );
      memberships.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    const existingPercent = calculateOverlappingAllocation(
      memberships,
      draft.employee.id,
      new Date(`${draft.allocationStart}T00:00:00`),
      new Date(`${draft.allocationEnd}T00:00:00`),
      existing?.id,
    );
    const proposedTotalPercent =
      existingPercent + (draft.allocationPercent ?? 0);
    return {
      existingPercent,
      proposedTotalPercent,
      message:
        proposedTotalPercent > draft.employee.capacityPercent
          ? `Proposed allocation reaches ${proposedTotalPercent}% against ${draft.employee.capacityPercent}% employee capacity.`
          : undefined,
    };
  }

  public async saveMember(
    project: IPmoProject,
    draft: IProjectMemberDraft,
    existing?: IPmoProjectMember,
  ): Promise<IPmoProjectMember> {
    const actor = await this.capabilities.resolveCurrent();
    if (
      !actor.capabilities.has("projects.manage") &&
      !actor.capabilities.has("resources.manage")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "You do not have permission to manage this project team.",
      );
    }
    const errors = validateProjectMemberDraft(draft, project);
    this.throwFirstValidationError(errors);
    const employee = draft.employee as IPmoEmployee;
    const overlap = await this.checkAllocation(draft, existing);
    if (overlap.proposedTotalPercent > employee.capacityPercent) {
      throw new PmoBusinessError(
        "assignment",
        overlap.message ?? "Employee allocation exceeds capacity.",
      );
    }
    const values = {
      [F.projectMembers.Title]: `${project.projectCode} ${employee.name}`,
      [F.projectMembers.ProjectId]: project.id,
      [F.projectMembers.ProjectCode]: project.projectCode,
      [F.projectMembers.EmployeeId]: employee.id,
      [`${F.projectMembers.EmployeeUser}Id`]: employee.user.id,
      [F.projectMembers.ProjectRole]: draft.projectRole,
      [F.projectMembers.Responsibility]: draft.responsibility?.trim() || null,
      [F.projectMembers.AllocationPercent]: draft.allocationPercent,
      [F.projectMembers.AllocationStart]: isoDate(draft.allocationStart),
      [F.projectMembers.AllocationEnd]: isoDate(draft.allocationEnd),
      [F.projectMembers.MembershipStatus]: "Active",
      [F.projectMembers.IsActive]: true,
    };
    return existing
      ? this.members.update(existing.id, values, existing.etag)
      : this.members.create(values);
  }

  public async endMember(
    member: IPmoProjectMember,
    reason: string,
  ): Promise<IPmoProjectMember> {
    const actor = await this.capabilities.resolveCurrent();
    if (
      !actor.capabilities.has("projects.manage") &&
      !actor.capabilities.has("resources.manage")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "You do not have permission to end project memberships.",
      );
    }
    if (!reason.trim())
      throw new PmoBusinessError(
        "validation",
        "A reason is required to end membership.",
      );
    return this.members.update(
      member.id,
      {
        [F.projectMembers.MembershipStatus]: "Ended",
        [F.projectMembers.IsActive]: false,
        [F.projectMembers.Responsibility]:
          `${member.responsibility ? `${member.responsibility}\n` : ""}Ended: ${reason.trim()}`,
      },
      member.etag,
    );
  }

  public async transitionStatus(
    project: IPmoProject,
    target: IPmoProject["status"],
    reason?: string,
    approver?: IApprovalWorkflowActor,
  ): Promise<IPmoProject | IPmoApprovalRequest> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
    assertProjectStatusTransition(project.status, target);
    if (["On Hold", "Cancelled"].indexOf(target) >= 0 && !reason?.trim()) {
      throw new PmoBusinessError("validation", `${target} requires a reason.`);
    }
    if ((target === "On Hold" || target === "Cancelled") && reason) {
      await this.recordStatusReason(project, target, reason, actor);
    }
    if (target === "Active") {
      if (project.status !== "Approved") {
        throw new PmoBusinessError(
          "validation",
          "Only an approved baseline can be activated.",
        );
      }
      const team = await this.members.getActiveByProject(project.id);
      if (!team.items.length) {
        throw new PmoBusinessError(
          "assignment",
          "Activate the project only after a delivery team is allocated.",
        );
      }
    }
    if (target === "Pending Closure") {
      if (!this.closureReadiness) {
        throw new PmoBusinessError(
          "validation",
          "Closure readiness service is not configured.",
        );
      }
      await this.closureReadiness.assertReady(project.id, {
        requireApprovedStatusReport: true,
      });
      if (!approver) {
        throw new PmoBusinessError(
          "validation",
          "A configured closure approver is required.",
        );
      }
      await this.assertApprovalAuthority(approver);
      const workflow = new ApprovalWorkflowService(
        this.approvals,
        {
          projects: this.projects,
          workItems: this.workItems,
          changeRequests: this.changes,
          qualityItems: this.quality,
          timeEntries: this.time,
        },
        this.now,
      );
      const approval = await workflow.create({
        title: `Closure approval for ${project.projectCode ?? project.title}`,
        approvalType: "Project Closure",
        sourceList: PMO_LISTS.projects,
        sourceItemId: project.id,
        projectId: project.id,
        projectCode: project.projectCode ?? "",
        requestedBy: {
          id: actor.sharePointUserId,
          displayName: actor.displayName,
          email: actor.email,
        },
        approver,
        segregationOfDuties: true,
      });
      await this.projects.update(
        project.id,
        { [F.projects.Status]: target },
        project.etag,
      );
      return approval;
    }
    return this.projects.update(
      project.id,
      { [F.projects.Status]: target },
      project.etag,
    );
  }

  private projectValues(
    draft: IProjectDraft,
    creating: boolean,
  ): Record<string, unknown> {
    return {
      [F.projects.Title]: draft.title.trim(),
      [F.projects.ProjectType]: draft.projectType,
      [F.projects.CustomerName]: draft.customerName?.trim() || null,
      [F.projects.POReference]: draft.poReference?.trim() || null,
      [F.projects.Description]: draft.description.trim(),
      [F.projects.ScopeSummary]: draft.scopeSummary.trim(),
      [F.projects.Exclusions]: draft.exclusions?.trim() || null,
      [`${F.projects.ProjectManager}Id`]: draft.projectManager?.id,
      [`${F.projects.Sponsor}Id`]: draft.sponsor?.id ?? null,
      [`${F.projects.PMOOwner}Id`]: draft.pmoOwner?.id,
      [F.projects.Priority]: draft.priority,
      [F.projects.PlannedStart]: isoDate(draft.plannedStart),
      [F.projects.BaselineEnd]: isoDate(draft.baselineEnd),
      [F.projects.CurrentApprovedEnd]: isoDate(draft.baselineEnd),
      [F.projects.BaselineEffortHours]: draft.baselineEffortHours,
      [F.projects.ApprovedEffortHours]: draft.baselineEffortHours,
      [F.projects.CurrencyCode]: draft.currencyCode.trim().toUpperCase(),
      [F.projects.Confidentiality]: draft.confidentiality,
      ...(creating
        ? {
            [F.projects.Status]: "Draft",
            [F.projects.ActualEffortHours]: 0,
            [F.projects.PercentComplete]: 0,
            [F.projects.OverallHealth]: "Not Set",
            [F.projects.BaselineVersion]: 0,
            [F.projects.CurrentPlanVersion]: 0,
            [F.projects.IsActive]: true,
          }
        : {}),
    };
  }

  private async assertApprovalAuthority(
    approver: IApprovalWorkflowActor,
  ): Promise<void> {
    const [employee, inApproverGroup] = await Promise.all([
      this.employees.getActiveBySharePointUserId(approver.id),
      this.capabilities.isUserInSecurityRole(approver.id, "approver"),
    ]);
    if (!employee?.isApprover || !inApproverGroup) {
      throw new PmoBusinessError(
        "authorization",
        "The selected approver must be an active eligible employee and a member of the PMO Approvers SharePoint group.",
      );
    }
  }

  private async assertProjectOwners(draft: IProjectDraft): Promise<void> {
    if (!draft.projectManager || !draft.pmoOwner) return;
    const [manager, owner] = await Promise.all([
      this.employees.getActiveBySharePointUserId(draft.projectManager.id),
      this.employees.getActiveBySharePointUserId(draft.pmoOwner.id),
    ]);
    if (!manager?.isProjectManager) {
      throw new PmoBusinessError(
        "assignment",
        "Project manager must be an active eligible employee.",
      );
    }
    if (!owner)
      throw new PmoBusinessError(
        "assignment",
        "PMO owner must be an active employee.",
      );
  }

  private async assertActivePeople(
    ...sharePointUserIds: number[]
  ): Promise<void> {
    const people = await Promise.all(
      sharePointUserIds.map((id) =>
        this.employees.getActiveBySharePointUserId(id),
      ),
    );
    if (people.some((person) => !person)) {
      throw new PmoBusinessError(
        "assignment",
        "Project manager and PMO owner must remain active before baseline submission.",
      );
    }
  }

  private throwFirstValidationError(
    errors: Readonly<Record<string, string>>,
  ): void {
    const firstKey = Object.keys(errors)[0];
    const message = firstKey ? errors[firstKey] : undefined;
    if (message) throw new PmoBusinessError("validation", message);
  }

  /**
   * The provisioned schema has no standalone project-action list.  A resolved
   * project Issue is therefore used as the governed, queryable action-history
   * record for direct hold and cancellation reasons; it never appears as an
   * open delivery issue.
   */
  private async recordStatusReason(
    project: IPmoProject,
    target: "On Hold" | "Cancelled",
    reason: string,
    actor: { readonly sharePointUserId: number; readonly displayName: string },
  ): Promise<void> {
    const timestamp = this.now();
    const created = await this.risksIssues.create({
      [F.risksIssues.Title]:
        `Project ${target}: ${project.projectCode ?? project.title}`,
      [F.risksIssues.RecordNumber]: `PENDING-${timestamp.valueOf()}`,
      [F.risksIssues.RecordType]: "Issue",
      [F.risksIssues.ProjectId]: project.id,
      [F.risksIssues.ProjectCode]: project.projectCode,
      [F.risksIssues.Severity]: "Low",
      [F.risksIssues.Description]: `Governed project status action: ${target}.`,
      [F.risksIssues.Impact]: reason.trim(),
      [`${F.risksIssues.Owner}Id`]: actor.sharePointUserId,
      [`${F.risksIssues.RaisedBy}Id`]: actor.sharePointUserId,
      [F.risksIssues.RaisedOn]: timestamp.toISOString(),
      [F.risksIssues.Status]: "Resolved",
      [F.risksIssues.Resolution]:
        `${target} reason recorded by ${actor.displayName}: ${reason.trim()}`,
      [F.risksIssues.ResolvedOn]: timestamp.toISOString(),
      [F.risksIssues.IsEscalated]: false,
    });
    await this.risksIssues.update(
      created.id,
      {
        [F.risksIssues.RecordNumber]: generateRecordCode(
          "Risk",
          created.id,
          created.created ?? timestamp,
        ),
      },
      created.etag,
    );
  }
}

export { dateOnly };
