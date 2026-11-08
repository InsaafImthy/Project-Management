import * as React from "react";
import { ThemeProvider } from "@fluentui/react";
import { PmoApplicationProvider } from "../context/PmoApplicationContext";
import type { PmoApplicationStatus } from "../models/application";
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

export interface IPmoApplicationRootProps {
  readonly userDisplayName: string;
  readonly userEmail: string;
  readonly status?: PmoApplicationStatus;
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
          {showComponentGallery ? (
            <ComponentGallery />
          ) : (
            <PmoFoundationMessage />
          )}
        </AppShell>
      );
    case "error":
      throw new Error("An application rendering error was requested.");
  }
};

export const PmoApplicationRoot = ({
  userDisplayName,
  userEmail,
  status = "ready",
}: IPmoApplicationRootProps): React.ReactElement => {
  const showComponentGallery =
    typeof DEBUG !== "undefined" &&
    DEBUG &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("pmoGallery") === "true";

  return (
    <ThemeProvider theme={pmoTheme}>
      <PmoApplicationProvider
        currentUser={{
          displayName: userDisplayName,
          email: userEmail,
          capabilities: [],
        }}
      >
        <PmoErrorBoundary>
          <PmoApplicationContent
            status={status}
            showComponentGallery={showComponentGallery}
          />
        </PmoErrorBoundary>
      </PmoApplicationProvider>
    </ThemeProvider>
  );
};
