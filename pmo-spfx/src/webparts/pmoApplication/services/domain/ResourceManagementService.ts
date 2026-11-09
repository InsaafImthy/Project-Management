import type { IPmoEmployee, IPmoProjectMember } from "../../models/domain";
import type {
  EmployeesRepository,
  ProjectMembersRepository,
} from "../repositories/repositories";
import { allocationForDate, rangesOverlap } from "./DomainRules";
import { PmoBusinessError } from "./ConfigurationManagementService";
import type { UserCapabilityService } from "./UserCapabilityService";

export type ResourceAvailability =
  | "Fully allocated"
  | "Partially allocated"
  | "Available"
  | "Over-allocated";
export interface IResourceRow {
  readonly employee: IPmoEmployee;
  readonly allocationPercent: number;
  readonly capacityPercent: number;
  readonly availability: ResourceAvailability;
  readonly members: readonly IPmoProjectMember[];
  readonly warnings: readonly string[];
}
export interface IResourceDashboard {
  readonly rows: readonly IResourceRow[];
  readonly fullyAllocated: number;
  readonly partiallyAllocated: number;
  readonly available: number;
  readonly overAllocated: number;
  readonly totalCapacityPercent: number;
}

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
    values.push(...result.items);
    continuation = result.continuation;
  } while (continuation);
  return values;
};
const dateAt = (start: Date, end: Date): Date =>
  new Date(
    Math.min(Math.max(new Date().valueOf(), start.valueOf()), end.valueOf()),
  );

/** Capacity explanations are derived from the authoritative member rows; no duplicate allocation store exists. */
export class ResourceManagementService {
  public constructor(
    private readonly employees: EmployeesRepository,
    private readonly members: ProjectMembersRepository,
    private readonly capabilities: UserCapabilityService,
  ) {}

  public async dashboard(
    start: Date,
    end: Date,
    department?: string,
  ): Promise<IResourceDashboard> {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.capabilities.has("resources.view"))
      throw new PmoBusinessError(
        "authorization",
        "You do not have access to resource capacity.",
      );
    const employees = await all((continuation) =>
      this.employees.getPage({ isActive: true, department }, continuation, 100),
    );
    const rows = await Promise.all(
      employees.map((employee) => this.row(employee, start, end)),
    );
    return {
      rows,
      fullyAllocated: rows.filter(
        (row) => row.availability === "Fully allocated",
      ).length,
      partiallyAllocated: rows.filter(
        (row) => row.availability === "Partially allocated",
      ).length,
      available: rows.filter((row) => row.availability === "Available").length,
      overAllocated: rows.filter((row) => row.availability === "Over-allocated")
        .length,
      totalCapacityPercent: rows.reduce(
        (sum, row) => sum + row.capacityPercent,
        0,
      ),
    };
  }

  public async employeeDetail(
    employeeId: number,
    start: Date,
    end: Date,
  ): Promise<IResourceRow> {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.capabilities.has("resources.view"))
      throw new PmoBusinessError(
        "authorization",
        "You do not have access to resource details.",
      );
    return this.row(await this.employees.getById(employeeId), start, end);
  }

  private async row(
    employee: IPmoEmployee,
    start: Date,
    end: Date,
  ): Promise<IResourceRow> {
    const members = (
      await all((continuation) =>
        this.members.getActiveForEmployee(employee.id, continuation),
      )
    ).filter(
      (member) =>
        member.membershipStatus === "Active" &&
        rangesOverlap(member.allocationStart, member.allocationEnd, start, end),
    );
    const at = dateAt(start, end);
    const allocationPercent = allocationForDate(members, at);
    const availability: ResourceAvailability =
      allocationPercent > employee.capacityPercent
        ? "Over-allocated"
        : allocationPercent >= employee.capacityPercent &&
            employee.capacityPercent > 0
          ? "Fully allocated"
          : allocationPercent > 0
            ? "Partially allocated"
            : "Available";
    const warnings: string[] = [];
    if (allocationPercent > employee.capacityPercent)
      warnings.push(
        `Allocation is ${allocationPercent}% against ${employee.capacityPercent}% capacity.`,
      );
    const overlaps = members.some((left, index) =>
      members
        .slice(index + 1)
        .some((right) =>
          rangesOverlap(
            left.allocationStart,
            left.allocationEnd,
            right.allocationStart,
            right.allocationEnd,
          ),
        ),
    );
    if (overlaps)
      warnings.push(
        "Concurrent project allocations overlap in the selected period.",
      );
    return {
      employee,
      allocationPercent,
      capacityPercent: employee.capacityPercent,
      availability,
      members,
      warnings,
    };
  }
}
