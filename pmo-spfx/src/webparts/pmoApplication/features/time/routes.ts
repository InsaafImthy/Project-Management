import { PMO_ROUTES } from "../../routing/pmoRoutes";
export const TIME_ROUTES = {
  dashboard: PMO_ROUTES.myTime,
  daily: "time-daily",
  weekly: "time-weekly",
  review: "time-review",
} as const;
