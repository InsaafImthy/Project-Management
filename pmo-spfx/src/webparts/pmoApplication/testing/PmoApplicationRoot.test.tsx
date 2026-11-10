jest.mock("@microsoft/sp-http", () => ({
  SPHttpClient: { configurations: { v1: {} } },
}));

import * as React from "react";
import { screen } from "@testing-library/react";
import { PmoApplicationRoot } from "../components/PmoApplicationRoot";
import { PMO_LISTS, pmoEnvironment } from "../config/environment";
import { renderWithPmoTheme } from "./renderWithPmoTheme";
import { SharePointError } from "../services/sharepoint/SharePointError";
import type { ISharePointClient } from "../services/sharepoint/SharePointClient";

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

  it("preserves and displays a sanitized bootstrap failure", async () => {
    const failure = new SharePointError(
      "The query to field 'Author' is not valid.",
      400,
      "corr-bootstrap",
      "validation",
      "-1, Microsoft.SharePoint.SPException",
      "GET",
      "https://aufaitcloud.sharepoint.com/sites/ProjectManagementTool/_api/web/lists/getbytitle('PMO_Employees')/items?$filter=Email",
    );
    const client = {
      getJson: jest.fn().mockRejectedValue(failure),
      query: jest.fn(),
    } as unknown as ISharePointClient;

    renderWithPmoTheme(
      <PmoApplicationRoot
        userDisplayName="Test User"
        userEmail="test.user@example.com"
        sharePointClient={client}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "The application could not be displayed",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /query to field 'Author'.*HTTP 400|HTTP 400.*query to field 'Author'/i,
      ),
    ).toBeTruthy();
  });
});
