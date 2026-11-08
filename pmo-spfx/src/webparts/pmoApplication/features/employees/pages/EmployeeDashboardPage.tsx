import * as React from "react";
import {
  DashboardLayout,
  KpiCard,
  KpiGrid,
  ProgressSummary,
  SummaryCard,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  ErrorState,
  LoadingSkeleton,
} from "../../../components/primitives";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import { useEmployeeDashboard } from "../hooks/useEmployees";
import { EMPLOYEE_ROUTES } from "../routes";

export const EmployeeDashboardPage = (): React.ReactElement => {
  const { employees } = usePmoServices();
  const { navigate } = usePmoRoute();
  const dashboard = useEmployeeDashboard(employees);
  const openList = (query: Readonly<Record<string, string>> = {}): void => {
    navigate({
      view: EMPLOYEE_ROUTES.list,
      parameters: {},
      query: { view: EMPLOYEE_ROUTES.list, ...query },
    });
  };
  const summary = dashboard.summary;
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="Employees"
          subtitle="Capacity, eligibility, and non-confidential employee profiles."
          breadcrumbs={[{ text: "Operations" }, { text: "Employees" }]}
          commands={
            <AppButton text="View employees" onClick={() => openList()} />
          }
        />
        {dashboard.loading ? (
          <LoadingSkeleton label="Loading employee dashboard" />
        ) : dashboard.error || !summary ? (
          <ErrorState
            message={dashboard.error ?? "Employee summary is unavailable."}
          />
        ) : (
          <>
            <KpiGrid>
              <KpiCard
                title="Active employees"
                value={summary.totalActive}
                onDrillDown={() => openList({ active: "true" })}
              />
              <KpiCard
                title="Project managers"
                value={summary.projectManagerEligible}
                onDrillDown={() => openList({ eligibility: "projectManager" })}
              />
              <KpiCard
                title="QA eligible"
                value={summary.qaEligible}
                onDrillDown={() => openList({ eligibility: "qa" })}
              />
              <KpiCard
                title="Resource managers"
                value={summary.resourceManagerEligible}
                onDrillDown={() => openList({ eligibility: "resourceManager" })}
              />
              <KpiCard
                title="Inactive employees"
                value={summary.inactive}
                onDrillDown={() => openList({ active: "false" })}
              />
            </KpiGrid>
            <SummaryCard title="Capacity summary">
              <ProgressSummary
                label="Average employee capacity"
                value={summary.averageCapacityPercent}
                detail={`${summary.totalCapacityPercent.toFixed(0)}% combined capacity across ${summary.totalActive} active employees`}
              />
            </SummaryCard>
          </>
        )}
      </DashboardLayout>
    </ContentContainer>
  );
};
