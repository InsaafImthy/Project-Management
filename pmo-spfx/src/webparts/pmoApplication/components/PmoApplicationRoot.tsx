import * as React from "react";
import { ThemeProvider } from "@fluentui/react";
import {
  PmoApplicationContext,
  PmoApplicationProvider,
} from "../context/PmoApplicationContext";
import {
  PmoServicesContext,
  type IPmoFeatureServices,
} from "../context/PmoServicesContext";
import type { PmoApplicationStatus } from "../models/application";
import type { IPmoCurrentUser } from "../models/application";
import {
  ConfigRepository,
  EmployeesRepository,
  ApprovalRequestsRepository,
  ChangeRequestsRepository,
  ProjectFinancialsRepository,
  ProjectMembersRepository,
  ProjectsRepository,
  QualityItemsRepository,
  RisksIssuesRepository,
  TaskActionsRepository,
  TimeEntriesRepository,
  LearningAssignmentsRepository,
  WorkItemsRepository,
  ProjectCostsRepository,
  ProjectStatusReportsRepository,
  EmployeeRatesRepository,
} from "../services/repositories";
import {
  ConfigurationManagementService,
  EmployeeManagementService,
  PeopleDirectoryService,
  PlanningService,
  ProjectManagementService,
  ReviewWorkflowService,
  TaskWorkflowService,
  WorkManagementService,
  UserCapabilityService,
  TimeManagementService,
  ResourceManagementService,
  LearningManagementService,
  ChangeManagementService,
  MetricsService,
  QualityGovernanceService,
  RiskManagementService,
  ProjectStatusReportService,
  ClosureReadinessService,
  FinancialManagementService,
} from "../services/domain";
import type { ISharePointClient } from "../services/sharepoint/SharePointClient";
import { parseConfigNumber } from "../validation/configuration";
import { pmoTheme } from "../theme/pmoTheme";
import { PmoErrorBoundary } from "./feedback/PmoErrorBoundary";
import { PmoLoadingState } from "./feedback/PmoLoadingState";
import { ComponentGallery } from "./gallery/ComponentGallery";
import {
  AccessDeniedPage,
  AppShell,
  ContentContainer,
  PageHeader,
} from "./layout";
import { SummaryCard } from "./composites";
import {
  EmployeeDashboardPage,
  EmployeeDetailPage,
  EmployeeListPage,
  EMPLOYEE_ROUTES,
} from "../features/employees";
import {
  SettingsDashboardPage,
  SettingsListPage,
  SETTINGS_ROUTES,
} from "../features/settings";
import {
  ProjectDashboardPage,
  ProjectListPage,
  ProjectOnboardingPage,
  ProjectWorkspacePage,
  PROJECT_ROUTES,
} from "../features/projects";
import {
  ProjectPlanPage,
  PlanningDashboardPage,
  PLANNING_ROUTES,
} from "../features/planning";
import {
  MyWorkPage,
  ReviewQueuePage,
  TaskDetailPage,
  WORK_ROUTES,
} from "../features/work";
import { MyTimePage, TimeReviewPage, TIME_ROUTES } from "../features/time";
import { ResourceDashboardPage, RESOURCE_ROUTES } from "../features/resources";
import {
  LearningManagerPage,
  MyLearningPage,
  LEARNING_ROUTES,
} from "../features/learning";
import { usePmoRoute } from "../routing/pmoRoutes";
import {
  ApprovalDashboardPage,
  ApprovalDetailPage,
  ApprovalQueuePage,
  APPROVAL_ROUTES,
  ChangeRequestDetailPage,
  ChangeRequestsPage,
} from "../features/approvals";
import {
  QualityDashboardPage,
  QualityDetailPage,
  QualityListPage,
  QUALITY_ROUTES,
} from "../features/quality";
import {
  RiskDashboardPage,
  RiskDetailPage,
  RiskListPage,
  RISK_ROUTES,
} from "../features/risks";
import {
  StatusReportDashboardPage,
  StatusReportDetailPage,
  StatusReportEditorPage,
  StatusReportListPage,
  STATUS_REPORT_ROUTES,
} from "../features/statusReports";
import {
  FinanceDashboardPage,
  EmployeeRatesPage,
  ProjectCostsPage,
  ProjectFinancialsPage,
  FINANCE_ROUTES,
} from "../features/finance";

export interface IPmoApplicationRootProps {
  readonly userDisplayName: string;
  readonly userEmail: string;
  readonly status?: PmoApplicationStatus;
  readonly sharePointClient?: ISharePointClient;
}

const PmoFoundationMessage = (): React.ReactElement => (
  <ContentContainer>
    <PageHeader
      title="PMO workspace"
      subtitle="Shared navigation, layouts, data presentation, forms, and dashboard composition are ready for feature modules."
      breadcrumbs={[{ text: "Home" }]}
    />
    <SummaryCard title="Application foundation">
      <p>
        Choose an available module from the navigation. Modules appear according
        to the capabilities resolved for the current user.
      </p>
    </SummaryCard>
  </ContentContainer>
);

const PmoApplicationContent = ({
  status,
  showComponentGallery,
}: {
  readonly status: PmoApplicationStatus;
  readonly showComponentGallery: boolean;
}): React.ReactElement => {
  switch (status) {
    case "loading":
      return <PmoLoadingState />;
    case "accessDenied":
      return <AccessDeniedPage />;
    case "ready":
      return (
        <AppShell>
          {showComponentGallery ? <ComponentGallery /> : <PmoRouteContent />}
        </AppShell>
      );
    case "error":
      throw new Error("An application rendering error was requested.");
  }
};

function PmoRouteContent(): React.ReactElement {
  const { route, back } = usePmoRoute();
  const user = React.useContext(PmoApplicationContext);
  if (route.view === FINANCE_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("finance.view") ?? -1) >= 0 ? (
      <FinanceDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === FINANCE_ROUTES.rates) {
    return (user?.capabilities.indexOf("finance.view") ?? -1) >= 0 ? (
      <EmployeeRatesPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === FINANCE_ROUTES.costs) {
    return (user?.capabilities.indexOf("finance.view") ?? -1) >= 0 ? (
      <ProjectCostsPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === FINANCE_ROUTES.projectFinancials) {
    return (user?.capabilities.indexOf("finance.project-summary") ?? -1) >= 0 ||
      (user?.capabilities.indexOf("finance.view") ?? -1) >= 0 ? (
      <ProjectFinancialsPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === QUALITY_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("quality.view") ?? -1) >= 0 ? (
      <QualityDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === QUALITY_ROUTES.list) {
    return (user?.capabilities.indexOf("quality.view") ?? -1) >= 0 ? (
      <QualityListPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === QUALITY_ROUTES.detail) {
    return (user?.capabilities.indexOf("quality.view") ?? -1) >= 0 ? (
      <QualityDetailPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === RISK_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <RiskDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === RISK_ROUTES.list) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <RiskListPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === RISK_ROUTES.detail) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <RiskDetailPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === STATUS_REPORT_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <StatusReportDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === STATUS_REPORT_ROUTES.list) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <StatusReportListPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === STATUS_REPORT_ROUTES.editor) {
    return (user?.capabilities.indexOf("projects.manage") ?? -1) >= 0 ? (
      <StatusReportEditorPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === STATUS_REPORT_ROUTES.detail) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <StatusReportDetailPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === APPROVAL_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("approvals.view") ?? -1) >= 0 ||
      (user?.capabilities.indexOf("work.view-own") ?? -1) >= 0 ? (
      <ApprovalDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === APPROVAL_ROUTES.requests) {
    return (user?.capabilities.indexOf("work.view-own") ?? -1) >= 0 ||
      (user?.capabilities.indexOf("projects.manage") ?? -1) >= 0 ? (
      <ChangeRequestsPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === APPROVAL_ROUTES.request) {
    return (user?.capabilities.indexOf("work.view-own") ?? -1) >= 0 ||
      (user?.capabilities.indexOf("approvals.view") ?? -1) >= 0 ? (
      <ChangeRequestDetailPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === APPROVAL_ROUTES.queue) {
    return (user?.capabilities.indexOf("approvals.view") ?? -1) >= 0 ? (
      <ApprovalQueuePage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === APPROVAL_ROUTES.detail) {
    return (user?.capabilities.indexOf("approvals.view") ?? -1) >= 0 ? (
      <ApprovalDetailPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (
    route.view === TIME_ROUTES.dashboard ||
    route.view === TIME_ROUTES.daily ||
    route.view === TIME_ROUTES.weekly
  ) {
    return (user?.capabilities.indexOf("time.view-own") ?? -1) >= 0 ? (
      <MyTimePage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === TIME_ROUTES.review) {
    return (user?.capabilities.indexOf("projects.manage") ?? -1) >= 0 ||
      (user?.capabilities.indexOf("time.review") ?? -1) >= 0 ? (
      <TimeReviewPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === RESOURCE_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("resources.view") ?? -1) >= 0 ? (
      <ResourceDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === LEARNING_ROUTES.mine) {
    return (user?.capabilities.indexOf("time.view-own") ?? -1) >= 0 ? (
      <MyLearningPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === LEARNING_ROUTES.manage) {
    return (user?.capabilities.indexOf("resources.manage") ?? -1) >= 0 ? (
      <LearningManagerPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === PLANNING_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <PlanningDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === PLANNING_ROUTES.plan) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <ProjectPlanPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === WORK_ROUTES.myWork) {
    return (user?.capabilities.indexOf("work.view-own") ?? -1) >= 0 ? (
      <MyWorkPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === WORK_ROUTES.task) {
    return (user?.capabilities.indexOf("work.view-own") ?? -1) >= 0 ||
      (user?.capabilities.indexOf("projects.manage") ?? -1) >= 0 ||
      (user?.capabilities.indexOf("quality.manage") ?? -1) >= 0 ? (
      <TaskDetailPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === WORK_ROUTES.reviews) {
    return (user?.capabilities.indexOf("projects.manage") ?? -1) >= 0 ||
      (user?.capabilities.indexOf("quality.manage") ?? -1) >= 0 ? (
      <ReviewQueuePage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === PROJECT_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <ProjectDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === PROJECT_ROUTES.list) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <ProjectListPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === PROJECT_ROUTES.onboarding) {
    return (user?.capabilities.indexOf("projects.manage") ?? -1) >= 0 ? (
      <ProjectOnboardingPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (
    route.view === PROJECT_ROUTES.overview ||
    route.view === PROJECT_ROUTES.team
  ) {
    return (user?.capabilities.indexOf("projects.view") ?? -1) >= 0 ? (
      <ProjectWorkspacePage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === SETTINGS_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("configuration.manage") ?? -1) >= 0 ? (
      <SettingsDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === SETTINGS_ROUTES.list) {
    return (user?.capabilities.indexOf("configuration.manage") ?? -1) >= 0 ? (
      <SettingsListPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === EMPLOYEE_ROUTES.dashboard) {
    return (user?.capabilities.indexOf("resources.view") ?? -1) >= 0 ? (
      <EmployeeDashboardPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === EMPLOYEE_ROUTES.list) {
    return (user?.capabilities.indexOf("resources.view") ?? -1) >= 0 ? (
      <EmployeeListPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === EMPLOYEE_ROUTES.detail) {
    return (user?.capabilities.indexOf("resources.view") ?? -1) >= 0 ? (
      <EmployeeDetailPage />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  if (route.view === EMPLOYEE_ROUTES.myProfile) {
    return (user?.capabilities.indexOf("employees.view-own") ?? -1) >= 0 ? (
      <EmployeeDetailPage myProfile />
    ) : (
      <AccessDeniedPage onBack={back} />
    );
  }
  return <PmoFoundationMessage />;
}

const createFeatureServices = (
  client: ISharePointClient,
): {
  readonly capabilities: UserCapabilityService;
  readonly services: IPmoFeatureServices;
} => {
  const configRepository = new ConfigRepository(client);
  const employeesRepository = new EmployeesRepository(client);
  const membersRepository = new ProjectMembersRepository(client);
  const workItemsRepository = new WorkItemsRepository(client);
  const projectsRepository = new ProjectsRepository(client);
  const financialsRepository = new ProjectFinancialsRepository(client);
  const approvalsRepository = new ApprovalRequestsRepository(client);
  const changesRepository = new ChangeRequestsRepository(client);
  const qualityRepository = new QualityItemsRepository(client);
  const risksIssuesRepository = new RisksIssuesRepository(client);
  const timeRepository = new TimeEntriesRepository(client);
  const taskActionsRepository = new TaskActionsRepository(client);
  const learningRepository = new LearningAssignmentsRepository(client);
  const projectCostsRepository = new ProjectCostsRepository(client);
  const employeeRatesRepository = new EmployeeRatesRepository(client);
  const statusReportsRepository = new ProjectStatusReportsRepository(client);
  const capabilities = new UserCapabilityService(
    client,
    employeesRepository,
    membersRepository,
  );
  const settings = new ConfigurationManagementService(
    configRepository,
    capabilities,
  );
  const employees = new EmployeeManagementService(
    employeesRepository,
    membersRepository,
    workItemsRepository,
    capabilities,
    async () => {
      const configured = (await settings.cache.getActive()).find(
        (setting) => setting.key === "StandardHoursPerDay",
      );
      return parseConfigNumber(configured?.value ?? "") ?? 24;
    },
  );
  const metrics = new MetricsService(
    projectsRepository,
    workItemsRepository,
    timeRepository,
    qualityRepository,
    projectCostsRepository,
    financialsRepository,
  );
  const closureReadiness = new ClosureReadinessService(
    workItemsRepository,
    timeRepository,
    qualityRepository,
    approvalsRepository,
    risksIssuesRepository,
    statusReportsRepository,
  );
  return {
    capabilities,
    services: {
      settings,
      employees,
      people: new PeopleDirectoryService(client),
      projects: new ProjectManagementService(
        projectsRepository,
        financialsRepository,
        membersRepository,
        employeesRepository,
        approvalsRepository,
        workItemsRepository,
        changesRepository,
        qualityRepository,
        timeRepository,
        risksIssuesRepository,
        capabilities,
        closureReadiness,
      ),
      planning: new PlanningService(
        projectsRepository,
        workItemsRepository,
        employeesRepository,
        approvalsRepository,
        capabilities,
      ),
      taskWorkflow: new TaskWorkflowService(
        workItemsRepository,
        taskActionsRepository,
        risksIssuesRepository,
      ),
      reviews: new ReviewWorkflowService(workItemsRepository, capabilities),
      work: new WorkManagementService(
        workItemsRepository,
        taskActionsRepository,
        new TaskWorkflowService(
          workItemsRepository,
          taskActionsRepository,
          risksIssuesRepository,
        ),
        new ReviewWorkflowService(workItemsRepository, capabilities),
        capabilities,
      ),
      time: new TimeManagementService(
        timeRepository,
        workItemsRepository,
        membersRepository,
        learningRepository,
        settings,
        capabilities,
      ),
      resources: new ResourceManagementService(
        employeesRepository,
        membersRepository,
        capabilities,
      ),
      learning: new LearningManagementService(
        learningRepository,
        employeesRepository,
        timeRepository,
        capabilities,
      ),
      changes: new ChangeManagementService(
        changesRepository,
        approvalsRepository,
        projectsRepository,
        workItemsRepository,
        employeesRepository,
        qualityRepository,
        timeRepository,
        capabilities,
        metrics,
      ),
      quality: new QualityGovernanceService(
        qualityRepository,
        approvalsRepository,
        projectsRepository,
        workItemsRepository,
        changesRepository,
        timeRepository,
        employeesRepository,
        capabilities,
      ),
      risks: new RiskManagementService(
        risksIssuesRepository,
        projectsRepository,
        capabilities,
      ),
      statusReports: new ProjectStatusReportService(
        statusReportsRepository,
        projectsRepository,
        workItemsRepository,
        capabilities,
      ),
      closureReadiness,
      finance: new FinancialManagementService(
        employeeRatesRepository,
        projectCostsRepository,
        financialsRepository,
        timeRepository,
        projectsRepository,
        capabilities,
        async () => {
          const configured = (await settings.cache.getActive()).find(
            (setting) => setting.key === "PersonDayHours",
          );
          return parseConfigNumber(configured?.value ?? "") ?? 8;
        },
        async () => {
          const configured = (await settings.cache.getActive()).find(
            (setting) => setting.key === "ApprovedMarginThresholdPercent",
          );
          return parseConfigNumber(configured?.value ?? "") ?? 0;
        },
      ),
    },
  };
};

export const PmoApplicationRoot = ({
  userDisplayName,
  userEmail,
  status = "ready",
  sharePointClient,
}: IPmoApplicationRootProps): React.ReactElement => {
  const showComponentGallery =
    typeof DEBUG !== "undefined" &&
    DEBUG &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("pmoGallery") === "true";

  const featureHost = React.useMemo(
    () =>
      sharePointClient ? createFeatureServices(sharePointClient) : undefined,
    [sharePointClient],
  );
  const [resolvedUser, setResolvedUser] = React.useState<IPmoCurrentUser>({
    displayName: userDisplayName,
    email: userEmail,
    capabilities: [],
  });
  const [resolvedStatus, setResolvedStatus] =
    React.useState<PmoApplicationStatus>(featureHost ? "loading" : status);
  React.useEffect(() => {
    if (!featureHost) {
      setResolvedStatus(status);
      return;
    }
    let active = true;
    setResolvedStatus("loading");
    featureHost.capabilities
      .resolveCurrent()
      .then((user) => {
        if (!active) return;
        setResolvedUser({
          displayName: user.displayName,
          email: user.email,
          employeeId: user.employee?.id,
          securityRoles: Array.from(user.securityRoles),
          capabilities: Array.from(user.capabilities),
        });
        setResolvedStatus(status);
      })
      .catch(() => active && setResolvedStatus("error"));
    return () => {
      active = false;
    };
  }, [featureHost, status]);
  const application = (
    <ThemeProvider theme={pmoTheme}>
      <PmoApplicationProvider currentUser={resolvedUser}>
        <PmoErrorBoundary>
          <PmoApplicationContent
            status={resolvedStatus}
            showComponentGallery={showComponentGallery}
          />
        </PmoErrorBoundary>
      </PmoApplicationProvider>
    </ThemeProvider>
  );
  return featureHost ? (
    <PmoServicesContext.Provider value={featureHost.services}>
      {application}
    </PmoServicesContext.Provider>
  ) : (
    application
  );
};
