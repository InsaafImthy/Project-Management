import {
  PMO_FIELDS as F,
  PMO_LIBRARIES,
  PMO_LISTS,
  type PmoContainerName,
} from "../../config/sharePointSchema";
import type { ISharePointItemWire } from "../../models/sharePoint";
import type { ISharePointClient } from "../sharepoint/SharePointClient";
import { SharePointError } from "../sharepoint/SharePointError";
import {
  assertCapability,
  type IPmoResolvedUserContext,
  type UserCapabilityService,
} from "./UserCapabilityService";

export interface IPmoPermissionDiagnostic {
  readonly containerName: PmoContainerName;
  readonly connected: boolean;
  readonly canRead: boolean;
  readonly canAdd: boolean;
  readonly canEdit: boolean;
  readonly expectedRead: boolean;
  readonly expectedWrite: boolean;
  readonly ready: boolean;
  readonly supportReference?: string;
}

export interface IPmoFailedActionDiagnostic {
  readonly kind: "Task Action" | "Approval Request";
  readonly id: number;
  readonly reference: string;
  readonly projectCode?: string;
  readonly actionType: string;
  readonly occurredOn?: Date;
  readonly safeResult?: string;
}

export interface IPmoSupportDiagnosticResult {
  readonly checkedOn: Date;
  readonly actorDisplayName: string;
  readonly capabilities: readonly string[];
  readonly securityRoles: readonly string[];
  readonly permissions: readonly IPmoPermissionDiagnostic[];
  readonly failedActions: readonly IPmoFailedActionDiagnostic[];
  readonly administratorReadiness: boolean;
}

interface IBasePermissionsWire {
  readonly High?: string;
  readonly Low?: string;
}

interface IListPermissionsWire {
  readonly EffectiveBasePermissions?: IBasePermissionsWire;
  readonly d?: { readonly EffectiveBasePermissions?: IBasePermissionsWire };
}

interface IFailedTaskActionWire extends ISharePointItemWire {
  readonly WorkItemCode?: string;
  readonly ProjectCode?: string;
  readonly ActionType?: string;
  readonly RequestedOn?: string;
  readonly ResultMessage?: string;
}

interface IFailedApprovalWire extends ISharePointItemWire {
  readonly ApprovalNumber?: string;
  readonly ProjectCode?: string;
  readonly ApprovalType?: string;
  readonly Modified?: string;
}

const containers: readonly PmoContainerName[] = [
  PMO_LISTS.config,
  PMO_LISTS.employees,
  PMO_LISTS.employeeRates,
  PMO_LISTS.projects,
  PMO_LISTS.projectFinancials,
  PMO_LISTS.projectMembers,
  PMO_LISTS.workItems,
  PMO_LISTS.taskActions,
  PMO_LISTS.timeEntries,
  PMO_LISTS.changeRequests,
  PMO_LISTS.approvalRequests,
  PMO_LISTS.risksIssues,
  PMO_LISTS.qualityItems,
  PMO_LISTS.learningAssignments,
  PMO_LISTS.projectCosts,
  PMO_LISTS.projectStatusReports,
  PMO_LISTS.importBatches,
  PMO_LIBRARIES.projectDocuments,
];

const restrictedContainers = new Set<PmoContainerName>([
  PMO_LISTS.employeeRates,
  PMO_LISTS.projectFinancials,
  PMO_LISTS.projectCosts,
]);

const supportWriteContainers = new Set<PmoContainerName>([
  PMO_LISTS.taskActions,
  PMO_LISTS.changeRequests,
  PMO_LISTS.approvalRequests,
  PMO_LISTS.risksIssues,
  PMO_LISTS.qualityItems,
  PMO_LISTS.learningAssignments,
  PMO_LISTS.projectStatusReports,
  PMO_LISTS.importBatches,
  PMO_LIBRARIES.projectDocuments,
]);

const permissionBit = (kind: number): number => 2 ** (kind - 1);
const hasLowPermission = (
  permissions: IBasePermissionsWire,
  kind: number,
): boolean => {
  const low = Number(permissions.Low ?? "0") >>> 0;
  return (low & permissionBit(kind)) !== 0;
};

const supportReference = (error: unknown): string | undefined =>
  error instanceof SharePointError ? error.correlationId : undefined;

const safeFailureMessage = (value?: string): string | undefined => {
  if (!value) return undefined;
  const correlation = /correlation id:\s*([a-z0-9-]+)/i.exec(value)?.[1];
  return correlation
    ? `Processing failed. Support reference: ${correlation}.`
    : "Processing failed. Open the governed record for authorized retry details.";
};

/**
 * Metadata-only diagnostics. It reads effective permissions and minimal failed
 * action identifiers; it never reads financial values or business narratives.
 */
export class SupportDiagnosticsService {
  public constructor(
    private readonly client: ISharePointClient,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async run(): Promise<IPmoSupportDiagnosticResult> {
    const actor = await this.capabilities.resolveCurrent();
    if (
      !actor.capabilities.has("support.failed-actions") &&
      !actor.capabilities.has("configuration.manage")
    ) {
      assertCapability(actor, "support.failed-actions");
    }
    const administrator = actor.capabilities.has("configuration.manage");
    const visibleContainers = administrator
      ? containers
      : containers.filter((container) => !restrictedContainers.has(container));
    const permissions = await Promise.all(
      visibleContainers.map((container) =>
        this.checkContainer(container, actor, administrator),
      ),
    );
    const failedActions = await this.loadFailedActions();
    return {
      checkedOn: this.now(),
      actorDisplayName: actor.displayName,
      capabilities: Array.from(actor.capabilities).sort(),
      securityRoles: Array.from(actor.securityRoles).sort(),
      permissions,
      failedActions,
      administratorReadiness:
        administrator && permissions.every((permission) => permission.ready),
    };
  }

  private async checkContainer(
    containerName: PmoContainerName,
    actor: IPmoResolvedUserContext,
    administrator: boolean,
  ): Promise<IPmoPermissionDiagnostic> {
    const expectedWrite =
      administrator ||
      (actor.capabilities.has("support.failed-actions") &&
        supportWriteContainers.has(containerName));
    try {
      const encoded = containerName.replace(/'/g, "''");
      const response = await this.client.getJson<IListPermissionsWire>(
        `_api/web/lists/getbytitle('${encoded}')?$select=EffectiveBasePermissions`,
      );
      const effective =
        response.EffectiveBasePermissions ??
        response.d?.EffectiveBasePermissions ??
        {};
      // SharePoint PermissionKind values: ViewListItems=1, AddListItems=2,
      // EditListItems=3. These are all in the low 32-bit mask.
      const canRead = hasLowPermission(effective, 1);
      const canAdd = hasLowPermission(effective, 2);
      const canEdit = hasLowPermission(effective, 3);
      return {
        containerName,
        connected: true,
        canRead,
        canAdd,
        canEdit,
        expectedRead: true,
        expectedWrite,
        ready: canRead && (!expectedWrite || (canAdd && canEdit)),
      };
    } catch (error) {
      return {
        containerName,
        connected: false,
        canRead: false,
        canAdd: false,
        canEdit: false,
        expectedRead: true,
        expectedWrite,
        ready: false,
        supportReference: supportReference(error),
      };
    }
  }

  private async loadFailedActions(): Promise<
    readonly IPmoFailedActionDiagnostic[]
  > {
    const [taskActions, approvals] = await Promise.all([
      this.client.query<IFailedTaskActionWire>(PMO_LISTS.taskActions, {
        select: [
          F.taskActions.ID,
          F.taskActions.WorkItemCode,
          F.taskActions.ProjectCode,
          F.taskActions.ActionType,
          F.taskActions.RequestedOn,
          F.taskActions.ResultMessage,
        ],
        filter: `${F.taskActions.ProcessingStatus} eq 'Failed'`,
        orderBy: [`${F.taskActions.RequestedOn} asc`],
        top: 50,
      }),
      this.client.query<IFailedApprovalWire>(PMO_LISTS.approvalRequests, {
        select: [
          F.approvalRequests.ID,
          F.approvalRequests.ApprovalNumber,
          F.approvalRequests.ProjectCode,
          F.approvalRequests.ApprovalType,
          F.approvalRequests.Modified,
        ],
        filter: `${F.approvalRequests.FlowProcessingStatus} eq 'Failed'`,
        orderBy: [`${F.approvalRequests.Modified} asc`],
        top: 50,
      }),
    ]);
    return [
      ...taskActions.items.map((item) => ({
        kind: "Task Action" as const,
        id: item.ID,
        reference: item.WorkItemCode ?? `Task action ${item.ID}`,
        projectCode: item.ProjectCode,
        actionType: item.ActionType ?? "Task action",
        occurredOn: item.RequestedOn ? new Date(item.RequestedOn) : undefined,
        safeResult: safeFailureMessage(item.ResultMessage),
      })),
      ...approvals.items.map((item) => ({
        kind: "Approval Request" as const,
        id: item.ID,
        reference: item.ApprovalNumber ?? `Approval ${item.ID}`,
        projectCode: item.ProjectCode,
        actionType: item.ApprovalType ?? "Approval",
        occurredOn: item.Modified ? new Date(item.Modified) : undefined,
        safeResult:
          "Processing failed. Open the approval record for authorized retry details.",
      })),
    ];
  }
}
