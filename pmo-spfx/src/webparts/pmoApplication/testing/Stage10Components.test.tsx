import * as React from "react";
import { screen } from "@testing-library/react";
import { PmoServicesContext } from "../context/PmoServicesContext";
import { QualityItemForm } from "../features/quality";
import { QualityDashboardPage } from "../features/quality/pages/QualityPages";
import { RiskIssueForm } from "../features/risks";
import { RiskDashboardPage } from "../features/risks/pages/RiskPages";
import { StatusReportEditorPage } from "../features/statusReports/pages/StatusReportPages";
import { PmoRouteProvider } from "../routing/pmoRoutes";
import type { IPmoFeatureServices } from "../context/PmoServicesContext";
import { renderWithPmoTheme } from "./renderWithPmoTheme";

const wrap = (
  ui: React.ReactElement,
  services: Partial<IPmoFeatureServices> = {},
): React.ReactElement => (
  <PmoServicesContext.Provider value={services as IPmoFeatureServices}>
    <PmoRouteProvider>{ui}</PmoRouteProvider>
  </PmoServicesContext.Provider>
);

describe("Stage 10 feature components", () => {
  it("adapts the common quality form for failed tests and production defects", () => {
    const { rerender } = renderWithPmoTheme(
      <QualityItemForm
        draft={{
          title: "Acceptance result",
          qualityType: "Test Result",
          projectId: 4,
          workItemId: 8,
          description: "Acceptance output differs.",
          testResult: "Fail",
          isReleaseBlocking: true,
        }}
        errors={{ evidenceLink: "Evidence is required." }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Result")).toBeTruthy();
    const evidenceInput = screen
      .getByText("Evidence link")
      .parentElement?.querySelector("input") as HTMLInputElement;
    expect(evidenceInput.required).toBe(true);
    expect(screen.getByText("Evidence is required.")).toBeTruthy();

    rerender(
      <QualityItemForm
        draft={{
          title: "Production escape",
          qualityType: "Production Defect",
          projectId: 4,
          workItemId: 8,
          description: "Failure after release.",
          severity: "Critical",
          isReleaseBlocking: true,
        }}
        onChange={() => undefined}
      />,
    );
    const impactInput = screen
      .getByText("Customer impact and service effect")
      .parentElement?.querySelector("textarea") as HTMLTextAreaElement;
    expect(impactInput.required).toBe(true);
    expect(screen.getByText("Root cause")).toBeTruthy();
  });

  it("shows probability only for the Risk form variant", () => {
    const { rerender } = renderWithPmoTheme(
      <RiskIssueForm
        draft={{
          title: "Schedule risk",
          recordType: "Risk",
          projectId: 4,
          severity: "High",
          probability: "High",
          description: "Dependency may slip.",
          impact: "Release delay.",
          owner: { id: 2, displayName: "Owner" },
        }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Probability")).toBeTruthy();
    rerender(
      <RiskIssueForm
        draft={{
          title: "Active issue",
          recordType: "Issue",
          projectId: 4,
          severity: "High",
          description: "Dependency slipped.",
          impact: "Release delay.",
          owner: { id: 2, displayName: "Owner" },
        }}
        onChange={() => undefined}
      />,
    );
    expect(screen.queryByLabelText("Probability")).toBeNull();
  });

  it("renders shared KPI dashboards for quality and risk queues", async () => {
    const quality = {
      dashboard: async () => ({
        awaitingAction: 2,
        failedTests: 1,
        openDefectsBySeverity: { Low: 0, Medium: 1, High: 2, Critical: 1 },
        releaseBlocking: 2,
        readyForRetest: 3,
        productionDefects: 1,
        exceptionsAwaitingApproval: 1,
        critical: 1,
        overdue: 2,
        asOf: new Date("2026-11-09T10:00:00Z"),
      }),
    };
    const risks = {
      list: async () => ({
        items: [
          {
            recordType: "Risk",
            severity: "Critical",
            isEscalated: true,
            status: "Open",
          },
          {
            recordType: "Blocker",
            severity: "High",
            isEscalated: false,
            status: "Open",
          },
        ],
      }),
    };
    const rendered = renderWithPmoTheme(
      wrap(<QualityDashboardPage />, { quality: quality as never }),
    );
    expect(await screen.findByText("QA awaiting action")).toBeTruthy();
    expect(screen.getByText("Ready for retest")).toBeTruthy();
    rendered.unmount();

    renderWithPmoTheme(wrap(<RiskDashboardPage />, { risks: risks as never }));
    expect(await screen.findByText("Open risks")).toBeTruthy();
    expect(screen.getByText("Open blockers")).toBeTruthy();
  });

  it("prepares the status report editor with blank narrative", async () => {
    window.history.replaceState(
      {},
      "",
      "?view=status-report-editor&projectId=4",
    );
    const statusReports = {
      prepareCurrentPeriod: async () => ({
        projectId: 4,
        projectCode: "PRJ-2026-00004",
        title: "PRJ-2026-00004 status 2026-11-15",
        reportingDate: "2026-11-09",
        periodStart: "2026-11-09",
        periodEnd: "2026-11-15",
        overallStatus: "Amber",
        percentComplete: 45,
        forecastEnd: "2026-12-20",
        forecastEffortHours: 120,
        highlights: "",
        risksIssuesSummary: "",
        decisionsRequired: "",
        nextSteps: "",
      }),
    };
    renderWithPmoTheme(
      wrap(<StatusReportEditorPage />, {
        statusReports: statusReports as never,
      }),
    );
    const highlightsLabel = await screen.findByText("Highlights");
    const highlights = highlightsLabel.parentElement?.querySelector(
      "textarea",
    ) as HTMLTextAreaElement;
    const percent = screen
      .getByText("Percent complete")
      .parentElement?.querySelector("input") as HTMLInputElement;
    expect(highlights.value).toBe("");
    expect(percent.value).toBe("45");
    expect(screen.getByText(/without fabricating facts/i)).toBeTruthy();
  });
});
