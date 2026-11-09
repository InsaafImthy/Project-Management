import * as React from "react";
import { screen } from "@testing-library/react";
import { ChartCard, SimpleBarChart } from "../components/composites";
import { PMO_FIELDS as F } from "../config/sharePointSchema";
import { resolveHomeRole } from "../features/home";
import type {
  IPmoImportBatch,
  IPmoProjectDocument,
  IPmoWorkItem,
} from "../models/domain";
import { parsePmoRoute, serializePmoRoute } from "../routing/pmoRoutes";
import {
  assertAllOrNothingImport,
  ExcelImportService,
  type IImportPreview,
} from "../services/domain/ExcelImportService";
import {
  canOpenProjectDocument,
  ProjectDocumentService,
} from "../services/domain/ProjectDocumentService";
import { ReportService } from "../services/domain/ReportService";
import type { IPmoResolvedUserContext } from "../services/domain/UserCapabilityService";
import { buildReportCsv, reportExportHeaderRows } from "../utils/reportExport";
import { renderWithPmoTheme } from "./renderWithPmoTheme";

const actor = (
  capabilities: readonly string[],
  roles: readonly string[] = [],
): IPmoResolvedUserContext => ({
  sharePointUserId: 7,
  displayName: "Test User",
  email: "test@example.com",
  loginName: "test@example.com",
  eligibility: {
    isProjectManager: capabilities.indexOf("projects.manage") >= 0,
    isQa: roles.indexOf("qa") >= 0,
    isApprover: false,
    isResourceManager: false,
  },
  securityRoles: new Set(roles) as IPmoResolvedUserContext["securityRoles"],
  capabilities: new Set(
    capabilities,
  ) as IPmoResolvedUserContext["capabilities"],
});

describe("Stage 12 dashboards, reports, documents, and import controls", () => {
  it("selects the correct role-aware home dashboard", () => {
    expect(
      resolveHomeRole({
        displayName: "Employee",
        email: "employee@example.com",
        securityRoles: ["employee"],
        capabilities: ["work.view-own"],
      }),
    ).toBe("employee");
    expect(
      resolveHomeRole({
        displayName: "Manager",
        email: "manager@example.com",
        securityRoles: ["projectManager"],
        capabilities: ["projects.manage"],
      }),
    ).toBe("manager");
    expect(
      resolveHomeRole({
        displayName: "QA",
        email: "qa@example.com",
        securityRoles: ["qa"],
        capabilities: ["quality.manage"],
      }),
    ).toBe("qa");
    expect(
      resolveHomeRole({
        displayName: "Executive",
        email: "executive@example.com",
        securityRoles: ["executive"],
        capabilities: ["portfolio.view"],
      }),
    ).toBe("portfolio");
  });

  it("preserves KPI drill-down filters in the shared query-string route", () => {
    const search = serializePmoRoute({
      view: "my-work",
      parameters: {},
      query: { view: "my-work", status: "Assigned", due: "week" },
    });
    const route = parsePmoRoute(search);
    expect(route.view).toBe("my-work");
    expect(route.query).toMatchObject({ status: "Assigned", due: "week" });
  });

  it("renders an accessible data equivalent with every chart", () => {
    renderWithPmoTheme(
      <ChartCard
        title="Projects by health"
        dataTableFallback={
          <table>
            <caption>Projects by health chart data</caption>
            <tbody>
              <tr>
                <th>Green</th>
                <td>3</td>
              </tr>
            </tbody>
          </table>
        }
      >
        <SimpleBarChart items={[{ label: "Green", value: 3 }]} />
      </ChartCard>,
    );
    expect(screen.getByRole("table").textContent).toContain("Green");
    expect(screen.getByRole("table").textContent).toContain("3");
  });

  it("includes report name, as-of date, filters, and confidentiality in CSV exports", () => {
    const metadata = {
      reportName: "Portfolio report",
      asOf: new Date("2026-11-09T10:00:00Z"),
      filters: { status: "Active", projectId: 12 },
      confidentiality: "Internal" as const,
    };
    expect(reportExportHeaderRows(metadata)).toEqual([
      ["Report", "Portfolio report"],
      ["As of", "2026-11-09T10:00:00.000Z"],
      ["Filters", "status=Active; projectId=12"],
      ["Confidentiality", "Internal"],
    ]);
    const csv = buildReportCsv(
      metadata,
      [
        {
          header: "Project",
          value: (row: { readonly name: string }) => row.name,
        },
      ],
      [{ name: "Alpha" }],
    );
    expect(csv).toContain('"Confidentiality","Internal"');
    expect(csv).toContain('"Project"');
  });

  it("blocks restricted financial reports before any financial repository query", async () => {
    const capabilities = {
      resolveCurrent: jest.fn().mockResolvedValue(actor(["projects.view"])),
    };
    const service = new ReportService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      capabilities as never,
    );
    await expect(service.run("financials", {})).rejects.toThrow(
      /restricted financial exports/i,
    );
  });

  it("passes project report filters to the indexed project repository path", async () => {
    const projects = {
      getPage: jest
        .fn()
        .mockResolvedValue({ items: [], continuation: undefined }),
    };
    const capabilities = {
      resolveCurrent: jest
        .fn()
        .mockResolvedValue(
          actor(["projects.view", "portfolio.view"], ["executive"]),
        ),
    };
    const service = new ReportService(
      projects as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      capabilities as never,
    );
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-30T00:00:00Z");
    await service.run("portfolio", {
      status: "Active",
      dateFrom: from,
      dateTo: to,
    });
    expect(projects.getPage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "Active",
        isActive: true,
        dateFrom: from,
        dateTo: to,
      }),
      undefined,
      100,
    );
  });

  it("writes the exact project document metadata and enforces restricted links", async () => {
    const uploaded: IPmoProjectDocument = {
      id: 8,
      etag: '"8"',
      fileName: "evidence.docx",
      serverRelativeUrl: "/docs/evidence.docx",
      projectCode: "PRJ-1",
      documentType: "Task Evidence",
      documentStatus: "Draft",
      confidentiality: "Internal",
    };
    const repository = { upload: jest.fn().mockResolvedValue(uploaded) };
    const capabilities = {
      resolveCurrent: jest
        .fn()
        .mockResolvedValue(
          actor(["projects.view", "projects.manage"], ["projectManager"]),
        ),
      getProjectMemberships: jest.fn().mockResolvedValue([]),
    };
    const service = new ProjectDocumentService(
      repository as never,
      capabilities as never,
      "/sites/pmo/PMO_ProjectDocuments",
    );
    const file = new File(["evidence"], "evidence.docx");
    await service.upload({
      projectId: 1,
      projectCode: "PRJ-1",
      file,
      documentType: "Task Evidence",
      documentStatus: "Draft",
      confidentiality: "Internal",
      workItemId: 42,
    });
    expect(repository.upload).toHaveBeenCalledWith(
      "/sites/pmo/PMO_ProjectDocuments",
      "evidence.docx",
      file,
      expect.objectContaining({
        [F.projectDocuments.ProjectCode]: "PRJ-1",
        [F.projectDocuments.DocumentType]: "Task Evidence",
        [F.projectDocuments.WorkItemId]: 42,
        [F.projectDocuments.DocumentStatus]: "Draft",
        [F.projectDocuments.Confidentiality]: "Internal",
      }),
    );
    expect(
      canOpenProjectDocument(actor(["work.view-own"], ["employee"]), {
        confidentiality: "Restricted",
      }),
    ).toBe(false);
    expect(
      canOpenProjectDocument(actor(["projects.manage"], ["projectManager"]), {
        confidentiality: "Restricted",
      }),
    ).toBe(true);
  });

  it("prevents confirmation when any import row has an error", () => {
    const preview: IImportPreview = {
      templateVersion: "1.0",
      rows: [
        {
          rowNumber: 2,
          importRowKey: "T-1",
          action: "Create Draft",
          title: "Task",
          warnings: [],
          errors: ["Assignee is invalid."],
        },
      ],
      validRows: 0,
      warningRows: 0,
      errorRows: 1,
      totalRows: 1,
      canConfirm: false,
    };
    expect(() => assertAllOrNothingImport(preview)).toThrow(
      /No work items were created/i,
    );
  });

  it("rechecks Import Row Key idempotency before creating any work item", async () => {
    const existing = {
      id: 99,
      etag: '"99"',
      importRowKey: "T-1",
    } as IPmoWorkItem;
    const client = { executeBatch: jest.fn() };
    const workItems = {
      getByProject: jest
        .fn()
        .mockResolvedValue({ items: [existing], continuation: undefined }),
    };
    const capabilities = {
      resolveCurrent: jest
        .fn()
        .mockResolvedValue(actor(["projects.manage"], ["projectManager"])),
    };
    const service = new ExcelImportService(
      client as never,
      { update: jest.fn() } as never,
      workItems as never,
      undefined as never,
      undefined as never,
      capabilities as never,
    );
    const batch = {
      id: 4,
      etag: '"4"',
      projectId: 1,
      importStatus: "Ready",
    } as IPmoImportBatch;
    const preview: IImportPreview = {
      templateVersion: "1.0",
      rows: [
        {
          rowNumber: 2,
          importRowKey: "T-1",
          action: "Create Draft",
          title: "Task",
          warnings: [],
          errors: [],
          values: { Title: "Task" },
        },
      ],
      validRows: 1,
      warningRows: 0,
      errorRows: 0,
      totalRows: 1,
      canConfirm: true,
    };
    await expect(service.confirm(batch, preview)).rejects.toThrow(
      /already exists/i,
    );
    expect(client.executeBatch).not.toHaveBeenCalled();
  });
});
