export const PMO_SITE_URL =
  "https://aufaitcloud.sharepoint.com/sites/ProjectManagementTool";
export const PMO_SITE_RELATIVE_URL = "/sites/ProjectManagementTool";

export const PMO_LISTS = {
  config: "PMO_Config",
  employees: "PMO_Employees",
  employeeRates: "PMO_EmployeeRates",
  projects: "PMO_Projects",
  projectFinancials: "PMO_ProjectFinancials",
  projectMembers: "PMO_ProjectMembers",
  workItems: "PMO_WorkItems",
  taskActions: "PMO_TaskActions",
  timeEntries: "PMO_TimeEntries",
  changeRequests: "PMO_ChangeRequests",
  approvalRequests: "PMO_ApprovalRequests",
  risksIssues: "PMO_RisksIssues",
  qualityItems: "PMO_QualityItems",
  learningAssignments: "PMO_LearningAssignments",
  projectCosts: "PMO_ProjectCosts",
  projectStatusReports: "PMO_ProjectStatusReports",
  importBatches: "PMO_ImportBatches",
  projectDocuments: "PMO_ProjectDocuments",
} as const;

export type PmoListName = (typeof PMO_LISTS)[keyof typeof PMO_LISTS];

export interface IPmoEnvironmentConfiguration {
  readonly siteUrl: string;
  readonly siteRelativeUrl: string;
  readonly lists: typeof PMO_LISTS;
}

/** The sole environment contract imported by PMO features and services. */
export const pmoEnvironment: IPmoEnvironmentConfiguration = {
  siteUrl: PMO_SITE_URL,
  siteRelativeUrl: PMO_SITE_RELATIVE_URL,
  lists: PMO_LISTS,
};
