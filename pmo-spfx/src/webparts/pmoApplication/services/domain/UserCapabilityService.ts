import type { IPmoEmployee, IPmoProjectMember } from "../../models/domain";
import type {
  EmployeesRepository,
  ProjectMembersRepository,
} from "../repositories/repositories";
import type { ISharePointClient } from "../sharepoint/SharePointClient";

export const PMO_GROUPS = {
  owner: "PMO Owners",
  projectManager: "PMO Project Managers",
  employee: "PMO Employees",
  qa: "PMO QA",
  resourceManager: "PMO Resource Managers",
  approver: "PMO Approvers",
  finance: "PMO Finance",
  executive: "PMO Executives",
  timeApprover: "PMO Time Approvers",
  support: "PMO Support",
} as const;

export type PmoSecurityRole = keyof typeof PMO_GROUPS;
export type PmoCapability =
  | "employees.view-own"
  | "employees.manage"
  | "work.view-own"
  | "work.act-own"
  | "time.view-own"
  | "time.edit-own"
  | "time.review"
  | "projects.view"
  | "projects.manage"
  | "quality.view"
  | "quality.manage"
  | "resources.view"
  | "resources.manage"
  | "approvals.view"
  | "approvals.decide"
  | "finance.view"
  | "finance.project-summary"
  | "finance.manage"
  | "portfolio.view"
  | "support.failed-actions"
  | "configuration.manage";

/**
 * Break-glass administrators whose application authorization must not depend on
 * SharePoint group or PMO employee-list membership. Keep this list deliberately
 * small: entries receive every application role and capability.
 */
const ADMINISTRATOR_OVERRIDE_EMAILS = new Set([
  "insaaf.imthiyas@aufaittechnologies.com",
]);

const ALL_CAPABILITIES: readonly PmoCapability[] = [
  "employees.view-own",
  "employees.manage",
  "work.view-own",
  "work.act-own",
  "time.view-own",
  "time.edit-own",
  "time.review",
  "projects.view",
  "projects.manage",
  "quality.view",
  "quality.manage",
  "resources.view",
  "resources.manage",
  "approvals.view",
  "approvals.decide",
  "finance.view",
  "finance.project-summary",
  "finance.manage",
  "portfolio.view",
  "support.failed-actions",
  "configuration.manage",
];

const isAdministratorOverride = (email: string): boolean =>
  ADMINISTRATOR_OVERRIDE_EMAILS.has(email.trim().toLowerCase());

export interface IPmoEligibility {
  readonly isProjectManager: boolean;
  readonly isQa: boolean;
  readonly isApprover: boolean;
  readonly isResourceManager: boolean;
}

export interface IPmoResolvedUserContext {
  readonly sharePointUserId: number;
  readonly displayName: string;
  readonly email: string;
  readonly loginName: string;
  readonly employee?: IPmoEmployee;
  /** Business eligibility never grants access without its security role. */
  readonly eligibility: IPmoEligibility;
  /** SharePoint groups are the security-role source. */
  readonly securityRoles: ReadonlySet<PmoSecurityRole>;
  readonly capabilities: ReadonlySet<PmoCapability>;
}

interface ICurrentUserWire {
  readonly Id: number;
  readonly Title: string;
  readonly Email: string;
  readonly LoginName: string;
}

interface IGroupsWire {
  readonly value?: readonly { readonly Title: string }[];
  readonly d?: { readonly results?: readonly { readonly Title: string }[] };
}

interface IUserMembershipWire {
  readonly value?: readonly { readonly Id: number }[];
  readonly d?: { readonly results?: readonly { readonly Id: number }[] };
}

const capabilitiesFor = (
  roles: ReadonlySet<PmoSecurityRole>,
  eligibility: IPmoEligibility,
  hasEmployee: boolean,
): ReadonlySet<PmoCapability> => {
  const values = new Set<PmoCapability>();
  if (roles.has("employee") && hasEmployee) {
    values.add("employees.view-own");
    values.add("work.view-own");
    values.add("work.act-own");
    values.add("time.view-own");
    values.add("time.edit-own");
  }
  if (roles.has("timeApprover")) values.add("time.review");
  if (roles.has("projectManager") && eligibility.isProjectManager) {
    values.add("projects.view");
    values.add("projects.manage");
    values.add("quality.view");
    values.add("resources.view");
    values.add("time.review");
    // The Project Managers SharePoint group is the explicit approval boundary
    // for aggregate summaries. Detailed rates and costs still require
    // finance.view.
    values.add("finance.project-summary");
  }
  if (roles.has("qa") && eligibility.isQa) {
    values.add("quality.view");
    values.add("quality.manage");
  }
  if (roles.has("resourceManager") && eligibility.isResourceManager) {
    values.add("resources.view");
    values.add("resources.manage");
    values.add("projects.view");
  }
  if (roles.has("approver") && eligibility.isApprover) {
    values.add("approvals.view");
    values.add("approvals.decide");
  }
  if (roles.has("finance")) {
    values.add("employees.manage");
    values.add("finance.view");
    values.add("finance.project-summary");
    values.add("finance.manage");
  }
  if (roles.has("executive")) {
    values.add("projects.view");
    values.add("portfolio.view");
    values.add("approvals.view");
    values.add("finance.view");
    values.add("finance.project-summary");
  }
  if (roles.has("support")) values.add("support.failed-actions");
  if (roles.has("owner")) {
    (
      [
        "work.view-own",
        "time.review",
        "employees.view-own",
        "employees.manage",
        "projects.view",
        "projects.manage",
        "quality.view",
        "quality.manage",
        "resources.view",
        "resources.manage",
        "approvals.view",
        "approvals.decide",
        "finance.view",
        "finance.project-summary",
        "finance.manage",
        "portfolio.view",
        "support.failed-actions",
        "configuration.manage",
      ] as const
    ).forEach((capability) => values.add(capability));
  }
  return values;
};

export class UserCapabilityService {
  private cached?: Promise<IPmoResolvedUserContext>;

  public constructor(
    private readonly client: ISharePointClient,
    private readonly employees: Pick<EmployeesRepository, "getActiveByEmail">,
    private readonly projectMembers: Pick<
      ProjectMembersRepository,
      "getActiveForEmployee"
    >,
  ) {}

  public resolveCurrent(): Promise<IPmoResolvedUserContext> {
    this.cached ??= this.resolveUncached();
    return this.cached;
  }

  public refresh(): Promise<IPmoResolvedUserContext> {
    this.cached = undefined;
    return this.resolveCurrent();
  }

  public async getProjectMemberships(): Promise<readonly IPmoProjectMember[]> {
    const user = await this.resolveCurrent();
    if (!user.employee) return [];
    const memberships: IPmoProjectMember[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.projectMembers.getActiveForEmployee(
        user.employee.id,
        continuation,
      );
      memberships.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    return memberships;
  }

  /** Resolves a configured approver against the actual SharePoint group. */
  public async isUserInSecurityRole(
    sharePointUserId: number,
    role: PmoSecurityRole,
  ): Promise<boolean> {
    const current = await this.resolveCurrent();
    if (
      current.sharePointUserId === sharePointUserId &&
      isAdministratorOverride(current.email)
    ) {
      return true;
    }
    const group = encodeURIComponent(PMO_GROUPS[role].replace(/'/g, "''"));
    const response = await this.client.getJson<IUserMembershipWire>(
      `_api/web/sitegroups/getbyname('${group}')/users?$select=Id&$filter=Id eq ${sharePointUserId}`,
    );
    return (response.value ?? response.d?.results ?? []).some(
      (user) => user.Id === sharePointUserId,
    );
  }

  private async resolveUncached(): Promise<IPmoResolvedUserContext> {
    const [current, groups] = await Promise.all([
      this.client.getJson<ICurrentUserWire>(
        "_api/web/currentuser?$select=Id,Title,Email,LoginName",
      ),
      this.client.getJson<IGroupsWire>(
        "_api/web/currentuser/groups?$select=Title",
      ),
    ]);
    const normalizedEmail = current.Email.trim().toLowerCase();
    const hasAdministratorOverride = isAdministratorOverride(normalizedEmail);
    const employee =
      current.Email && !hasAdministratorOverride
        ? await this.employees.getActiveByEmail(current.Email)
        : undefined;
    const groupTitles = new Set(
      (groups.value ?? groups.d?.results ?? []).map((group) => group.Title),
    );
    const securityRoles = new Set<PmoSecurityRole>();
    const allRoles = Object.keys(PMO_GROUPS) as PmoSecurityRole[];
    allRoles.forEach((role) => {
      if (hasAdministratorOverride || groupTitles.has(PMO_GROUPS[role])) {
        securityRoles.add(role);
      }
    });
    const eligibility: IPmoEligibility = hasAdministratorOverride
      ? {
          isProjectManager: true,
          isQa: true,
          isApprover: true,
          isResourceManager: true,
        }
      : {
          isProjectManager: employee?.isProjectManager ?? false,
          isQa: employee?.isQa ?? false,
          isApprover: employee?.isApprover ?? false,
          isResourceManager: employee?.isResourceManager ?? false,
        };
    return {
      sharePointUserId: current.Id,
      displayName: current.Title,
      email: normalizedEmail,
      loginName: current.LoginName,
      employee,
      eligibility,
      securityRoles,
      capabilities: hasAdministratorOverride
        ? new Set(ALL_CAPABILITIES)
        : capabilitiesFor(securityRoles, eligibility, employee !== undefined),
    };
  }
}

export const hasCapability = (
  user: IPmoResolvedUserContext,
  capability: PmoCapability,
): boolean => user.capabilities.has(capability);

export const assertCapability = (
  user: IPmoResolvedUserContext,
  capability: PmoCapability,
): void => {
  if (!hasCapability(user, capability)) {
    throw new Error(`Not authorized for ${capability}.`);
  }
};

const routeCapabilities: Readonly<Record<string, PmoCapability | undefined>> = {
  home: undefined,
  "my-work": "work.view-own",
  "my-time": "time.view-own",
  "my-learning": "time.view-own",
  "time-daily": "time.view-own",
  "time-weekly": "time.view-own",
  "time-review": "time.review",
  reviews: "projects.manage",
  projects: "projects.view",
  approvals: "approvals.view",
  quality: "quality.view",
  resources: "resources.view",
  "learning-manage": "resources.manage",
  portfolio: "portfolio.view",
  "financial-summary": "finance.view",
  "employee-rates": "finance.view",
  "project-costs": "finance.view",
  "project-financials": "finance.project-summary",
  settings: "configuration.manage",
  "settings-list": "configuration.manage",
  employees: "resources.view",
  "employee-list": "resources.view",
  employee: "resources.view",
  "my-profile": "employees.view-own",
};

export const canOpenRoute = (
  user: IPmoResolvedUserContext,
  route: string,
): boolean => {
  if (!(route in routeCapabilities)) return false;
  const capability = routeCapabilities[route];
  return capability === undefined || hasCapability(user, capability);
};

export const canAccessProject = (
  user: IPmoResolvedUserContext,
  memberships: readonly IPmoProjectMember[],
  projectId: number,
): boolean =>
  user.securityRoles.has("owner") ||
  user.securityRoles.has("executive") ||
  memberships.some(
    (membership) => membership.projectId === projectId && membership.isActive,
  );

export const canReadRestrictedFinancials = (
  user: IPmoResolvedUserContext,
): boolean =>
  user.securityRoles.has("owner") ||
  user.securityRoles.has("finance") ||
  user.securityRoles.has("executive");

export const canReadProjectFinancialSummary = (
  user: IPmoResolvedUserContext,
): boolean =>
  canReadRestrictedFinancials(user) ||
  user.capabilities.has("finance.project-summary");
