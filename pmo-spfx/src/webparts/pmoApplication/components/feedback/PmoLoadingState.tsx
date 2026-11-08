import * as React from "react";
import { Spinner, SpinnerSize } from "@fluentui/react";

export const PmoLoadingState = (): React.ReactElement => (
  <Spinner label="Loading the PMO application" size={SpinnerSize.medium} />
);
