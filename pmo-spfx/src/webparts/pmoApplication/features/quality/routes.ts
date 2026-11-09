import { PMO_ROUTES } from "../../routing/pmoRoutes";

export const QUALITY_ROUTES = {
  dashboard: PMO_ROUTES.quality,
  list: "quality-list",
  detail: "quality-detail",
} as const;
