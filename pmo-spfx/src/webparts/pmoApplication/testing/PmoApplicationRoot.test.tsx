import * as React from "react";
import { screen } from "@testing-library/react";
import { PmoApplicationRoot } from "../components/PmoApplicationRoot";
import { PMO_LISTS, pmoEnvironment } from "../config/environment";
import { renderWithPmoTheme } from "./renderWithPmoTheme";

describe("PmoApplicationRoot", () => {
  it("renders the foundation state without a business dashboard", () => {
    renderWithPmoTheme(<PmoApplicationRoot userDisplayName="Test User" />);

    expect(
      screen.getByRole("heading", { name: "PMO application foundation" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("centralizes every provisioned list and library name", () => {
    expect(Object.keys(PMO_LISTS)).toHaveLength(18);
    expect(pmoEnvironment.siteRelativeUrl).toBe("/sites/ProjectManagementTool");
    expect(PMO_LISTS.projectDocuments).toBe("PMO_ProjectDocuments");
  });
});
