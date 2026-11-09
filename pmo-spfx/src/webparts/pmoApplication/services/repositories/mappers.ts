import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type {
  IPmoApprovalRequest,
  IPmoChangeRequest,
  IPmoConfig,
  IPmoEmployee,
  IPmoEmployeeRate,
  IPmoEntity,
  IPmoHyperlink,
  IPmoImportBatch,
  IPmoLearningAssignment,
  IPmoPerson,
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
import type {
  ISharePointHyperlinkWire,
  ISharePointItemWire,
  ISharePointUserWire,
} from "../../models/sharePoint";
import { getWireEtag } from "../../models/sharePoint";

export type SharePointMapper<T extends IPmoEntity> = (
  wire: ISharePointItemWire,
) => T;

const value = (wire: ISharePointItemWire, field: string): unknown =>
  wire[field];
const stringValue = (
  wire: ISharePointItemWire,
  field: string,
  fallback = "",
): string => {
  const candidate = value(wire, field);
  return typeof candidate === "string" ? candidate : fallback;
};
const optionalString = (
  wire: ISharePointItemWire,
  field: string,
): string | undefined => {
  const candidate = stringValue(wire, field);
  return candidate || undefined;
};
const numberValue = (
  wire: ISharePointItemWire,
  field: string,
  fallback = 0,
): number => {
  const candidate = value(wire, field);
  return typeof candidate === "number" ? candidate : fallback;
};
const optionalNumber = (
  wire: ISharePointItemWire,
  field: string,
): number | undefined => {
  const candidate = value(wire, field);
  return typeof candidate === "number" ? candidate : undefined;
};
const booleanValue = (wire: ISharePointItemWire, field: string): boolean =>
  value(wire, field) === true;
const optionalDate = (
  wire: ISharePointItemWire,
  field: string,
): Date | undefined => {
  const candidate = value(wire, field);
  if (typeof candidate !== "string" || !candidate) return undefined;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
};
const requiredDate = (wire: ISharePointItemWire, field: string): Date =>
  optionalDate(wire, field) ?? new Date(0);

const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
  typeof candidate === "object" && candidate !== null;

const person = (
  wire: ISharePointItemWire,
  field: string,
): IPmoPerson | undefined => {
  const candidate = value(wire, field);
  if (!isRecord(candidate)) return undefined;
  const user = candidate as unknown as ISharePointUserWire;
  if (typeof user.Id !== "number" || typeof user.Title !== "string") {
    return undefined;
  }
  return {
    id: user.Id,
    displayName: user.Title,
    email: user.EMail,
    loginName: user.Name,
  };
};
const requiredPerson = (wire: ISharePointItemWire, field: string): IPmoPerson =>
  person(wire, field) ?? { id: 0, displayName: "Unknown user" };
const hyperlink = (
  wire: ISharePointItemWire,
  field: string,
): IPmoHyperlink | undefined => {
  const candidate = value(wire, field);
  if (typeof candidate === "string" && candidate) return { url: candidate };
  if (!isRecord(candidate)) return undefined;
  const link = candidate as unknown as ISharePointHyperlinkWire;
  return typeof link.Url === "string"
    ? { url: link.Url, description: link.Description }
    : undefined;
};
const base = (wire: ISharePointItemWire): IPmoEntity => ({
  id: wire.ID,
  etag: getWireEtag(wire),
  created: optionalDate(wire, "Created"),
  modified: optionalDate(wire, "Modified"),
});
const dependencies = (wire: ISharePointItemWire, field: string): number[] =>
  stringValue(wire, field)
    .split(";")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

export const mapConfig: SharePointMapper<IPmoConfig> = (wire) => ({
  ...base(wire),
  key: stringValue(wire, F.config.Title),
  category: stringValue(wire, F.config.Category) as IPmoConfig["category"],
  value: stringValue(wire, F.config.ConfigValue),
  description: stringValue(wire, F.config.Description),
  isActive: booleanValue(wire, F.config.IsActive),
  sortOrder: optionalNumber(wire, F.config.SortOrder),
});

export const mapEmployee: SharePointMapper<IPmoEmployee> = (wire) => ({
  ...base(wire),
  name: stringValue(wire, F.employees.Title),
  employeeNumber: stringValue(wire, F.employees.EmployeeNumber),
  user: requiredPerson(wire, F.employees.EmployeeUser),
  email: stringValue(wire, F.employees.Email).toLowerCase(),
  department: stringValue(wire, F.employees.Department),
  jobTitle: optionalString(wire, F.employees.JobTitle),
  manager: person(wire, F.employees.Manager),
  location: optionalString(wire, F.employees.Location),
  employmentStatus: stringValue(
    wire,
    F.employees.EmploymentStatus,
  ) as IPmoEmployee["employmentStatus"],
  employmentStartDate: optionalDate(wire, F.employees.EmploymentStartDate),
  employmentEndDate: optionalDate(wire, F.employees.EmploymentEndDate),
  standardHoursPerDay: numberValue(wire, F.employees.StandardHoursPerDay),
  capacityPercent: numberValue(wire, F.employees.CapacityPercent),
  skillsSummary: optionalString(wire, F.employees.SkillsSummary),
  isProjectManager: booleanValue(wire, F.employees.IsProjectManager),
  isQa: booleanValue(wire, F.employees.IsQA),
  isApprover: booleanValue(wire, F.employees.IsApprover),
  isResourceManager: booleanValue(wire, F.employees.IsResourceManager),
  isActive: booleanValue(wire, F.employees.IsActive),
});

export const mapEmployeeRate: SharePointMapper<IPmoEmployeeRate> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.employeeRates.Title),
  employeeId: numberValue(wire, F.employeeRates.EmployeeId),
  employeeNumber: stringValue(wire, F.employeeRates.EmployeeNumber),
  employeeName: stringValue(wire, F.employeeRates.EmployeeName),
  rateType: stringValue(
    wire,
    F.employeeRates.RateType,
  ) as IPmoEmployeeRate["rateType"],
  costRate: numberValue(wire, F.employeeRates.CostRate),
  currencyCode: stringValue(wire, F.employeeRates.CurrencyCode),
  effectiveFrom: requiredDate(wire, F.employeeRates.EffectiveFrom),
  effectiveTo: optionalDate(wire, F.employeeRates.EffectiveTo),
  isCurrent: booleanValue(wire, F.employeeRates.IsCurrent),
  approvalReference: optionalString(wire, F.employeeRates.ApprovalReference),
  notes: optionalString(wire, F.employeeRates.Notes),
});

export const mapProject: SharePointMapper<IPmoProject> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.projects.Title),
  projectCode: optionalString(wire, F.projects.ProjectCode),
  projectType: stringValue(
    wire,
    F.projects.ProjectType,
  ) as IPmoProject["projectType"],
  customerName: optionalString(wire, F.projects.CustomerName),
  poReference: optionalString(wire, F.projects.POReference),
  description: stringValue(wire, F.projects.Description),
  scopeSummary: stringValue(wire, F.projects.ScopeSummary),
  exclusions: optionalString(wire, F.projects.Exclusions),
  projectManager: requiredPerson(wire, F.projects.ProjectManager),
  sponsor: person(wire, F.projects.Sponsor),
  pmoOwner: requiredPerson(wire, F.projects.PMOOwner),
  status: stringValue(wire, F.projects.Status) as IPmoProject["status"],
  priority: stringValue(wire, F.projects.Priority) as IPmoProject["priority"],
  plannedStart: requiredDate(wire, F.projects.PlannedStart),
  baselineEnd: requiredDate(wire, F.projects.BaselineEnd),
  currentApprovedEnd: requiredDate(wire, F.projects.CurrentApprovedEnd),
  forecastEnd: optionalDate(wire, F.projects.ForecastEnd),
  baselineEffortHours: numberValue(wire, F.projects.BaselineEffortHours),
  approvedEffortHours: numberValue(wire, F.projects.ApprovedEffortHours),
  forecastEffortHours: optionalNumber(wire, F.projects.ForecastEffortHours),
  actualEffortHours: numberValue(wire, F.projects.ActualEffortHours),
  currencyCode: stringValue(wire, F.projects.CurrencyCode),
  percentComplete: numberValue(wire, F.projects.PercentComplete),
  overallHealth: stringValue(
    wire,
    F.projects.OverallHealth,
  ) as IPmoProject["overallHealth"],
  baselineVersion: numberValue(wire, F.projects.BaselineVersion),
  currentPlanVersion: numberValue(wire, F.projects.CurrentPlanVersion),
  baselineApprovedBy: person(wire, F.projects.BaselineApprovedBy),
  baselineApprovedOn: optionalDate(wire, F.projects.BaselineApprovedOn),
  metricsCalculatedOn: optionalDate(wire, F.projects.MetricsCalculatedOn),
  confidentiality: stringValue(
    wire,
    F.projects.Confidentiality,
  ) as IPmoProject["confidentiality"],
  isActive: booleanValue(wire, F.projects.IsActive),
});

export const mapProjectFinancials: SharePointMapper<IPmoProjectFinancials> = (
  wire,
) => ({
  ...base(wire),
  title: stringValue(wire, F.projectFinancials.Title),
  projectId: numberValue(wire, F.projectFinancials.ProjectId),
  projectCode: stringValue(wire, F.projectFinancials.ProjectCode),
  projectValue: optionalNumber(wire, F.projectFinancials.ProjectValue),
  currencyCode: stringValue(wire, F.projectFinancials.CurrencyCode),
  baselineCostBudget: optionalNumber(
    wire,
    F.projectFinancials.BaselineCostBudget,
  ),
  approvedCostBudget: optionalNumber(
    wire,
    F.projectFinancials.ApprovedCostBudget,
  ),
  actualCost: numberValue(wire, F.projectFinancials.ActualCost),
  forecastCost: numberValue(wire, F.projectFinancials.ForecastCost),
  forecastMarginAmount: optionalNumber(
    wire,
    F.projectFinancials.ForecastMarginAmount,
  ),
  forecastMarginPercent: optionalNumber(
    wire,
    F.projectFinancials.ForecastMarginPercent,
  ),
  calculationStatus: stringValue(
    wire,
    F.projectFinancials.CalculationStatus,
  ) as IPmoProjectFinancials["calculationStatus"],
  calculatedOn: optionalDate(wire, F.projectFinancials.CalculatedOn),
  approvedBy: person(wire, F.projectFinancials.ApprovedBy),
  approvedOn: optionalDate(wire, F.projectFinancials.ApprovedOn),
});

export const mapProjectMember: SharePointMapper<IPmoProjectMember> = (
  wire,
) => ({
  ...base(wire),
  title: stringValue(wire, F.projectMembers.Title),
  projectId: numberValue(wire, F.projectMembers.ProjectId),
  projectCode: stringValue(wire, F.projectMembers.ProjectCode),
  employeeId: numberValue(wire, F.projectMembers.EmployeeId),
  employeeUser: requiredPerson(wire, F.projectMembers.EmployeeUser),
  projectRole: stringValue(
    wire,
    F.projectMembers.ProjectRole,
  ) as IPmoProjectMember["projectRole"],
  responsibility: optionalString(wire, F.projectMembers.Responsibility),
  allocationPercent: numberValue(wire, F.projectMembers.AllocationPercent),
  allocationStart: requiredDate(wire, F.projectMembers.AllocationStart),
  allocationEnd: requiredDate(wire, F.projectMembers.AllocationEnd),
  membershipStatus: stringValue(
    wire,
    F.projectMembers.MembershipStatus,
  ) as IPmoProjectMember["membershipStatus"],
  acknowledgedOn: optionalDate(wire, F.projectMembers.AcknowledgedOn),
  isActive: booleanValue(wire, F.projectMembers.IsActive),
});

export const mapWorkItem: SharePointMapper<IPmoWorkItem> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.workItems.Title),
  workItemCode: optionalString(wire, F.workItems.WorkItemCode),
  projectId: numberValue(wire, F.workItems.ProjectId),
  projectCode: stringValue(wire, F.workItems.ProjectCode),
  itemType: stringValue(wire, F.workItems.ItemType) as IPmoWorkItem["itemType"],
  parentWorkItemId: optionalNumber(wire, F.workItems.ParentWorkItemId),
  phaseWorkItemId: optionalNumber(wire, F.workItems.PhaseWorkItemId),
  description: optionalString(wire, F.workItems.Description),
  assignedEmployeeId: optionalNumber(wire, F.workItems.AssignedEmployeeId),
  assignedTo: person(wire, F.workItems.AssignedTo),
  reviewer: person(wire, F.workItems.Reviewer),
  qaRequired: booleanValue(wire, F.workItems.QARequired),
  qaOwner: person(wire, F.workItems.QAOwner),
  status: stringValue(wire, F.workItems.Status) as IPmoWorkItem["status"],
  priority: stringValue(wire, F.workItems.Priority) as IPmoWorkItem["priority"],
  plannedStart: optionalDate(wire, F.workItems.PlannedStart),
  plannedEnd: optionalDate(wire, F.workItems.PlannedEnd),
  baselineEffortHours: optionalNumber(wire, F.workItems.BaselineEffortHours),
  approvedEffortHours: optionalNumber(wire, F.workItems.ApprovedEffortHours),
  forecastEffortHours: optionalNumber(wire, F.workItems.ForecastEffortHours),
  actualEffortHours: numberValue(wire, F.workItems.ActualEffortHours),
  percentComplete: numberValue(wire, F.workItems.PercentComplete),
  acceptanceCriteria: optionalString(wire, F.workItems.AcceptanceCriteria),
  dependencyIds: dependencies(wire, F.workItems.DependencyIds),
  isCritical: booleanValue(wire, F.workItems.IsCritical),
  actualStart: optionalDate(wire, F.workItems.ActualStart),
  submittedOn: optionalDate(wire, F.workItems.SubmittedOn),
  acceptedOn: optionalDate(wire, F.workItems.AcceptedOn),
  completedOn: optionalDate(wire, F.workItems.CompletedOn),
  planVersion: numberValue(wire, F.workItems.PlanVersion),
  importRowKey: optionalString(wire, F.workItems.ImportRowKey),
  lastActionId: optionalNumber(wire, F.workItems.LastActionId),
  isActive: booleanValue(wire, F.workItems.IsActive),
});

export const mapTaskAction: SharePointMapper<IPmoTaskAction> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.taskActions.Title),
  projectId: numberValue(wire, F.taskActions.ProjectId),
  projectCode: stringValue(wire, F.taskActions.ProjectCode),
  workItemId: numberValue(wire, F.taskActions.WorkItemId),
  workItemCode: stringValue(wire, F.taskActions.WorkItemCode),
  actionType: stringValue(
    wire,
    F.taskActions.ActionType,
  ) as IPmoTaskAction["actionType"],
  requestedBy: requiredPerson(wire, F.taskActions.RequestedBy),
  requestedOn: requiredDate(wire, F.taskActions.RequestedOn),
  progressPercent: optionalNumber(wire, F.taskActions.ProgressPercent),
  remainingEffortHours: optionalNumber(
    wire,
    F.taskActions.RemainingEffortHours,
  ),
  comment: optionalString(wire, F.taskActions.Comment),
  proposedStatus: optionalString(wire, F.taskActions.ProposedStatus),
  processingStatus: stringValue(
    wire,
    F.taskActions.ProcessingStatus,
  ) as IPmoTaskAction["processingStatus"],
  processedOn: optionalDate(wire, F.taskActions.ProcessedOn),
  resultMessage: optionalString(wire, F.taskActions.ResultMessage),
  teamsResponseId: optionalString(wire, F.taskActions.TeamsResponseId),
});

export const mapTimeEntry: SharePointMapper<IPmoTimeEntry> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.timeEntries.Title),
  employeeId: numberValue(wire, F.timeEntries.EmployeeId),
  employeeUser: requiredPerson(wire, F.timeEntries.EmployeeUser),
  workDate: requiredDate(wire, F.timeEntries.WorkDate),
  projectId: optionalNumber(wire, F.timeEntries.ProjectId),
  projectCode: optionalString(wire, F.timeEntries.ProjectCode),
  workItemId: optionalNumber(wire, F.timeEntries.WorkItemId),
  workCategory: stringValue(
    wire,
    F.timeEntries.WorkCategory,
  ) as IPmoTimeEntry["workCategory"],
  hours: numberValue(wire, F.timeEntries.Hours),
  workPerformed: stringValue(wire, F.timeEntries.WorkPerformed),
  progressPercent: optionalNumber(wire, F.timeEntries.ProgressPercent),
  blockerSummary: optionalString(wire, F.timeEntries.BlockerSummary),
  entryStatus: stringValue(
    wire,
    F.timeEntries.EntryStatus,
  ) as IPmoTimeEntry["entryStatus"],
  submittedOn: optionalDate(wire, F.timeEntries.SubmittedOn),
  approvedBy: person(wire, F.timeEntries.ApprovedBy),
  approvedOn: optionalDate(wire, F.timeEntries.ApprovedOn),
  correctionReason: optionalString(wire, F.timeEntries.CorrectionReason),
  isBillable: booleanValue(wire, F.timeEntries.IsBillable),
  isLocked: booleanValue(wire, F.timeEntries.IsLocked),
});

export const mapChangeRequest: SharePointMapper<IPmoChangeRequest> = (
  wire,
) => ({
  ...base(wire),
  title: stringValue(wire, F.changeRequests.Title),
  requestNumber: stringValue(wire, F.changeRequests.RequestNumber),
  requestType: stringValue(
    wire,
    F.changeRequests.RequestType,
  ) as IPmoChangeRequest["requestType"],
  projectId: numberValue(wire, F.changeRequests.ProjectId),
  projectCode: stringValue(wire, F.changeRequests.ProjectCode),
  workItemId: optionalNumber(wire, F.changeRequests.WorkItemId),
  requestedBy: requiredPerson(wire, F.changeRequests.RequestedBy),
  requestedOn: requiredDate(wire, F.changeRequests.RequestedOn),
  reasonCategory: stringValue(
    wire,
    F.changeRequests.ReasonCategory,
  ) as IPmoChangeRequest["reasonCategory"],
  reasonDetails: stringValue(wire, F.changeRequests.ReasonDetails),
  originalEffortHours: optionalNumber(
    wire,
    F.changeRequests.OriginalEffortHours,
  ),
  currentEffortHours: optionalNumber(wire, F.changeRequests.CurrentEffortHours),
  additionalHoursRequested: optionalNumber(
    wire,
    F.changeRequests.AdditionalHoursRequested,
  ),
  proposedEffortHours: optionalNumber(
    wire,
    F.changeRequests.ProposedEffortHours,
  ),
  originalDate: optionalDate(wire, F.changeRequests.OriginalDate),
  proposedDate: optionalDate(wire, F.changeRequests.ProposedDate),
  impactSummary: stringValue(wire, F.changeRequests.ImpactSummary),
  mitigationPlan: optionalString(wire, F.changeRequests.MitigationPlan),
  requestStatus: stringValue(
    wire,
    F.changeRequests.RequestStatus,
  ) as IPmoChangeRequest["requestStatus"],
  currentApprover: person(wire, F.changeRequests.CurrentApprover),
  approvalRequestId: optionalNumber(wire, F.changeRequests.ApprovalRequestId),
  decisionComment: optionalString(wire, F.changeRequests.DecisionComment),
  decidedBy: person(wire, F.changeRequests.DecidedBy),
  decidedOn: optionalDate(wire, F.changeRequests.DecidedOn),
});

export const mapApprovalRequest: SharePointMapper<IPmoApprovalRequest> = (
  wire,
) => ({
  ...base(wire),
  title: stringValue(wire, F.approvalRequests.Title),
  approvalNumber: stringValue(wire, F.approvalRequests.ApprovalNumber),
  approvalType: stringValue(
    wire,
    F.approvalRequests.ApprovalType,
  ) as IPmoApprovalRequest["approvalType"],
  sourceList: stringValue(
    wire,
    F.approvalRequests.SourceList,
  ) as IPmoApprovalRequest["sourceList"],
  sourceItemId: numberValue(wire, F.approvalRequests.SourceItemId),
  projectId: numberValue(wire, F.approvalRequests.ProjectId),
  projectCode: stringValue(wire, F.approvalRequests.ProjectCode),
  requestedBy: requiredPerson(wire, F.approvalRequests.RequestedBy),
  requestedOn: requiredDate(wire, F.approvalRequests.RequestedOn),
  approver: requiredPerson(wire, F.approvalRequests.Approver),
  approvalStatus: stringValue(
    wire,
    F.approvalRequests.ApprovalStatus,
  ) as IPmoApprovalRequest["approvalStatus"],
  decision: optionalString(
    wire,
    F.approvalRequests.Decision,
  ) as IPmoApprovalRequest["decision"],
  decisionComment: optionalString(wire, F.approvalRequests.DecisionComment),
  decidedBy: person(wire, F.approvalRequests.DecidedBy),
  decidedOn: optionalDate(wire, F.approvalRequests.DecidedOn),
  dueOn: optionalDate(wire, F.approvalRequests.DueOn),
  escalationLevel: numberValue(wire, F.approvalRequests.EscalationLevel),
  flowApprovalId: optionalString(wire, F.approvalRequests.FlowApprovalId),
  flowProcessingStatus: stringValue(
    wire,
    F.approvalRequests.FlowProcessingStatus,
  ) as IPmoApprovalRequest["flowProcessingStatus"],
});

export const mapRiskIssue: SharePointMapper<IPmoRiskIssue> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.risksIssues.Title),
  recordNumber: stringValue(wire, F.risksIssues.RecordNumber),
  recordType: stringValue(
    wire,
    F.risksIssues.RecordType,
  ) as IPmoRiskIssue["recordType"],
  projectId: numberValue(wire, F.risksIssues.ProjectId),
  projectCode: stringValue(wire, F.risksIssues.ProjectCode),
  workItemId: optionalNumber(wire, F.risksIssues.WorkItemId),
  severity: stringValue(
    wire,
    F.risksIssues.Severity,
  ) as IPmoRiskIssue["severity"],
  probability: optionalString(
    wire,
    F.risksIssues.Probability,
  ) as IPmoRiskIssue["probability"],
  description: stringValue(wire, F.risksIssues.Description),
  impact: stringValue(wire, F.risksIssues.Impact),
  owner: requiredPerson(wire, F.risksIssues.Owner),
  raisedBy: requiredPerson(wire, F.risksIssues.RaisedBy),
  raisedOn: requiredDate(wire, F.risksIssues.RaisedOn),
  targetResolutionDate: optionalDate(wire, F.risksIssues.TargetResolutionDate),
  status: stringValue(wire, F.risksIssues.Status) as IPmoRiskIssue["status"],
  responsePlan: optionalString(wire, F.risksIssues.ResponsePlan),
  resolution: optionalString(wire, F.risksIssues.Resolution),
  resolvedOn: optionalDate(wire, F.risksIssues.ResolvedOn),
  isEscalated: booleanValue(wire, F.risksIssues.IsEscalated),
});

export const mapQualityItem: SharePointMapper<IPmoQualityItem> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.qualityItems.Title),
  qualityNumber: stringValue(wire, F.qualityItems.QualityNumber),
  qualityType: stringValue(
    wire,
    F.qualityItems.QualityType,
  ) as IPmoQualityItem["qualityType"],
  projectId: numberValue(wire, F.qualityItems.ProjectId),
  projectCode: stringValue(wire, F.qualityItems.ProjectCode),
  workItemId: optionalNumber(wire, F.qualityItems.WorkItemId),
  releaseName: optionalString(wire, F.qualityItems.ReleaseName),
  status: stringValue(wire, F.qualityItems.Status) as IPmoQualityItem["status"],
  testResult: optionalString(
    wire,
    F.qualityItems.TestResult,
  ) as IPmoQualityItem["testResult"],
  severity: optionalString(
    wire,
    F.qualityItems.Severity,
  ) as IPmoQualityItem["severity"],
  priority: optionalString(
    wire,
    F.qualityItems.Priority,
  ) as IPmoQualityItem["priority"],
  description: stringValue(wire, F.qualityItems.Description),
  evidenceLink: hyperlink(wire, F.qualityItems.EvidenceLink),
  assignedTo: person(wire, F.qualityItems.AssignedTo),
  raisedBy: requiredPerson(wire, F.qualityItems.RaisedBy),
  raisedOn: requiredDate(wire, F.qualityItems.RaisedOn),
  targetFixDate: optionalDate(wire, F.qualityItems.TargetFixDate),
  fixEffortHours: optionalNumber(wire, F.qualityItems.FixEffortHours),
  rootCauseCategory: optionalString(
    wire,
    F.qualityItems.RootCauseCategory,
  ) as IPmoQualityItem["rootCauseCategory"],
  rootCauseDetails: optionalString(wire, F.qualityItems.RootCauseDetails),
  retestResult: optionalString(
    wire,
    F.qualityItems.RetestResult,
  ) as IPmoQualityItem["retestResult"],
  retestedBy: person(wire, F.qualityItems.RetestedBy),
  retestedOn: optionalDate(wire, F.qualityItems.RetestedOn),
  customerImpact: optionalString(wire, F.qualityItems.CustomerImpact),
  approvalRequestId: optionalNumber(wire, F.qualityItems.ApprovalRequestId),
  isReleaseBlocking: booleanValue(wire, F.qualityItems.IsReleaseBlocking),
});

export const mapLearningAssignment: SharePointMapper<IPmoLearningAssignment> = (
  wire,
) => ({
  ...base(wire),
  title: stringValue(wire, F.learningAssignments.Title),
  learningNumber: stringValue(wire, F.learningAssignments.LearningNumber),
  employeeId: numberValue(wire, F.learningAssignments.EmployeeId),
  employeeUser: requiredPerson(wire, F.learningAssignments.EmployeeUser),
  skillName: stringValue(wire, F.learningAssignments.SkillName),
  objective: stringValue(wire, F.learningAssignments.Objective),
  startDate: requiredDate(wire, F.learningAssignments.StartDate),
  endDate: requiredDate(wire, F.learningAssignments.EndDate),
  plannedHours: numberValue(wire, F.learningAssignments.PlannedHours),
  actualHours: numberValue(wire, F.learningAssignments.ActualHours),
  mentor: person(wire, F.learningAssignments.Mentor),
  deliverable: stringValue(wire, F.learningAssignments.Deliverable),
  evidenceLink: hyperlink(wire, F.learningAssignments.EvidenceLink),
  status: stringValue(
    wire,
    F.learningAssignments.Status,
  ) as IPmoLearningAssignment["status"],
  validationResult: optionalString(
    wire,
    F.learningAssignments.ValidationResult,
  ) as IPmoLearningAssignment["validationResult"],
  validatedBy: person(wire, F.learningAssignments.ValidatedBy),
  validatedOn: optionalDate(wire, F.learningAssignments.ValidatedOn),
  validationComment: optionalString(
    wire,
    F.learningAssignments.ValidationComment,
  ),
});

export const mapProjectCost: SharePointMapper<IPmoProjectCost> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.projectCosts.Title),
  costNumber: stringValue(wire, F.projectCosts.CostNumber),
  projectId: numberValue(wire, F.projectCosts.ProjectId),
  projectCode: stringValue(wire, F.projectCosts.ProjectCode),
  costType: stringValue(
    wire,
    F.projectCosts.CostType,
  ) as IPmoProjectCost["costType"],
  sourceTimeEntryId: optionalNumber(wire, F.projectCosts.SourceTimeEntryId),
  costDate: requiredDate(wire, F.projectCosts.CostDate),
  employeeId: optionalNumber(wire, F.projectCosts.EmployeeId),
  amount: numberValue(wire, F.projectCosts.Amount),
  currencyCode: stringValue(wire, F.projectCosts.CurrencyCode),
  description: stringValue(wire, F.projectCosts.Description),
  costStatus: stringValue(
    wire,
    F.projectCosts.CostStatus,
  ) as IPmoProjectCost["costStatus"],
  approvedBy: person(wire, F.projectCosts.ApprovedBy),
  approvedOn: optionalDate(wire, F.projectCosts.ApprovedOn),
  reversalOfCostId: optionalNumber(wire, F.projectCosts.ReversalOfCostId),
});

export const mapProjectStatusReport: SharePointMapper<
  IPmoProjectStatusReport
> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.projectStatusReports.Title),
  projectId: numberValue(wire, F.projectStatusReports.ProjectId),
  projectCode: stringValue(wire, F.projectStatusReports.ProjectCode),
  reportingDate: requiredDate(wire, F.projectStatusReports.ReportingDate),
  periodStart: requiredDate(wire, F.projectStatusReports.PeriodStart),
  periodEnd: requiredDate(wire, F.projectStatusReports.PeriodEnd),
  overallStatus: stringValue(
    wire,
    F.projectStatusReports.OverallStatus,
  ) as IPmoProjectStatusReport["overallStatus"],
  percentComplete: numberValue(wire, F.projectStatusReports.PercentComplete),
  forecastEnd: optionalDate(wire, F.projectStatusReports.ForecastEnd),
  forecastEffortHours: optionalNumber(
    wire,
    F.projectStatusReports.ForecastEffortHours,
  ),
  highlights: stringValue(wire, F.projectStatusReports.Highlights),
  risksIssuesSummary: stringValue(
    wire,
    F.projectStatusReports.RisksIssuesSummary,
  ),
  decisionsRequired: optionalString(
    wire,
    F.projectStatusReports.DecisionsRequired,
  ),
  nextSteps: stringValue(wire, F.projectStatusReports.NextSteps),
  reportStatus: stringValue(
    wire,
    F.projectStatusReports.ReportStatus,
  ) as IPmoProjectStatusReport["reportStatus"],
  submittedBy: person(wire, F.projectStatusReports.SubmittedBy),
  submittedOn: optionalDate(wire, F.projectStatusReports.SubmittedOn),
  approvedBy: person(wire, F.projectStatusReports.ApprovedBy),
  approvedOn: optionalDate(wire, F.projectStatusReports.ApprovedOn),
});

export const mapImportBatch: SharePointMapper<IPmoImportBatch> = (wire) => ({
  ...base(wire),
  title: stringValue(wire, F.importBatches.Title),
  batchNumber: stringValue(wire, F.importBatches.BatchNumber),
  projectId: numberValue(wire, F.importBatches.ProjectId),
  projectCode: stringValue(wire, F.importBatches.ProjectCode),
  fileLink: hyperlink(wire, F.importBatches.FileLink) ?? { url: "" },
  uploadedBy: requiredPerson(wire, F.importBatches.UploadedBy),
  uploadedOn: requiredDate(wire, F.importBatches.UploadedOn),
  templateVersion: stringValue(wire, F.importBatches.TemplateVersion),
  importStatus: stringValue(
    wire,
    F.importBatches.ImportStatus,
  ) as IPmoImportBatch["importStatus"],
  totalRows: numberValue(wire, F.importBatches.TotalRows),
  validRows: numberValue(wire, F.importBatches.ValidRows),
  errorRows: numberValue(wire, F.importBatches.ErrorRows),
  errorFileLink: hyperlink(wire, F.importBatches.ErrorFileLink),
  processedOn: optionalDate(wire, F.importBatches.ProcessedOn),
  resultSummary: optionalString(wire, F.importBatches.ResultSummary),
});

export const mapProjectDocument: SharePointMapper<IPmoProjectDocument> = (
  wire,
) => ({
  ...base(wire),
  fileName: stringValue(wire, F.projectDocuments.FileLeafRef),
  serverRelativeUrl: stringValue(wire, F.projectDocuments.FileRef),
  projectCode: stringValue(wire, F.projectDocuments.ProjectCode),
  documentType: stringValue(
    wire,
    F.projectDocuments.DocumentType,
  ) as IPmoProjectDocument["documentType"],
  workItemId: optionalNumber(wire, F.projectDocuments.WorkItemId),
  qualityItemId: optionalNumber(wire, F.projectDocuments.QualityItemId),
  approvalRequestId: optionalNumber(wire, F.projectDocuments.ApprovalRequestId),
  documentStatus: stringValue(
    wire,
    F.projectDocuments.DocumentStatus,
  ) as IPmoProjectDocument["documentStatus"],
  confidentiality: stringValue(
    wire,
    F.projectDocuments.Confidentiality,
  ) as IPmoProjectDocument["confidentiality"],
  templateVersion: optionalString(wire, F.projectDocuments.TemplateVersion),
  versionLabel: optionalString(wire, "OData__UIVersionString"),
});
