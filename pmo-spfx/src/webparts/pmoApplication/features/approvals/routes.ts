import { PMO_ROUTES } from "../../routing/pmoRoutes";

export const APPROVAL_ROUTES = {
  dashboard: PMO_ROUTES.approvals,
  requests: "change-requests",
  request: "change-request",
  queue: "approval-queue",
  detail: "approval-detail",
} as const;
