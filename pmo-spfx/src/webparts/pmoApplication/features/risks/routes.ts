import { PMO_ROUTES } from "../../routing/pmoRoutes";

export const RISK_ROUTES = {
  dashboard: PMO_ROUTES.risks,
  list: "risk-list",
  detail: "risk-detail",
} as const;
