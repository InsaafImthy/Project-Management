import { PMO_FIELDS as F, PMO_LISTS } from "../../config/sharePointSchema";
import type { IPmoPerson, IPmoQualityItem } from "../../models/domain";
import type { IRepositoryPage } from "../repositories/contracts";
import type {
  ApprovalRequestsRepository,
  EmployeesRepository,
  IQualityItemListFilters,
  ProjectsRepository,
  QualityItemsRepository,
  TimeEntriesRepository,
  WorkItemsRepository,
  ChangeRequestsRepository,
} from "../repositories/repositories";
import { ApprovalWorkflowService } from "./ApprovalWorkflowService";
import { generateRecordCode } from "./DomainRules";
import {
  assertCapability,
  type UserCapabilityService,
} from "./UserCapabilityService";

const personIdField = (field: string): string => `${field}Id`;
const trimmed = (value?: string): string | undefined =>
  value?.trim() || undefined;

export interface IQualityItemDraft {
  readonly title: string;
  readonly qualityType: IPmoQualityItem["qualityType"];
  readonly projectId?: number;
  readonly projectCode?: string;
  readonly workItemId?: number;
  readonly releaseName?: string;
  readonly testResult?: IPmoQualityItem["testResult"];
  readonly severity?: IPmoQualityItem["severity"];
  readonly priority?: IPmoQualityItem["priority"];
  readonly description: string;
  readonly evidenceLink?: string;
  readonly assignedTo?: IPmoPerson;
  readonly targetFixDate?: string;
  readonly customerImpact?: string;
  readonly rootCauseCategory?: IPmoQualityItem["rootCauseCategory"];
  readonly rootCauseDetails?: string;
  readonly isReleaseBlocking: boolean;
}

export type QualityValidationErrors = Readonly<Record<string, string>>;

export const validateQualityItem = (
  draft: IQualityItemDraft,
  targetStatus: IPmoQualityItem["status"] = "New",
): QualityValidationErrors => {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = "A quality-item summary is required.";
  if (!draft.projectId || draft.projectId <= 0)
    errors.projectId = "A project is required.";
  if (!draft.description.trim())
    errors.description = "A description is required.";
  if (draft.qualityType === "Test Result") {
    if (!draft.workItemId)
      errors.workItemId = "A test result must reference a work item.";
    if (!draft.testResult)
      errors.testResult = "A test result value is required.";
    if (
      (draft.testResult === "Fail" || draft.testResult === "Blocked") &&
      !trimmed(draft.evidenceLink)
    )
      errors.evidenceLink = "Failed or blocked testing requires evidence.";
  }
  if (
    (draft.qualityType === "Defect" ||
      draft.qualityType === "Production Defect") &&
    !draft.severity
  )
    errors.severity = "Defects require a severity.";
  if (
    ["Assigned", "In Fix", "Ready for Retest"].indexOf(targetStatus) >= 0 &&
    !draft.assignedTo
  )
    errors.assignedTo = "An owner is required before assignment.";
  if (
    draft.qualityType === "Production Defect" &&
    !trimmed(draft.customerImpact)
  )
    errors.customerImpact = "Production defects require customer impact.";
  if (draft.qualityType === "Release Exception" && !draft.isReleaseBlocking)
    errors.isReleaseBlocking =
      "A release exception must identify the blocked release control.";
  return errors;
};

export interface IQualityDashboardSummary {
  readonly awaitingAction: number;
  readonly failedTests: number;
  readonly openDefectsBySeverity: Readonly<Record<string, number>>;
  readonly releaseBlocking: number;
  readonly readyForRetest: number;
  readonly productionDefects: number;
  readonly exceptionsAwaitingApproval: number;
  readonly critical: number;
  readonly overdue: number;
  readonly asOf: Date;
}

const isOpen = (item: IPmoQualityItem): boolean =>
  ["Closed", "Passed", "Rejected"].indexOf(item.status) < 0;

/** SharePoint-backed quality lifecycle and QA-exception routing boundary. */
export class QualityGovernanceService {
  public constructor(
    private readonly quality: QualityItemsRepository,
    private readonly approvals: ApprovalRequestsRepository,
    private readonly projects: ProjectsRepository,
    private readonly workItems: WorkItemsRepository,
    private readonly changes: ChangeRequestsRepository,
    private readonly time: TimeEntriesRepository,
    private readonly employees: EmployeesRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(
    filters: IQualityItemListFilters,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoQualityItem>> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "quality.view");
    return this.quality.getPage(filters, continuation);
  }

  public async get(id: number): Promise<IPmoQualityItem> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "quality.view");
    return this.quality.getById(id);
  }

  public async dashboard(): Promise<IQualityDashboardSummary> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "quality.view");
    const now = this.now();
    const [
      awaiting,
      failed,
      defects,
      blocking,
      retest,
      production,
      exceptions,
      critical,
      overdue,
    ] = await Promise.all([
      this.quality.getPage({ status: "New" }, undefined, 100),
      this.quality.getPage({ testResult: "Fail" }, undefined, 100),
      this.quality.getPage(
        { qualityType: "Defect", openOnly: true },
        undefined,
        100,
      ),
      this.quality.getPage(
        { releaseBlocking: true, openOnly: true },
        undefined,
        100,
      ),
      this.quality.getPage({ status: "Ready for Retest" }, undefined, 100),
      this.quality.getPage(
        { qualityType: "Production Defect", openOnly: true },
        undefined,
        100,
      ),
      this.quality.getPage(
        { qualityType: "Release Exception", status: "In Review" },
        undefined,
        100,
      ),
      this.quality.getPage(
        { severity: "Critical", openOnly: true },
        undefined,
        100,
      ),
      this.quality.getPage(
        { overdueBefore: now, openOnly: true },
        undefined,
        100,
      ),
    ]);
    const bySeverity: Record<string, number> = {
      Low: 0,
      Medium: 0,
      High: 0,
      Critical: 0,
    };
    defects.items.forEach((item) => {
      if (item.severity)
        bySeverity[item.severity] = (bySeverity[item.severity] ?? 0) + 1;
    });
    return {
      awaitingAction: awaiting.items.length,
      failedTests: failed.items.filter(isOpen).length,
      openDefectsBySeverity: bySeverity,
      releaseBlocking: blocking.items.length,
      readyForRetest: retest.items.length,
      productionDefects: production.items.length,
      exceptionsAwaitingApproval: exceptions.items.length,
      critical: critical.items.length,
      overdue: overdue.items.length,
      asOf: now,
    };
  }

  public async save(
    draft: IQualityItemDraft,
    existing?: IPmoQualityItem,
  ): Promise<IPmoQualityItem> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "quality.manage");
    const errors = validateQualityItem(draft, existing?.status ?? "New");
    const firstKey = Object.keys(errors)[0];
    const first = firstKey ? errors[firstKey] : undefined;
    if (first) throw new Error(first);
    const project = await this.projects.getById(draft.projectId as number);
    const status: IPmoQualityItem["status"] =
      draft.qualityType === "Test Result" && draft.testResult === "Pass"
        ? "Passed"
        : (existing?.status ?? "New");
    const values: Record<string, unknown> = {
      [F.qualityItems.Title]: draft.title.trim(),
      [F.qualityItems.QualityType]: draft.qualityType,
      [F.qualityItems.ProjectId]: project.id,
      [F.qualityItems.ProjectCode]:
        project.projectCode ?? draft.projectCode ?? "",
      [F.qualityItems.WorkItemId]: draft.workItemId ?? null,
      [F.qualityItems.ReleaseName]: trimmed(draft.releaseName) ?? null,
      [F.qualityItems.Status]: status,
      [F.qualityItems.TestResult]: draft.testResult ?? null,
      [F.qualityItems.Severity]: draft.severity ?? null,
      [F.qualityItems.Priority]: draft.priority ?? null,
      [F.qualityItems.Description]: draft.description.trim(),
      [F.qualityItems.EvidenceLink]: trimmed(draft.evidenceLink)
        ? { Url: draft.evidenceLink?.trim(), Description: "Quality evidence" }
        : null,
      [personIdField(F.qualityItems.AssignedTo)]: draft.assignedTo?.id ?? null,
      [F.qualityItems.TargetFixDate]: draft.targetFixDate
        ? new Date(`${draft.targetFixDate}T00:00:00`).toISOString()
        : null,
      [F.qualityItems.RootCauseCategory]: draft.rootCauseCategory ?? null,
      [F.qualityItems.RootCauseDetails]:
        trimmed(draft.rootCauseDetails) ?? null,
      [F.qualityItems.CustomerImpact]: trimmed(draft.customerImpact) ?? null,
      [F.qualityItems.IsReleaseBlocking]: draft.isReleaseBlocking,
    };
    if (existing)
      return this.quality.update(existing.id, values, existing.etag);
    const raisedOn = this.now();
    const created = await this.quality.create({
      ...values,
      [F.qualityItems.QualityNumber]: `PENDING-${raisedOn.valueOf()}`,
      [personIdField(F.qualityItems.RaisedBy)]: actor.sharePointUserId,
      [F.qualityItems.RaisedOn]: raisedOn.toISOString(),
      [F.qualityItems.FixEffortHours]: 0,
    });
    return this.quality.update(
      created.id,
      {
        [F.qualityItems.QualityNumber]: generateRecordCode(
          "Quality",
          created.id,
          created.created ?? raisedOn,
        ),
      },
      created.etag,
    );
  }

  public async createLinkedDefect(
    failedTest: IPmoQualityItem,
    draft: IQualityItemDraft,
  ): Promise<IPmoQualityItem> {
    if (
      failedTest.qualityType !== "Test Result" ||
      failedTest.testResult !== "Fail"
    )
      throw new Error(
        "A linked defect can only be created from a failed test.",
      );
    return this.save({
      ...draft,
      qualityType: "Defect",
      projectId: failedTest.projectId,
      projectCode: failedTest.projectCode,
      workItemId: failedTest.workItemId,
      releaseName: failedTest.releaseName,
      description: `${draft.description.trim()}\nLinked failed test: ${failedTest.qualityNumber}.`,
    });
  }

  public async assign(
    item: IPmoQualityItem,
    assignedTo: IPmoPerson,
  ): Promise<IPmoQualityItem> {
    await this.assertManage();
    if (item.qualityType === "Test Result")
      throw new Error("Test results are not assigned as defects.");
    if (!item.severity && item.qualityType !== "Release Exception")
      throw new Error("Severity is required before assignment.");
    return this.quality.update(
      item.id,
      {
        [personIdField(F.qualityItems.AssignedTo)]: assignedTo.id,
        [F.qualityItems.Status]: "Assigned",
      },
      item.etag,
    );
  }

  public async recordFix(
    item: IPmoQualityItem,
    effortHours: number,
    evidenceLink: string,
    rootCauseCategory?: IPmoQualityItem["rootCauseCategory"],
    rootCauseDetails?: string,
  ): Promise<IPmoQualityItem> {
    await this.assertManage();
    if (["Assigned", "In Fix", "Retest Failed"].indexOf(item.status) < 0)
      throw new Error("Only an assigned or returned defect can record a fix.");
    if (!Number.isFinite(effortHours) || effortHours < 0)
      throw new Error("Fix effort must be zero or greater.");
    if (!evidenceLink.trim()) throw new Error("Fix evidence is required.");
    return this.quality.update(
      item.id,
      {
        [F.qualityItems.Status]: "In Fix",
        [F.qualityItems.FixEffortHours]: effortHours,
        [F.qualityItems.EvidenceLink]: {
          Url: evidenceLink.trim(),
          Description: "Fix evidence",
        },
        [F.qualityItems.RootCauseCategory]: rootCauseCategory ?? null,
        [F.qualityItems.RootCauseDetails]: trimmed(rootCauseDetails) ?? null,
      },
      item.etag,
    );
  }

  public async submitForRetest(
    item: IPmoQualityItem,
  ): Promise<IPmoQualityItem> {
    await this.assertManage();
    if (item.status !== "In Fix")
      throw new Error("A fix must be recorded before retest submission.");
    if (!item.evidenceLink?.url)
      throw new Error("Fix evidence is required before retest submission.");
    return this.quality.update(
      item.id,
      { [F.qualityItems.Status]: "Ready for Retest" },
      item.etag,
    );
  }

  public async recordRetest(
    item: IPmoQualityItem,
    result: NonNullable<IPmoQualityItem["retestResult"]>,
  ): Promise<IPmoQualityItem> {
    const actor = await this.assertManage();
    if (item.status !== "Ready for Retest")
      throw new Error("Only a ready item can be retested.");
    return this.quality.update(
      item.id,
      {
        [F.qualityItems.RetestResult]: result,
        [personIdField(F.qualityItems.RetestedBy)]: actor.sharePointUserId,
        [F.qualityItems.RetestedOn]: this.now().toISOString(),
        [F.qualityItems.Status]: result === "Pass" ? "Closed" : "Retest Failed",
      },
      item.etag,
    );
  }

  public async conclude(
    item: IPmoQualityItem,
    target: "Closed" | "Deferred" | "Rejected",
    reason: string,
  ): Promise<IPmoQualityItem> {
    await this.assertManage();
    if (!reason.trim()) throw new Error(`${target} requires a reason.`);
    if (
      target === "Closed" &&
      item.status !== "Passed" &&
      item.retestResult !== "Pass"
    )
      throw new Error("A defect can close only after a passing retest.");
    return this.quality.update(
      item.id,
      {
        [F.qualityItems.Status]: target,
        [F.qualityItems.RootCauseDetails]: [
          item.rootCauseDetails,
          `${target} reason: ${reason.trim()}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      item.etag,
    );
  }

  public async submitException(
    item: IPmoQualityItem,
  ): Promise<IPmoQualityItem> {
    const actor = await this.assertManage();
    if (item.qualityType !== "Release Exception")
      throw new Error("Only a release exception can be routed for approval.");
    if (item.approvalRequestId)
      throw new Error(
        "This release exception already has an approval request.",
      );
    const project = await this.projects.getById(item.projectId);
    const approver = project.sponsor ?? project.pmoOwner;
    const [eligible, hasRole] = await Promise.all([
      this.employees.getActiveBySharePointUserId(approver.id),
      this.capabilities.isUserInSecurityRole(approver.id, "approver"),
    ]);
    if (!eligible?.isApprover || !hasRole)
      throw new Error("The configured exception approver is not eligible.");
    const approval = await this.workflow().create({
      title: `QA exception: ${item.title}`,
      approvalType: "QA Exception",
      sourceList: PMO_LISTS.qualityItems,
      sourceItemId: item.id,
      projectId: item.projectId,
      projectCode: item.projectCode,
      requestedBy: {
        id: actor.sharePointUserId,
        displayName: actor.displayName,
        email: actor.email,
      },
      approver: {
        ...approver,
        isApproverEligible: true,
        hasApproverRole: true,
        isOwner: false,
      },
      segregationOfDuties: true,
    });
    return this.quality.update(
      item.id,
      {
        [F.qualityItems.ApprovalRequestId]: approval.id,
        [F.qualityItems.Status]: "In Review",
      },
      item.etag,
    );
  }

  private async assertManage() {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "quality.manage");
    return actor;
  }

  private workflow(): ApprovalWorkflowService {
    return new ApprovalWorkflowService(
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
  }
}
