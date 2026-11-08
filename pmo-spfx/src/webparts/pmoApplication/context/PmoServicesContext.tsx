import * as React from "react";
import type {
  ConfigurationManagementService,
  EmployeeManagementService,
  PeopleDirectoryService,
} from "../services/domain";

export interface IPmoFeatureServices {
  readonly settings: ConfigurationManagementService;
  readonly employees: EmployeeManagementService;
  readonly people: PeopleDirectoryService;
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
