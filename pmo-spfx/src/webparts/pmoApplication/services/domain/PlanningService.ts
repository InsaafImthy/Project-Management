import { PMO_FIELDS as F, PMO_LISTS } from "../../config/sharePointSchema";
import type {
  IPmoApprovalRequest,
  IPmoEmployee,
  IPmoPerson,
  IPmoProject,
  IPmoWorkItem,
} from "../../models/domain";
import type { IRepositoryPage } from "../repositories/contracts";
import type {
  ApprovalRequestsRepository,
  EmployeesRepository,
  ProjectsRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import {
  ApprovalWorkflowService,
  type IApprovalWorkflowActor,
} from "./ApprovalWorkflowService";
import { generateRecordCode } from "./DomainRules";
import { PmoBusinessError } from "./ConfigurationManagementService";
import {
  assertCapability,
  type UserCapabilityService,
} from "./UserCapabilityService";

const personIdField = (field: string): string => `${field}Id`;
const dateValue = (value?: string): Date | undefined =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : undefined;

export interface IWorkItemDraft {
  readonly title: string;
  readonly itemType: IPmoWorkItem["itemType"];
  readonly parentWorkItemId?: number;
  readonly description?: string;
  readonly assignedEmployee?: IPmoEmployee;
  readonly reviewer?: IPmoPerson;
  readonly qaRequired: boolean;
  readonly qaOwner?: IPmoPerson;
  readonly priority: IPmoWorkItem["priority"];
  readonly plannedStart?: string;
  readonly plannedEnd?: string;
  readonly baselineEffortHours?: number;
  readonly approvedEffortHours?: number;
  readonly forecastEffortHours?: number;
  readonly acceptanceCriteria?: string;
  readonly dependencyIds: readonly number[];
  readonly isCritical: boolean;
}

export interface IPlanValidationSummary {
  readonly approvedEffort: number;
  readonly projectApprovedEffort: number;
  readonly remainingUnplannedEffort: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Planning is deliberately one service because all item types share one list,
 * dependency graph and approval boundary.  It never updates baseline fields
 * after a plan has received approval.
 */
export class PlanningService {
  public constructor(
    private readonly projects: Pick<ProjectsRepository, "getById" | "update">,
    private readonly workItems: Pick<
      WorkItemsRepository,
      "getById" | "getByProject" | "create" | "update"
    >,
    private readonly employees: Pick<EmployeesRepository, "getById">,
    private readonly approvals: ApprovalRequestsRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public list(
    projectId: number,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoWorkItem>> {
    return this.workItems.getByProject(projectId, continuation);
  }

  public async getPlan(projectId: number): Promise<readonly IPmoWorkItem[]> {
    const values: IPmoWorkItem[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.list(projectId, continuation);
      values.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    return values;
  }

  public async create(
    project: IPmoProject,
    draft: IWorkItemDraft,
  ): Promise<IPmoWorkItem> {
    await this.assertCanManage();
    const plan = await this.getPlan(project.id);
    const errors = await this.validateDraft(project, draft, plan);
    this.throwErrors(errors);
    const values = this.valuesFor(project, draft, undefined);
    const created = await this.workItems.create(values);
    return this.workItems.update(
      created.id,
      {
        [F.workItems.WorkItemCode]: generateRecordCode(
          "Work Item",
          created.id,
          created.created ?? this.now(),
        ),
        [F.workItems.PhaseWorkItemId]: this.phaseIdFor(draft, plan, created.id),
      },
      created.etag,
    );
  }

  public async update(
    project: IPmoProject,
    current: IPmoWorkItem,
    draft: IWorkItemDraft,
  ): Promise<IPmoWorkItem> {
    await this.assertCanManage();
    const plan = await this.getPlan(project.id);
    const errors = await this.validateDraft(project, draft, plan, current.id);
    this.throwErrors(errors);
    const values = this.valuesFor(project, draft, current);
    return this.workItems.update(current.id, values, current.etag);
  }

  public async resequence(
    item: IPmoWorkItem,
    parentWorkItemId?: number,
  ): Promise<IPmoWorkItem> {
    await this.assertCanManage();
    if (parentWorkItemId === item.id)
      throw new PmoBusinessError(
        "validation",
        "A work item cannot parent itself.",
      );
    if (parentWorkItemId) {
      const parent = await this.workItems.getById(parentWorkItemId);
      if (parent.projectId !== item.projectId || !parent.isActive)
        throw new PmoBusinessError(
          "validation",
          "Select an active parent from this project.",
        );
      if (item.itemType === "Subtask" && parent.itemType === "Subtask")
        throw new PmoBusinessError(
          "validation",
          "A subtask cannot have another subtask as its parent.",
        );
    }
    return this.workItems.update(
      item.id,
      { [F.workItems.ParentWorkItemId]: parentWorkItemId },
      item.etag,
    );
  }

  public validate(
    project: IPmoProject,
    plan: readonly IPmoWorkItem[],
  ): IPlanValidationSummary {
    const taskItems = plan.filter(
      (item) => item.itemType === "Task" || item.itemType === "Subtask",
    );
    const approvedEffort = taskItems.reduce(
      (total, item) => total + (item.approvedEffortHours ?? 0),
      0,
    );
    const errors: string[] = [];
    const warnings: string[] = [];
    const ids = new Set(plan.map((item) => item.id));
    const missingOwners = taskItems.filter(
      (item) => !item.assignedTo || !item.assignedEmployeeId,
    );
    const missingDates = plan.filter(
      (item) =>
        item.itemType !== "Milestone" &&
        (!item.plannedStart || !item.plannedEnd),
    );
    if (missingOwners.length)
      errors.push(`${missingOwners.length} task(s) have no accountable owner.`);
    if (missingDates.length)
      errors.push(
        `${missingDates.length} work item(s) have missing planned dates.`,
      );
    const outside = plan.filter(
      (item) =>
        (item.plannedStart && item.plannedStart < project.plannedStart) ||
        (item.plannedEnd && item.plannedEnd > project.currentApprovedEnd),
    );
    if (outside.length)
      errors.push(
        `${outside.length} work item(s) are outside the current approved project period.`,
      );
    const qaMissing = taskItems.filter(
      (item) => item.qaRequired && !item.qaOwner,
    );
    if (qaMissing.length)
      errors.push(`${qaMissing.length} QA-required task(s) have no QA owner.`);
    const dependencyProblems = plan.filter((item) =>
      item.dependencyIds.some((id) => !ids.has(id)),
    );
    if (dependencyProblems.length)
      errors.push(
        `${dependencyProblems.length} work item(s) have missing dependencies.`,
      );
    if (this.hasCycle(plan))
      errors.push(
        "Circular dependencies must be resolved before plan submission.",
      );
    const milestoneConflicts = plan.filter(
      (item) => item.itemType === "Milestone" && !item.plannedEnd,
    );
    if (milestoneConflicts.length)
      errors.push(
        `${milestoneConflicts.length} milestone(s) have no due date.`,
      );
    if (approvedEffort > project.approvedEffortHours)
      errors.push("Planned approved effort exceeds project approved effort.");
    if (approvedEffort < project.approvedEffortHours)
      warnings.push(
        `${project.approvedEffortHours - approvedEffort} approved hour(s) remain unplanned.`,
      );
    return {
      approvedEffort,
      projectApprovedEffort: project.approvedEffortHours,
      remainingUnplannedEffort: project.approvedEffortHours - approvedEffort,
      warnings,
      errors,
    };
  }

  public async submitForExecutionPlanApproval(
    project: IPmoProject,
    approver: IApprovalWorkflowActor,
  ): Promise<IPmoApprovalRequest> {
    await this.assertCanManage();
    const validation = this.validate(project, await this.getPlan(project.id));
    this.throwErrors(validation.errors);
    if (project.status !== "Approved")
      throw new PmoBusinessError(
        "validation",
        "Execution-plan approval requires a baseline-approved project.",
      );
    const actor = await this.capabilities.resolveCurrent();
    const workflow = new ApprovalWorkflowService(
      this.approvals,
      {
        projects: this.projects,
        workItems: this.workItems,
        changeRequests: {
          getById: async () => {
            throw new Error("Not used");
          },
          update: async () => {
            throw new Error("Not used");
          },
        },
        qualityItems: {
          getById: async () => {
            throw new Error("Not used");
          },
          update: async () => {
            throw new Error("Not used");
          },
        },
        timeEntries: {
          getById: async () => {
            throw new Error("Not used");
          },
          update: async () => {
            throw new Error("Not used");
          },
        },
      },
      this.now,
    );
    return workflow.create({
      title: `Execution plan approval for ${project.projectCode ?? project.title}`,
      approvalType: "Execution Plan",
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
  }

  private async assertCanManage(): Promise<void> {
    assertCapability(
      await this.capabilities.resolveCurrent(),
      "projects.manage",
    );
  }

  private async validateDraft(
    project: IPmoProject,
    draft: IWorkItemDraft,
    plan: readonly IPmoWorkItem[],
    currentId?: number,
  ): Promise<readonly string[]> {
    const errors: string[] = [];
    if (!draft.title.trim()) errors.push("Work item title is required.");
    const start = dateValue(draft.plannedStart);
    const end = dateValue(draft.plannedEnd);
    if (end && start && end < start)
      errors.push("Planned end cannot be earlier than planned start.");
    if (draft.itemType === "Milestone" && !end)
      errors.push("A milestone requires a due date.");
    if (draft.itemType === "Phase" && (!start || !end))
      errors.push("A phase requires planned dates.");
    if (
      (draft.itemType === "Task" || draft.itemType === "Subtask") &&
      !draft.assignedEmployee
    )
      errors.push("Tasks and subtasks require an assigned active employee.");
    if (draft.itemType === "Subtask" && !draft.parentWorkItemId)
      errors.push("A subtask requires a parent work item.");
    if (
      draft.itemType === "Task" &&
      (!start ||
        !end ||
        draft.approvedEffortHours === undefined ||
        !draft.acceptanceCriteria?.trim())
    )
      errors.push(
        "A task requires dates, approved effort and acceptance criteria.",
      );
    if (draft.qaRequired && !draft.qaOwner)
      errors.push("QA owner is required when QA is required.");
    if (
      (draft.approvedEffortHours ?? 0) < 0 ||
      (draft.baselineEffortHours ?? 0) < 0 ||
      (draft.forecastEffortHours ?? 0) < 0
    )
      errors.push("Effort values must be zero or greater.");
    if (draft.assignedEmployee) {
      const employee = await this.employees.getById(draft.assignedEmployee.id);
      if (!employee.isActive || employee.employmentStatus !== "Active")
        errors.push("Assigned employee must be active.");
      if (employee.user.id !== draft.assignedEmployee.user.id)
        errors.push(
          "Assigned employee and person must identify the same employee.",
        );
    }
    const allowedIds = new Set(
      plan
        .filter((item) => item.id !== currentId && item.isActive)
        .map((item) => item.id),
    );
    if (draft.dependencyIds.some((id) => !allowedIds.has(id)))
      errors.push("Dependencies must be active work items in this project.");
    if (draft.dependencyIds.indexOf(currentId ?? -1) >= 0)
      errors.push("A work item cannot depend on itself.");
    if (draft.parentWorkItemId) {
      const parent = plan.find((item) => item.id === draft.parentWorkItemId);
      if (!parent || parent.projectId !== project.id)
        errors.push("Parent must be an active work item in this project.");
    }
    const candidate: IPmoWorkItem = {
      ...(plan.find((item) => item.id === currentId) ?? ({} as IPmoWorkItem)),
      id: currentId ?? -1,
      dependencyIds: draft.dependencyIds,
    };
    const graph = currentId
      ? plan.map((item) => (item.id === currentId ? candidate : item))
      : [...plan, candidate];
    if (this.hasCycle(graph))
      errors.push("This dependency creates a circular dependency.");
    return errors;
  }

  private valuesFor(
    project: IPmoProject,
    draft: IWorkItemDraft,
    current?: IPmoWorkItem,
  ): Record<string, unknown> {
    const values: Record<string, unknown> = {
      [F.workItems.Title]: draft.title.trim(),
      [F.workItems.ProjectId]: project.id,
      [F.workItems.ProjectCode]: project.projectCode ?? "",
      [F.workItems.ItemType]: draft.itemType,
      [F.workItems.ParentWorkItemId]: draft.parentWorkItemId,
      [F.workItems.Description]: draft.description?.trim(),
      [F.workItems.AssignedEmployeeId]: draft.assignedEmployee?.id,
      [personIdField(F.workItems.AssignedTo)]: draft.assignedEmployee?.user.id,
      [personIdField(F.workItems.Reviewer)]: draft.reviewer?.id,
      [F.workItems.QARequired]: draft.qaRequired,
      [personIdField(F.workItems.QAOwner)]: draft.qaOwner?.id,
      [F.workItems.Priority]: draft.priority,
      [F.workItems.PlannedStart]: dateValue(draft.plannedStart)?.toISOString(),
      [F.workItems.PlannedEnd]: dateValue(draft.plannedEnd)?.toISOString(),
      [F.workItems.ApprovedEffortHours]: draft.approvedEffortHours ?? 0,
      [F.workItems.ForecastEffortHours]:
        draft.forecastEffortHours ?? draft.approvedEffortHours ?? 0,
      [F.workItems.AcceptanceCriteria]: draft.acceptanceCriteria?.trim(),
      [F.workItems.DependencyIds]: draft.dependencyIds.join(";"),
      [F.workItems.IsCritical]: draft.isCritical,
    };
    if (!current)
      Object.assign(values, {
        [F.workItems.Status]: draft.assignedEmployee ? "Assigned" : "Draft",
        [F.workItems.ActualEffortHours]: 0,
        [F.workItems.PercentComplete]: 0,
        [F.workItems.PlanVersion]: project.currentPlanVersion,
        [F.workItems.IsActive]: true,
        [F.workItems.BaselineEffortHours]:
          draft.baselineEffortHours ?? draft.approvedEffortHours ?? 0,
      });
    else if (project.currentPlanVersion === 0)
      values[F.workItems.BaselineEffortHours] = current.baselineEffortHours;
    return values;
  }

  private phaseIdFor(
    draft: IWorkItemDraft,
    plan: readonly IPmoWorkItem[],
    createdId: number,
  ): number | undefined {
    if (draft.itemType === "Phase") return createdId;
    const parent = plan.find((item) => item.id === draft.parentWorkItemId);
    return parent?.itemType === "Phase" ? parent.id : parent?.phaseWorkItemId;
  }

  private hasCycle(
    items: readonly Pick<IPmoWorkItem, "id" | "dependencyIds">[],
  ): boolean {
    const graph = new Map(items.map((item) => [item.id, item.dependencyIds]));
    const visiting = new Set<number>();
    const visited = new Set<number>();
    const visit = (id: number): boolean => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      const cycle = (graph.get(id) ?? []).some(
        (dependency) => graph.has(dependency) && visit(dependency),
      );
      visiting.delete(id);
      visited.add(id);
      return cycle;
    };
    return Array.from(graph.keys()).some(visit);
  }

  private throwErrors(errors: readonly string[]): void {
    if (errors.length)
      throw new PmoBusinessError("validation", errors.join(" "));
  }
}
