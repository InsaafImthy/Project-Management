import * as React from "react";
import { render, type RenderResult } from "@testing-library/react";
import { ThemeProvider } from "@fluentui/react";
import { pmoTheme } from "../theme/pmoTheme";

export const renderWithPmoTheme = (ui: React.ReactElement): RenderResult =>
  render(<ThemeProvider theme={pmoTheme}>{ui}</ThemeProvider>);
