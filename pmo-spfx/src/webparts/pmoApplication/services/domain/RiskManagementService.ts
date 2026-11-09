import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type { IPmoPerson, IPmoRiskIssue } from "../../models/domain";
import type { IRepositoryPage } from "../repositories/contracts";
import type {
  IRiskIssueListFilters,
  ProjectsRepository,
  RisksIssuesRepository,
} from "../repositories/repositories";
import { generateRecordCode } from "./DomainRules";
import {
  assertCapability,
  type UserCapabilityService,
} from "./UserCapabilityService";

const personIdField = (field: string): string => `${field}Id`;

export interface IRiskIssueDraft {
  readonly title: string;
  readonly recordType: IPmoRiskIssue["recordType"];
  readonly projectId?: number;
  readonly workItemId?: number;
  readonly severity: IPmoRiskIssue["severity"];
  readonly probability?: IPmoRiskIssue["probability"];
  readonly description: string;
  readonly impact: string;
  readonly owner?: IPmoPerson;
  readonly targetResolutionDate?: string;
  readonly responsePlan?: string;
}

export const validateRiskIssue = (
  draft: IRiskIssueDraft,
): Readonly<Record<string, string>> => {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = "A summary is required.";
  if (!draft.projectId) errors.projectId = "A project is required.";
  if (!draft.description.trim())
    errors.description = "A description is required.";
  if (!draft.impact.trim()) errors.impact = "Impact is required.";
  if (!draft.owner) errors.owner = "An accountable owner is required.";
  if (draft.recordType === "Risk" && !draft.probability)
    errors.probability = "Probability is required for a risk.";
  if (draft.recordType === "Blocker" && !draft.workItemId)
    errors.workItemId = "A blocker must reference a work item.";
  return errors;
};

const transitions: Readonly<
  Record<IPmoRiskIssue["status"], readonly IPmoRiskIssue["status"][]>
> = {
  Open: ["Monitoring", "Mitigating", "Resolved", "Accepted"],
  Monitoring: ["Mitigating", "Resolved", "Accepted"],
  Mitigating: ["Monitoring", "Resolved", "Accepted"],
  Resolved: ["Closed", "Open"],
  Accepted: ["Closed", "Open"],
  Closed: [],
};

export class RiskManagementService {
  public constructor(
    private readonly risks: RisksIssuesRepository,
    private readonly projects: ProjectsRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(
    filters: IRiskIssueListFilters,
    continuation?: string,
  ): Promise<IRepositoryPage<IPmoRiskIssue>> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.view");
    return this.risks.getPage(filters, continuation);
  }

  public async get(id: number): Promise<IPmoRiskIssue> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.view");
    return this.risks.getById(id);
  }

  public async save(
    draft: IRiskIssueDraft,
    existing?: IPmoRiskIssue,
  ): Promise<IPmoRiskIssue> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
    const validation = validateRiskIssue(draft);
    const firstKey = Object.keys(validation)[0];
    const first = firstKey ? validation[firstKey] : undefined;
    if (first) throw new Error(first);
    if (existing && existing.status === "Closed")
      throw new Error("Closed risks and issues are read-only.");
    const project = await this.projects.getById(draft.projectId as number);
    const values = {
      [F.risksIssues.Title]: draft.title.trim(),
      [F.risksIssues.RecordType]: draft.recordType,
      [F.risksIssues.ProjectId]: project.id,
      [F.risksIssues.ProjectCode]: project.projectCode ?? "",
      [F.risksIssues.WorkItemId]: draft.workItemId ?? null,
      [F.risksIssues.Severity]: draft.severity,
      [F.risksIssues.Probability]:
        draft.recordType === "Risk" ? draft.probability : null,
      [F.risksIssues.Description]: draft.description.trim(),
      [F.risksIssues.Impact]: draft.impact.trim(),
      [personIdField(F.risksIssues.Owner)]: draft.owner?.id,
      [F.risksIssues.TargetResolutionDate]: draft.targetResolutionDate
        ? new Date(`${draft.targetResolutionDate}T00:00:00`).toISOString()
        : null,
      [F.risksIssues.ResponsePlan]: draft.responsePlan?.trim() || null,
    };
    if (existing) return this.risks.update(existing.id, values, existing.etag);
    const raisedOn = this.now();
    const created = await this.risks.create({
      ...values,
      [F.risksIssues.RecordNumber]: `PENDING-${raisedOn.valueOf()}`,
      [personIdField(F.risksIssues.RaisedBy)]: actor.sharePointUserId,
      [F.risksIssues.RaisedOn]: raisedOn.toISOString(),
      [F.risksIssues.Status]: "Open",
      [F.risksIssues.IsEscalated]: false,
    });
    return this.risks.update(
      created.id,
      {
        [F.risksIssues.RecordNumber]: generateRecordCode(
          "Risk",
          created.id,
          created.created ?? raisedOn,
        ),
      },
      created.etag,
    );
  }

  public async escalate(
    item: IPmoRiskIssue,
    reason: string,
  ): Promise<IPmoRiskIssue> {
    await this.assertManage();
    if (["Resolved", "Accepted", "Closed"].indexOf(item.status) >= 0)
      throw new Error("Only an open risk, issue, or blocker can be escalated.");
    if (!reason.trim()) throw new Error("Escalation requires a reason.");
    return this.risks.update(
      item.id,
      {
        [F.risksIssues.IsEscalated]: true,
        [F.risksIssues.Impact]: `${item.impact}\nEscalation: ${reason.trim()}`,
      },
      item.etag,
    );
  }

  public async transition(
    item: IPmoRiskIssue,
    target: IPmoRiskIssue["status"],
    reason?: string,
  ): Promise<IPmoRiskIssue> {
    await this.assertManage();
    if (transitions[item.status].indexOf(target) < 0)
      throw new Error(`Cannot move ${item.status} to ${target}.`);
    if (
      ["Resolved", "Accepted", "Closed"].indexOf(target) >= 0 &&
      !reason?.trim()
    )
      throw new Error(`${target} requires resolution or acceptance evidence.`);
    const terminal = ["Resolved", "Accepted", "Closed"].indexOf(target) >= 0;
    return this.risks.update(
      item.id,
      {
        [F.risksIssues.Status]: target,
        ...(terminal
          ? {
              [F.risksIssues.Resolution]: reason?.trim(),
              [F.risksIssues.ResolvedOn]: this.now().toISOString(),
            }
          : target === "Open"
            ? {
                [F.risksIssues.Resolution]: null,
                [F.risksIssues.ResolvedOn]: null,
              }
            : {}),
      },
      item.etag,
    );
  }

  private async assertManage(): Promise<void> {
    const actor = await this.capabilities.resolveCurrent();
    assertCapability(actor, "projects.manage");
  }
}
