import { PMO_ROUTES } from "../../routing/pmoRoutes";

export const STATUS_REPORT_ROUTES = {
  dashboard: PMO_ROUTES.statusReports,
  list: "status-report-list",
  editor: "status-report-editor",
  detail: "status-report-detail",
} as const;
