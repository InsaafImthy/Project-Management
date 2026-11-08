import * as React from "react";
import { screen } from "@testing-library/react";
import { PmoApplicationRoot } from "../components/PmoApplicationRoot";
import { PMO_LISTS, pmoEnvironment } from "../config/environment";
import { renderWithPmoTheme } from "./renderWithPmoTheme";

describe("PmoApplicationRoot", () => {
  it("renders the shared application shell without a business dashboard", () => {
    renderWithPmoTheme(
      <PmoApplicationRoot
        userDisplayName="Test User"
        userEmail="test.user@example.com"
      />,
    );

    expect(screen.getByRole("heading", { name: "PMO workspace" })).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Application navigation" }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("centralizes every provisioned list and library name", () => {
    expect(Object.keys(PMO_LISTS)).toHaveLength(18);
    expect(pmoEnvironment.siteRelativeUrl).toBe("/sites/ProjectManagementTool");
    expect(PMO_LISTS.projectDocuments).toBe("PMO_ProjectDocuments");
  });
});
