export const PMO_SITE_URL =
  "https://aufaitcloud.sharepoint.com/sites/ProjectManagementTool";
export const PMO_SITE_RELATIVE_URL = "/sites/ProjectManagementTool";

import { PMO_CONTAINERS, type PmoContainerName } from "./sharePointSchema";

export { PMO_LISTS } from "./sharePointSchema";
export type { PmoContainerName, PmoListName } from "./sharePointSchema";

export interface IPmoEnvironmentConfiguration {
  readonly siteUrl: string;
  readonly siteRelativeUrl: string;
  readonly lists: typeof PMO_CONTAINERS;
}

/** The sole environment contract imported by PMO features and services. */
export const pmoEnvironment: IPmoEnvironmentConfiguration = {
  siteUrl: PMO_SITE_URL,
  siteRelativeUrl: PMO_SITE_RELATIVE_URL,
  lists: PMO_CONTAINERS,
};

/** Backward-compatible alias for Stage 01 services. */
export type PmoEnvironmentListName = PmoContainerName;
