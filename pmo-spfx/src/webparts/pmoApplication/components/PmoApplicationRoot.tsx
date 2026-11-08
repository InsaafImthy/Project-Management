import * as React from "react";
import { Stack, Text, ThemeProvider } from "@fluentui/react";
import { PmoApplicationProvider } from "../context/PmoApplicationContext";
import type { PmoApplicationStatus } from "../models/application";
import { pmoTheme } from "../theme/pmoTheme";
import { PmoAccessDeniedState } from "./feedback/PmoAccessDeniedState";
import { PmoErrorBoundary } from "./feedback/PmoErrorBoundary";
import { PmoLoadingState } from "./feedback/PmoLoadingState";

export interface IPmoApplicationRootProps {
  readonly userDisplayName: string;
  readonly status?: PmoApplicationStatus;
}

const PmoFoundationMessage = (): React.ReactElement => (
  <Stack tokens={{ childrenGap: 8 }}>
    <Text as="h1" variant="xLarge">
      PMO application foundation
    </Text>
    <Text>
      Stage 01 is ready. Feature modules will be introduced in subsequent
      stages.
    </Text>
  </Stack>
);

const PmoApplicationContent = ({
  status,
}: {
  readonly status: PmoApplicationStatus;
}): React.ReactElement => {
  switch (status) {
    case "loading":
      return <PmoLoadingState />;
    case "accessDenied":
      return <PmoAccessDeniedState />;
    case "ready":
      return <PmoFoundationMessage />;
    case "error":
      throw new Error("An application rendering error was requested.");
  }
};

export const PmoApplicationRoot = ({
  userDisplayName,
  status = "ready",
}: IPmoApplicationRootProps): React.ReactElement => {
  return (
    <ThemeProvider theme={pmoTheme}>
      <PmoApplicationProvider currentUser={{ displayName: userDisplayName }}>
        <PmoErrorBoundary>
          <PmoApplicationContent status={status} />
        </PmoErrorBoundary>
      </PmoApplicationProvider>
    </ThemeProvider>
  );
};
