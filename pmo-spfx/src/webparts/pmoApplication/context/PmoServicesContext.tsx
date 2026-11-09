import * as React from "react";
import type {
  ConfigurationManagementService,
  EmployeeManagementService,
  PeopleDirectoryService,
  PlanningService,
  ProjectManagementService,
  ReviewWorkflowService,
  TaskWorkflowService,
  WorkManagementService,
  TimeManagementService,
  ResourceManagementService,
  LearningManagementService,
  ChangeManagementService,
  QualityGovernanceService,
  RiskManagementService,
  ProjectStatusReportService,
  ClosureReadinessService,
} from "../services/domain";

export interface IPmoFeatureServices {
  readonly settings: ConfigurationManagementService;
  readonly employees: EmployeeManagementService;
  readonly people: PeopleDirectoryService;
  readonly projects: ProjectManagementService;
  readonly planning: PlanningService;
  readonly taskWorkflow: TaskWorkflowService;
  readonly reviews: ReviewWorkflowService;
  readonly work: WorkManagementService;
  readonly time: TimeManagementService;
  readonly resources: ResourceManagementService;
  readonly learning: LearningManagementService;
  readonly changes: ChangeManagementService;
  readonly quality: QualityGovernanceService;
  readonly risks: RiskManagementService;
  readonly statusReports: ProjectStatusReportService;
  readonly closureReadiness: ClosureReadinessService;
}

export const PmoServicesContext = React.createContext<
  IPmoFeatureServices | undefined
>(undefined);

export const usePmoServices = (): IPmoFeatureServices => {
  const services = React.useContext(PmoServicesContext);
  if (!services) {
    throw new Error(
      "Feature services are not available in this application host.",
    );
  }
  return services;
};
