import { PMO_ROUTES } from "../../routing/pmoRoutes";

export const PROJECT_ROUTES = {
  dashboard: PMO_ROUTES.projects,
  list: PMO_ROUTES.projectList,
  onboarding: "project-onboarding",
  overview: "project-overview",
  team: "project-team",
} as const;
