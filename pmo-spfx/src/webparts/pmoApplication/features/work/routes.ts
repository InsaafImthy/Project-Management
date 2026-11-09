import { PMO_ROUTES } from "../../routing/pmoRoutes";

export const WORK_ROUTES = {
  myWork: PMO_ROUTES.myWork,
  task: "task",
  reviews: PMO_ROUTES.reviews,
} as const;
