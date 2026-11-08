import * as React from "react";
import {
  DashboardLayout,
  DashboardSection,
  KpiCard,
  KpiGrid,
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
import { PMO_KNOWN_SETTINGS } from "../../../validation/configuration";
import { useSettingsDashboard } from "../hooks/useSettings";
import { SETTINGS_ROUTES } from "../routes";

export const SettingsDashboardPage = (): React.ReactElement => {
  const { settings } = usePmoServices();
  const { navigate } = usePmoRoute();
  const dashboard = useSettingsDashboard(settings);
  const openList = (query: Readonly<Record<string, string>> = {}): void => {
    navigate({
      view: SETTINGS_ROUTES.list,
      parameters: {},
      query: { view: SETTINGS_ROUTES.list, ...query },
    });
  };
  const categoryCount = new Set(
    dashboard.settings.map((setting) => setting.category),
  ).size;
  const knownCount = dashboard.settings.filter(
    (setting) => PMO_KNOWN_SETTINGS[setting.key],
  ).length;
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="Settings"
          subtitle="Maintain validated application configuration without changing code."
          breadcrumbs={[{ text: "Administration" }, { text: "Settings" }]}
          commands={
            <AppButton text="View settings" onClick={() => openList()} />
          }
        />
        {dashboard.loading ? (
          <LoadingSkeleton label="Loading settings dashboard" />
        ) : dashboard.error ? (
          <ErrorState message={dashboard.error} />
        ) : (
          <>
            <KpiGrid>
              <KpiCard
                title="Active settings"
                value={dashboard.settings.length}
                helpText="Configuration values currently available to the application"
                onDrillDown={() => openList({ active: "true" })}
              />
              <KpiCard
                title="Categories"
                value={categoryCount}
                helpText="Active configuration categories"
                onDrillDown={() => openList()}
              />
              <KpiCard
                title="Known keys"
                value={`${knownCount}/${Object.keys(PMO_KNOWN_SETTINGS).length}`}
                helpText="Required typed keys currently configured"
                onDrillDown={() => openList({ active: "true" })}
              />
            </KpiGrid>
            <DashboardSection title="Configuration governance">
              <SummaryCard title="Validated settings">
                <p>
                  Hours, percentages, escalation periods, currency, reminder
                  time, and import version values are checked before saving.
                  Changes invalidate the shared configuration cache immediately.
                </p>
              </SummaryCard>
            </DashboardSection>
          </>
        )}
      </DashboardLayout>
    </ContentContainer>
  );
};
