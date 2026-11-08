import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type { IPmoEmployee, IPmoProjectMember } from "../../models/domain";
import type { IPmoEmployeeDraft } from "../../validation/employees";
import { validateEmployeeDraft } from "../../validation/employees";
import type { IRepositoryPage } from "../repositories/contracts";
import type {
  EmployeesRepository,
  ProjectMembersRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import type { UserCapabilityService } from "./UserCapabilityService";
import { assertCapability } from "./UserCapabilityService";
import { PmoBusinessError } from "./ConfigurationManagementService";

export interface IEmployeeListFilters {
  readonly employmentStatus?: IPmoEmployee["employmentStatus"];
  readonly department?: string;
  readonly eligibility?:
    | "projectManager"
    | "qa"
    | "approver"
    | "resourceManager";
  readonly isActive?: boolean;
  readonly search?: string;
}

export interface IEmployeeDashboardSummary {
  readonly totalActive: number;
  readonly projectManagerEligible: number;
  readonly qaEligible: number;
  readonly resourceManagerEligible: number;
  readonly inactive: number;
  readonly totalCapacityPercent: number;
  readonly averageCapacityPercent: number;
}

export class EmployeeManagementService {
  public constructor(
    private readonly employees: EmployeesRepository,
    private readonly members: ProjectMembersRepository,
    private readonly workItems: WorkItemsRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly getMaximumDailyHours: () => Promise<number>,
  ) {}

  public list(
    filters: IEmployeeListFilters,
    continuation?: string,
    pageSize = 50,
  ): Promise<IRepositoryPage<IPmoEmployee>> {
    return this.employees.getPage(filters, continuation, pageSize);
  }

  public async getById(id: number): Promise<IPmoEmployee> {
    const actor = await this.capabilities.resolveCurrent();
    if (
      actor.employee?.id !== id &&
      !actor.capabilities.has("resources.view") &&
      !actor.capabilities.has("employees.manage")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "You do not have access to this employee profile.",
      );
    }
    return this.employees.getById(id);
  }

  public async getMyProfile(): Promise<IPmoEmployee> {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.employee) {
      throw new PmoBusinessError(
        "authorization",
        "No active employee profile is linked to your account.",
      );
    }
    return actor.employee;
  }

  public getMemberships(
    employeeId: number,
  ): Promise<IRepositoryPage<IPmoProjectMember>> {
    return this.members.getActiveForEmployee(employeeId);
  }

  public async getDashboardSummary(): Promise<IEmployeeDashboardSummary> {
    const all: IPmoEmployee[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.employees.getPage({}, continuation, 100);
      all.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    const active = all.filter((employee) => employee.isActive);
    const totalCapacityPercent = active.reduce(
      (total, employee) => total + employee.capacityPercent,
      0,
    );
    return {
      totalActive: active.length,
      projectManagerEligible: active.filter(
        (employee) => employee.isProjectManager,
      ).length,
      qaEligible: active.filter((employee) => employee.isQa).length,
      resourceManagerEligible: active.filter(
        (employee) => employee.isResourceManager,
      ).length,
      inactive: all.filter((employee) => !employee.isActive).length,
      totalCapacityPercent,
      averageCapacityPercent: active.length
        ? totalCapacityPercent / active.length
        : 0,
    };
  }

  public async save(
    draft: IPmoEmployeeDraft,
    existing?: IPmoEmployee,
  ): Promise<IPmoEmployee> {
    const actor = await this.capabilities.resolveCurrent();
    try {
      assertCapability(actor, "employees.manage");
    } catch {
      throw new PmoBusinessError(
        "authorization",
        "You do not have permission to maintain employee records.",
      );
    }
    const maximum = await this.getMaximumDailyHours();
    const errors = validateEmployeeDraft(draft, maximum);
    const firstKey = Object.keys(errors)[0];
    const firstError = firstKey ? errors[firstKey] : undefined;
    if (firstError) throw new PmoBusinessError("validation", firstError);
    const duplicateNumber = await this.employees.getByEmployeeNumber(
      draft.employeeNumber.trim(),
    );
    if (duplicateNumber && duplicateNumber.id !== existing?.id) {
      throw new PmoBusinessError(
        "duplicate",
        "This Employee Number is already in use.",
      );
    }
    const duplicateEmail = await this.employees.getByEmail(draft.email.trim());
    if (duplicateEmail && duplicateEmail.id !== existing?.id) {
      throw new PmoBusinessError(
        "duplicate",
        "This Email is already linked to another employee.",
      );
    }
    const values = {
      [F.employees.Title]: draft.name.trim(),
      [F.employees.EmployeeNumber]: draft.employeeNumber.trim(),
      [`${F.employees.EmployeeUser}Id`]: draft.user?.id,
      [F.employees.Email]: draft.email.trim().toLowerCase(),
      [F.employees.Department]: draft.department.trim(),
      [F.employees.JobTitle]: draft.jobTitle?.trim() || null,
      [`${F.employees.Manager}Id`]: draft.manager?.id ?? null,
      [F.employees.Location]: draft.location?.trim() || null,
      [F.employees.EmploymentStatus]: draft.employmentStatus,
      [F.employees.EmploymentStartDate]: draft.employmentStartDate || null,
      [F.employees.EmploymentEndDate]: draft.employmentEndDate || null,
      [F.employees.StandardHoursPerDay]: draft.standardHoursPerDay,
      [F.employees.CapacityPercent]: draft.capacityPercent,
      [F.employees.SkillsSummary]: draft.skillsSummary?.trim() || null,
      [F.employees.IsProjectManager]: draft.isProjectManager,
      [F.employees.IsQA]: draft.isQa,
      [F.employees.IsApprover]: draft.isApprover,
      [F.employees.IsResourceManager]: draft.isResourceManager,
      [F.employees.IsActive]: draft.isActive,
    };
    return existing
      ? this.employees.update(existing.id, values, existing.etag)
      : this.employees.create(values);
  }

  public async setActive(
    employee: IPmoEmployee,
    active: boolean,
  ): Promise<IPmoEmployee> {
    const actor = await this.capabilities.resolveCurrent();
    try {
      assertCapability(actor, "employees.manage");
    } catch {
      throw new PmoBusinessError(
        "authorization",
        "You do not have permission to change employee status.",
      );
    }
    if (!active) {
      const [memberships, assignments] = await Promise.all([
        this.members.getActiveForEmployee(employee.id),
        this.workItems.getAssignedTo(employee.id),
      ]);
      if (memberships.items.length || assignments.items.length) {
        throw new PmoBusinessError(
          "assignment",
          "End active project memberships and reassign active work before deactivating this employee.",
        );
      }
    }
    return this.employees.update(
      employee.id,
      {
        [F.employees.IsActive]: active,
        [F.employees.EmploymentStatus]: active ? "Active" : "Inactive",
      },
      employee.etag,
    );
  }
}
