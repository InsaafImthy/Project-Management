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
  ProjectMembersRepository,
  WorkItemsRepository,
} from "../services/repositories";
import {
  ConfigurationManagementService,
  EmployeeManagementService,
  PeopleDirectoryService,
  UserCapabilityService,
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
import { usePmoRoute } from "../routing/pmoRoutes";

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
  return {
    capabilities,
    services: {
      settings,
      employees,
      people: new PeopleDirectoryService(client),
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
