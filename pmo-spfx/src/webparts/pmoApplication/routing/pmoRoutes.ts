import * as React from "react";

export const PMO_ROUTES = {
  home: "home",
  myWork: "my-work",
  myTime: "my-time",
  myRequests: "my-requests",
  myLearning: "my-learning",
  projects: "projects",
  projectList: "project-list",
  projectOnboarding: "project-onboarding",
  projectOverview: "project-overview",
  projectTeam: "project-team",
  projectWorkspace: "project-workspace",
  reviews: "reviews",
  approvals: "approvals",
  changeRequests: "change-requests",
  resources: "resources",
  quality: "quality",
  risks: "risks",
  statusReports: "status-reports",
  portfolio: "portfolio",
  reports: "reports",
  financialSummary: "financial-summary",
  settings: "settings",
  settingsList: "settings-list",
  employees: "employees",
  employeeList: "employee-list",
  employee: "employee",
  myProfile: "my-profile",
} as const;

export type PmoRoute =
  | (typeof PMO_ROUTES)[keyof typeof PMO_ROUTES]
  | (string & {});
export type PmoRouteParameter =
  | "projectId"
  | "workItemId"
  | "approvalId"
  | "requestId"
  | "qualityId"
  | "riskId"
  | "reportId"
  | "employeeId"
  | "returnView";

export interface IPmoRouteState {
  readonly view: PmoRoute;
  readonly parameters: Readonly<Partial<Record<PmoRouteParameter, string>>>;
  readonly query: Readonly<Record<string, string>>;
}

export interface IPmoNavigationItem {
  readonly key: string;
  readonly group: string;
  readonly label: string;
  readonly route: PmoRoute;
  readonly iconName?: string;
  readonly requiredCapabilities?: readonly string[];
}

/** Initial route registrations. Future feature modules append items to this typed contract. */
export const PMO_NAVIGATION: readonly IPmoNavigationItem[] = [
  {
    key: "my-profile",
    group: "My work",
    label: "My Profile",
    route: PMO_ROUTES.myProfile,
    iconName: "Contact",
    requiredCapabilities: ["employees.view-own"],
  },
  {
    key: "home",
    group: "Workspace",
    label: "Home",
    route: PMO_ROUTES.home,
    iconName: "Home",
  },
  {
    key: "my-work",
    group: "My work",
    label: "My Work",
    route: PMO_ROUTES.myWork,
    iconName: "TaskLogo",
    requiredCapabilities: ["work.view-own"],
  },
  {
    key: "my-time",
    group: "My work",
    label: "My Time",
    route: PMO_ROUTES.myTime,
    iconName: "Clock",
    requiredCapabilities: ["time.view-own"],
  },
  {
    key: "my-learning",
    group: "My work",
    label: "My Learning",
    route: PMO_ROUTES.myLearning,
    iconName: "Education",
    requiredCapabilities: ["time.view-own"],
  },
  {
    key: "projects",
    group: "Delivery",
    label: "Projects",
    route: PMO_ROUTES.projects,
    iconName: "ProjectCollection",
    requiredCapabilities: ["projects.view"],
  },
  {
    key: "reviews",
    group: "Delivery",
    label: "Reviews",
    route: PMO_ROUTES.reviews,
    iconName: "ReviewRequestSolid",
    requiredCapabilities: ["projects.manage"],
  },
  {
    key: "approvals",
    group: "Governance",
    label: "Approvals",
    route: PMO_ROUTES.approvals,
    iconName: "CompletedSolid",
    requiredCapabilities: ["approvals.view"],
  },
  {
    key: "change-requests",
    group: "Governance",
    label: "Change Requests",
    route: PMO_ROUTES.changeRequests,
    iconName: "ChangeEntitlements",
    requiredCapabilities: ["work.view-own"],
  },
  {
    key: "portfolio",
    group: "Governance",
    label: "Portfolio",
    route: PMO_ROUTES.portfolio,
    iconName: "ViewDashboard",
    requiredCapabilities: ["portfolio.view"],
  },
  {
    key: "resources",
    group: "Operations",
    label: "Resources",
    route: PMO_ROUTES.resources,
    iconName: "People",
    requiredCapabilities: ["resources.view"],
  },
  {
    key: "employees",
    group: "Operations",
    label: "Employees",
    route: PMO_ROUTES.employees,
    iconName: "Contact",
    requiredCapabilities: ["resources.view"],
  },
  {
    key: "quality",
    group: "Operations",
    label: "Quality",
    route: PMO_ROUTES.quality,
    iconName: "Shield",
    requiredCapabilities: ["quality.view"],
  },
  {
    key: "risks",
    group: "Operations",
    label: "Risks and Issues",
    route: PMO_ROUTES.risks,
    iconName: "Warning",
    requiredCapabilities: ["projects.view"],
  },
  {
    key: "status-reports",
    group: "Governance",
    label: "Status Reports",
    route: PMO_ROUTES.statusReports,
    iconName: "ReportDocument",
    requiredCapabilities: ["projects.view"],
  },
  {
    key: "financials",
    group: "Restricted",
    label: "Financial Summary",
    route: PMO_ROUTES.financialSummary,
    iconName: "Money",
    requiredCapabilities: ["finance.view"],
  },
  {
    key: "settings",
    group: "Administration",
    label: "Configuration",
    route: PMO_ROUTES.settings,
    iconName: "Settings",
    requiredCapabilities: ["configuration.manage"],
  },
];

export const registerPmoNavigation = (
  ...registrations: readonly (readonly IPmoNavigationItem[])[]
): readonly IPmoNavigationItem[] =>
  registrations.reduce<IPmoNavigationItem[]>(
    (all, registration) => all.concat(registration),
    [],
  );

const parameterKeys: readonly PmoRouteParameter[] = [
  "projectId",
  "workItemId",
  "approvalId",
  "requestId",
  "qualityId",
  "riskId",
  "reportId",
  "employeeId",
  "returnView",
];

/** Parses standard deep-link parameters while retaining feature filter parameters. */
export const parsePmoRoute = (
  search: string,
  defaultView: PmoRoute = PMO_ROUTES.home,
): IPmoRouteState => {
  const values = new URLSearchParams(search);
  const query: Record<string, string> = {};
  values.forEach((value, key) => {
    query[key] = value;
  });
  const parameters: Partial<Record<PmoRouteParameter, string>> = {};
  for (const key of parameterKeys) {
    const value = values.get(key);
    if (value) parameters[key] = value;
  }
  return { view: values.get("view") ?? defaultView, parameters, query };
};

export const serializePmoRoute = (route: IPmoRouteState): string => {
  const values = new URLSearchParams(route.query);
  values.set("view", route.view);
  for (const key of parameterKeys) {
    const value = route.parameters[key];
    if (value) values.set(key, value);
    else values.delete(key);
  }
  return `?${values.toString()}`;
};

export const PMO_BEFORE_NAVIGATE_EVENT = "pmo:before-navigate";

export const requestPmoNavigation = (
  route: IPmoRouteState,
  history: History = window.history,
): boolean => {
  const event = new Event(PMO_BEFORE_NAVIGATE_EVENT, { cancelable: true });
  if (!window.dispatchEvent(event)) return false;
  history.pushState({}, "", serializePmoRoute(route));
  window.dispatchEvent(new PopStateEvent("popstate"));
  return true;
};

export const requestPmoBack = (history: History = window.history): boolean => {
  const event = new Event(PMO_BEFORE_NAVIGATE_EVENT, { cancelable: true });
  if (!window.dispatchEvent(event)) return false;
  history.back();
  return true;
};

export interface IPmoRouteContextValue {
  readonly route: IPmoRouteState;
  readonly navigate: (route: IPmoRouteState) => boolean;
  readonly back: () => void;
}

export const PmoRouteContext = React.createContext<
  IPmoRouteContextValue | undefined
>(undefined);

export const usePmoRoute = (): IPmoRouteContextValue => {
  const value = React.useContext(PmoRouteContext);
  if (!value)
    throw new Error("usePmoRoute must be used inside PmoRouteProvider.");
  return value;
};

export const PmoRouteProvider = ({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement => {
  const [route, setRoute] = React.useState(() =>
    parsePmoRoute(typeof window === "undefined" ? "" : window.location.search),
  );
  React.useEffect(() => {
    const onPopState = (): void =>
      setRoute(parsePmoRoute(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const navigate = React.useCallback((next: IPmoRouteState): boolean => {
    const accepted = requestPmoNavigation(next);
    if (accepted) setRoute(next);
    return accepted;
  }, []);
  const back = React.useCallback((): void => {
    requestPmoBack();
  }, []);
  return React.createElement(
    PmoRouteContext.Provider,
    { value: { route, navigate, back } },
    children,
  );
};
