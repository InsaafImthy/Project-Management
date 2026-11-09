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
