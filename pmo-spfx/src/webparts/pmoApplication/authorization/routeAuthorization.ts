export interface IPmoRouteAuthorization {
  /** At least one capability is required. An empty list means authenticated access. */
  readonly anyOf: readonly string[];
}

/** Authoritative registry for deep-link authorization and not-found handling. */
export const PMO_ROUTE_AUTHORIZATION: Readonly<
  Record<string, IPmoRouteAuthorization>
> = {
  home: { anyOf: [] },
  reports: {
    anyOf: [
      "projects.view",
      "work.view-own",
      "time.view-own",
      "quality.view",
      "resources.view",
    ],
  },
  portfolio: { anyOf: ["portfolio.view"] },
  "financial-summary": { anyOf: ["finance.view"] },
  "employee-rates": { anyOf: ["finance.view"] },
  "project-costs": { anyOf: ["finance.view"] },
  "project-financials": {
    anyOf: ["finance.view", "finance.project-summary"],
  },
  quality: { anyOf: ["quality.view"] },
  "quality-list": { anyOf: ["quality.view"] },
  "quality-detail": { anyOf: ["quality.view"] },
  risks: { anyOf: ["projects.view"] },
  "risk-list": { anyOf: ["projects.view"] },
  "risk-detail": { anyOf: ["projects.view"] },
  "status-reports": { anyOf: ["projects.view"] },
  "status-report-list": { anyOf: ["projects.view"] },
  "status-report-editor": { anyOf: ["projects.manage"] },
  "status-report-detail": { anyOf: ["projects.view"] },
  approvals: { anyOf: ["approvals.view", "work.view-own"] },
  "change-requests": { anyOf: ["work.view-own", "projects.manage"] },
  "change-request": { anyOf: ["work.view-own", "approvals.view"] },
  "approval-queue": { anyOf: ["approvals.view"] },
  "approval-detail": { anyOf: ["approvals.view"] },
  "my-time": { anyOf: ["time.view-own"] },
  "time-daily": { anyOf: ["time.view-own"] },
  "time-weekly": { anyOf: ["time.view-own"] },
  "time-review": { anyOf: ["time.review", "projects.manage"] },
  resources: { anyOf: ["resources.view"] },
  "my-learning": { anyOf: ["time.view-own"] },
  "learning-manage": { anyOf: ["resources.manage"] },
  "planning-dashboard": { anyOf: ["projects.view"] },
  "project-plan": { anyOf: ["projects.view"] },
  "my-work": { anyOf: ["work.view-own"] },
  task: {
    anyOf: ["work.view-own", "projects.manage", "quality.manage"],
  },
  reviews: { anyOf: ["projects.manage", "quality.manage"] },
  projects: { anyOf: ["projects.view"] },
  "project-list": { anyOf: ["projects.view"] },
  "project-onboarding": { anyOf: ["projects.manage"] },
  "project-overview": { anyOf: ["projects.view"] },
  "project-team": { anyOf: ["projects.view"] },
  settings: { anyOf: ["configuration.manage"] },
  "settings-list": { anyOf: ["configuration.manage"] },
  employees: { anyOf: ["resources.view"] },
  "employee-list": { anyOf: ["resources.view"] },
  employee: { anyOf: ["resources.view"] },
  "my-profile": { anyOf: ["employees.view-own"] },
  "support-diagnostics": {
    anyOf: ["support.failed-actions", "configuration.manage"],
  },
};

export const isKnownPmoRoute = (route: string): boolean =>
  route in PMO_ROUTE_AUTHORIZATION;

export const canOpenPmoRoute = (
  capabilities: readonly string[],
  route: string,
): boolean => {
  const authorization = PMO_ROUTE_AUTHORIZATION[route];
  if (!authorization) return false;
  return (
    authorization.anyOf.length === 0 ||
    authorization.anyOf.some(
      (capability) => capabilities.indexOf(capability) >= 0,
    )
  );
};
