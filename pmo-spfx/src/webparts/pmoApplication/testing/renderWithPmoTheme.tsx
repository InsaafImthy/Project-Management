import * as React from "react";
import { render, type RenderResult } from "@testing-library/react";
import { ThemeProvider } from "@fluentui/react";
import { initializePmoIcons } from "../theme/initializePmoIcons";
import { pmoTheme } from "../theme/pmoTheme";

export const renderWithPmoTheme = (ui: React.ReactElement): RenderResult => {
  initializePmoIcons();
  return render(<ThemeProvider theme={pmoTheme}>{ui}</ThemeProvider>);
};
