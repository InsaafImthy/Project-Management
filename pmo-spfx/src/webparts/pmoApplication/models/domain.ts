import type {
  ChoiceValue,
  PMO_CHOICES,
  PmoContainerName,
} from "../config/sharePointSchema";

export interface IPmoPerson {
  readonly id: number;
  readonly displayName: string;
  readonly email?: string;
  readonly loginName?: string;
}

export interface IPmoHyperlink {
  readonly url: string;
  readonly description?: string;
}

export interface IPmoEntity {
  readonly id: number;
  readonly etag: string;
  readonly created?: Date;
  readonly modified?: Date;
}

export interface IPmoConfig extends IPmoEntity {
  readonly key: string;
  readonly category: ChoiceValue<typeof PMO_CHOICES.config.category>;
  readonly value: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly sortOrder?: number;
}

export interface IPmoEmployee extends IPmoEntity {
  readonly name: string;
  readonly employeeNumber: string;
  readonly user: IPmoPerson;
  readonly email: string;
  readonly department: string;
  readonly jobTitle?: string;
  readonly manager?: IPmoPerson;
  readonly location?: string;
  readonly employmentStatus: ChoiceValue<
    typeof PMO_CHOICES.employees.employmentStatus
  >;
  readonly employmentStartDate?: Date;
  readonly employmentEndDate?: Date;
  readonly standardHoursPerDay: number;
  readonly capacityPercent: number;
  readonly skillsSummary?: string;
  readonly isProjectManager: boolean;
  readonly isQa: boolean;
  readonly isApprover: boolean;
  readonly isResourceManager: boolean;
  readonly isActive: boolean;
}

export interface IPmoEmployeeRate extends IPmoEntity {
  readonly title: string;
  readonly employeeId: number;
  readonly employeeNumber: string;
  readonly employeeName: string;
  readonly rateType: ChoiceValue<typeof PMO_CHOICES.employeeRates.rateType>;
  readonly costRate: number;
  readonly currencyCode: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date;
  readonly isCurrent: boolean;
  readonly approvalReference?: string;
  readonly notes?: string;
}

export interface IPmoProject extends IPmoEntity {
  readonly title: string;
  readonly projectCode?: string;
  readonly projectType: ChoiceValue<typeof PMO_CHOICES.projects.projectType>;
  readonly customerName?: string;
  readonly poReference?: string;
  readonly description: string;
  readonly scopeSummary: string;
  readonly exclusions?: string;
  readonly projectManager: IPmoPerson;
  readonly sponsor?: IPmoPerson;
  readonly pmoOwner: IPmoPerson;
  readonly status: ChoiceValue<typeof PMO_CHOICES.projects.status>;
  readonly priority: ChoiceValue<typeof PMO_CHOICES.projects.priority>;
  readonly plannedStart: Date;
  readonly baselineEnd: Date;
  readonly currentApprovedEnd: Date;
  readonly forecastEnd?: Date;
  readonly baselineEffortHours: number;
  readonly approvedEffortHours: number;
  readonly forecastEffortHours?: number;
  readonly actualEffortHours: number;
  readonly currencyCode: string;
  readonly percentComplete: number;
  readonly overallHealth: ChoiceValue<
    typeof PMO_CHOICES.projects.overallHealth
  >;
  readonly baselineVersion: number;
  readonly currentPlanVersion: number;
  readonly baselineApprovedBy?: IPmoPerson;
  readonly baselineApprovedOn?: Date;
  readonly metricsCalculatedOn?: Date;
  readonly confidentiality: ChoiceValue<
    typeof PMO_CHOICES.projects.confidentiality
  >;
  readonly isActive: boolean;
}

export interface IPmoProjectFinancials extends IPmoEntity {
  readonly title: string;
  readonly projectId: number;
  readonly projectCode: string;
  readonly projectValue?: number;
  readonly currencyCode: string;
  readonly baselineCostBudget?: number;
  readonly approvedCostBudget?: number;
  readonly actualCost: number;
  readonly forecastCost: number;
  readonly forecastMarginAmount?: number;
  readonly forecastMarginPercent?: number;
  readonly calculationStatus: ChoiceValue<
    typeof PMO_CHOICES.projectFinancials.calculationStatus
  >;
  readonly calculatedOn?: Date;
  readonly approvedBy?: IPmoPerson;
  readonly approvedOn?: Date;
}

export interface IPmoProjectMember extends IPmoEntity {
  readonly title: string;
  readonly projectId: number;
  readonly projectCode: string;
  readonly employeeId: number;
  readonly employeeUser: IPmoPerson;
  readonly projectRole: ChoiceValue<
    typeof PMO_CHOICES.projectMembers.projectRole
  >;
  readonly responsibility?: string;
  readonly allocationPercent: number;
  readonly allocationStart: Date;
  readonly allocationEnd: Date;
  readonly membershipStatus: ChoiceValue<
    typeof PMO_CHOICES.projectMembers.membershipStatus
  >;
  readonly acknowledgedOn?: Date;
  readonly isActive: boolean;
}

export interface IPmoWorkItem extends IPmoEntity {
  readonly title: string;
  readonly workItemCode?: string;
  readonly projectId: number;
  readonly projectCode: string;
  readonly itemType: ChoiceValue<typeof PMO_CHOICES.workItems.itemType>;
  readonly parentWorkItemId?: number;
  readonly phaseWorkItemId?: number;
  readonly description?: string;
  readonly assignedEmployeeId?: number;
  readonly assignedTo?: IPmoPerson;
  readonly reviewer?: IPmoPerson;
  readonly qaRequired: boolean;
  readonly qaOwner?: IPmoPerson;
  readonly status: ChoiceValue<typeof PMO_CHOICES.workItems.status>;
  readonly priority: ChoiceValue<typeof PMO_CHOICES.workItems.priority>;
  readonly plannedStart?: Date;
  readonly plannedEnd?: Date;
  readonly baselineEffortHours?: number;
  readonly approvedEffortHours?: number;
  readonly forecastEffortHours?: number;
  readonly actualEffortHours: number;
  readonly percentComplete: number;
  readonly acceptanceCriteria?: string;
  readonly dependencyIds: readonly number[];
  readonly isCritical: boolean;
  readonly actualStart?: Date;
  readonly submittedOn?: Date;
  readonly acceptedOn?: Date;
  readonly completedOn?: Date;
  readonly planVersion: number;
  readonly importRowKey?: string;
  readonly lastActionId?: number;
  readonly isActive: boolean;
}

export interface IPmoTaskAction extends IPmoEntity {
  readonly title: string;
  readonly projectId: number;
  readonly projectCode: string;
  readonly workItemId: number;
  readonly workItemCode: string;
  readonly actionType: ChoiceValue<typeof PMO_CHOICES.taskActions.actionType>;
  readonly requestedBy: IPmoPerson;
  readonly requestedOn: Date;
  readonly progressPercent?: number;
  readonly remainingEffortHours?: number;
  readonly comment?: string;
  readonly proposedStatus?: string;
  readonly processingStatus: ChoiceValue<
    typeof PMO_CHOICES.taskActions.processingStatus
  >;
  readonly processedOn?: Date;
  readonly resultMessage?: string;
  readonly teamsResponseId?: string;
}

export interface IPmoTimeEntry extends IPmoEntity {
  readonly title: string;
  readonly employeeId: number;
  readonly employeeUser: IPmoPerson;
  readonly workDate: Date;
  readonly projectId?: number;
  readonly projectCode?: string;
  readonly workItemId?: number;
  readonly workCategory: ChoiceValue<
    typeof PMO_CHOICES.timeEntries.workCategory
  >;
  readonly hours: number;
  readonly workPerformed: string;
  readonly progressPercent?: number;
  readonly blockerSummary?: string;
  readonly entryStatus: ChoiceValue<typeof PMO_CHOICES.timeEntries.entryStatus>;
  readonly submittedOn?: Date;
  readonly approvedBy?: IPmoPerson;
  readonly approvedOn?: Date;
  readonly correctionReason?: string;
  readonly isBillable: boolean;
  readonly isLocked: boolean;
}

export interface IPmoChangeRequest extends IPmoEntity {
  readonly title: string;
  readonly requestNumber: string;
  readonly requestType: ChoiceValue<
    typeof PMO_CHOICES.changeRequests.requestType
  >;
  readonly projectId: number;
  readonly projectCode: string;
  readonly workItemId?: number;
  readonly requestedBy: IPmoPerson;
  readonly requestedOn: Date;
  readonly reasonCategory: ChoiceValue<
    typeof PMO_CHOICES.changeRequests.reasonCategory
  >;
  readonly reasonDetails: string;
  readonly originalEffortHours?: number;
  readonly currentEffortHours?: number;
  readonly additionalHoursRequested?: number;
  readonly proposedEffortHours?: number;
  readonly originalDate?: Date;
  readonly proposedDate?: Date;
  readonly impactSummary: string;
  readonly mitigationPlan?: string;
  readonly requestStatus: ChoiceValue<
    typeof PMO_CHOICES.changeRequests.requestStatus
  >;
  readonly currentApprover?: IPmoPerson;
  readonly approvalRequestId?: number;
  readonly decisionComment?: string;
  readonly decidedBy?: IPmoPerson;
  readonly decidedOn?: Date;
}

export interface IPmoApprovalRequest extends IPmoEntity {
  readonly title: string;
  readonly approvalNumber: string;
  readonly approvalType: ChoiceValue<
    typeof PMO_CHOICES.approvalRequests.approvalType
  >;
  readonly sourceList: PmoContainerName;
  readonly sourceItemId: number;
  readonly projectId: number;
  readonly projectCode: string;
  readonly requestedBy: IPmoPerson;
  readonly requestedOn: Date;
  readonly approver: IPmoPerson;
  readonly approvalStatus: ChoiceValue<
    typeof PMO_CHOICES.approvalRequests.approvalStatus
  >;
  readonly decision?: ChoiceValue<typeof PMO_CHOICES.approvalRequests.decision>;
  readonly decisionComment?: string;
  readonly decidedBy?: IPmoPerson;
  readonly decidedOn?: Date;
  readonly dueOn?: Date;
  readonly escalationLevel: number;
  readonly flowApprovalId?: string;
  readonly flowProcessingStatus: ChoiceValue<
    typeof PMO_CHOICES.approvalRequests.flowProcessingStatus
  >;
}

export interface IPmoRiskIssue extends IPmoEntity {
  readonly title: string;
  readonly recordNumber: string;
  readonly recordType: ChoiceValue<typeof PMO_CHOICES.risksIssues.recordType>;
  readonly projectId: number;
  readonly projectCode: string;
  readonly workItemId?: number;
  readonly severity: ChoiceValue<typeof PMO_CHOICES.risksIssues.severity>;
  readonly probability?: ChoiceValue<
    typeof PMO_CHOICES.risksIssues.probability
  >;
  readonly description: string;
  readonly impact: string;
  readonly owner: IPmoPerson;
  readonly raisedBy: IPmoPerson;
  readonly raisedOn: Date;
  readonly targetResolutionDate?: Date;
  readonly status: ChoiceValue<typeof PMO_CHOICES.risksIssues.status>;
  readonly responsePlan?: string;
  readonly resolution?: string;
  readonly resolvedOn?: Date;
  readonly isEscalated: boolean;
}

export interface IPmoQualityItem extends IPmoEntity {
  readonly title: string;
  readonly qualityNumber: string;
  readonly qualityType: ChoiceValue<
    typeof PMO_CHOICES.qualityItems.qualityType
  >;
  readonly projectId: number;
  readonly projectCode: string;
  readonly workItemId?: number;
  readonly releaseName?: string;
  readonly status: ChoiceValue<typeof PMO_CHOICES.qualityItems.status>;
  readonly testResult?: ChoiceValue<typeof PMO_CHOICES.qualityItems.testResult>;
  readonly severity?: ChoiceValue<typeof PMO_CHOICES.qualityItems.severity>;
  readonly priority?: ChoiceValue<typeof PMO_CHOICES.qualityItems.priority>;
  readonly description: string;
  readonly evidenceLink?: IPmoHyperlink;
  readonly assignedTo?: IPmoPerson;
  readonly raisedBy: IPmoPerson;
  readonly raisedOn: Date;
  readonly targetFixDate?: Date;
  readonly fixEffortHours?: number;
  readonly rootCauseCategory?: ChoiceValue<
    typeof PMO_CHOICES.qualityItems.rootCauseCategory
  >;
  readonly rootCauseDetails?: string;
  readonly retestResult?: ChoiceValue<
    typeof PMO_CHOICES.qualityItems.retestResult
  >;
  readonly retestedBy?: IPmoPerson;
  readonly retestedOn?: Date;
  readonly customerImpact?: string;
  readonly approvalRequestId?: number;
  readonly isReleaseBlocking: boolean;
}

export interface IPmoLearningAssignment extends IPmoEntity {
  readonly title: string;
  readonly learningNumber: string;
  readonly employeeId: number;
  readonly employeeUser: IPmoPerson;
  readonly skillName: string;
  readonly objective: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly plannedHours: number;
  readonly actualHours: number;
  readonly mentor?: IPmoPerson;
  readonly deliverable: string;
  readonly evidenceLink?: IPmoHyperlink;
  readonly status: ChoiceValue<typeof PMO_CHOICES.learningAssignments.status>;
  readonly validationResult?: ChoiceValue<
    typeof PMO_CHOICES.learningAssignments.validationResult
  >;
  readonly validatedBy?: IPmoPerson;
  readonly validatedOn?: Date;
  readonly validationComment?: string;
}

export interface IPmoProjectCost extends IPmoEntity {
  readonly title: string;
  readonly costNumber: string;
  readonly projectId: number;
  readonly projectCode: string;
  readonly costType: ChoiceValue<typeof PMO_CHOICES.projectCosts.costType>;
  readonly sourceTimeEntryId?: number;
  readonly costDate: Date;
  readonly employeeId?: number;
  readonly amount: number;
  readonly currencyCode: string;
  readonly description: string;
  readonly costStatus: ChoiceValue<typeof PMO_CHOICES.projectCosts.costStatus>;
  readonly approvedBy?: IPmoPerson;
  readonly approvedOn?: Date;
  readonly reversalOfCostId?: number;
}

export interface IPmoProjectStatusReport extends IPmoEntity {
  readonly title: string;
  readonly projectId: number;
  readonly projectCode: string;
  readonly reportingDate: Date;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly overallStatus: ChoiceValue<
    typeof PMO_CHOICES.projectStatusReports.overallStatus
  >;
  readonly percentComplete: number;
  readonly forecastEnd?: Date;
  readonly forecastEffortHours?: number;
  readonly highlights: string;
  readonly risksIssuesSummary: string;
  readonly decisionsRequired?: string;
  readonly nextSteps: string;
  readonly reportStatus: ChoiceValue<
    typeof PMO_CHOICES.projectStatusReports.reportStatus
  >;
  readonly submittedBy?: IPmoPerson;
  readonly submittedOn?: Date;
  readonly approvedBy?: IPmoPerson;
  readonly approvedOn?: Date;
}

export interface IPmoImportBatch extends IPmoEntity {
  readonly title: string;
  readonly batchNumber: string;
  readonly projectId: number;
  readonly projectCode: string;
  readonly fileLink: IPmoHyperlink;
  readonly uploadedBy: IPmoPerson;
  readonly uploadedOn: Date;
  readonly templateVersion: string;
  readonly importStatus: ChoiceValue<
    typeof PMO_CHOICES.importBatches.importStatus
  >;
  readonly totalRows: number;
  readonly validRows: number;
  readonly errorRows: number;
  readonly errorFileLink?: IPmoHyperlink;
  readonly processedOn?: Date;
  readonly resultSummary?: string;
}

export interface IPmoProjectDocument extends IPmoEntity {
  readonly fileName: string;
  readonly serverRelativeUrl: string;
  readonly projectCode: string;
  readonly documentType: ChoiceValue<
    typeof PMO_CHOICES.projectDocuments.documentType
  >;
  readonly workItemId?: number;
  readonly qualityItemId?: number;
  readonly approvalRequestId?: number;
  readonly documentStatus: ChoiceValue<
    typeof PMO_CHOICES.projectDocuments.documentStatus
  >;
  readonly confidentiality: ChoiceValue<
    typeof PMO_CHOICES.projectDocuments.confidentiality
  >;
  readonly templateVersion?: string;
}
