import { PMO_FIELDS as F } from "../config/sharePointSchema";
import type {
  IPmoProject,
  IPmoProjectStatusReport,
  IPmoQualityItem,
  IPmoRiskIssue,
} from "../models/domain";
import { ClosureReadinessService } from "../services/domain/ClosureReadinessService";
import { ProjectStatusReportService } from "../services/domain/ProjectStatusReportService";
import {
  QualityGovernanceService,
  validateQualityItem,
} from "../services/domain/QualityGovernanceService";
import {
  RiskManagementService,
  validateRiskIssue,
} from "../services/domain/RiskManagementService";

const actor = {
  sharePointUserId: 9,
  displayName: "QA User",
  email: "qa@example.com",
  loginName: "qa@example.com",
  eligibility: {
    isProjectManager: true,
    isQa: true,
    isApprover: true,
    isResourceManager: false,
  },
  securityRoles: new Set(["qa", "projectManager", "approver"]),
  capabilities: new Set([
    "quality.view",
    "quality.manage",
    "projects.view",
    "projects.manage",
    "approvals.decide",
  ]),
};
const capabilities = {
  resolveCurrent: async () => actor,
};

const qualityItem = (
  overrides: Partial<IPmoQualityItem> = {},
): IPmoQualityItem => ({
  id: 4,
  etag: '"quality-1"',
  title: "Authentication defect",
  qualityNumber: "QUA-2026-00004",
  qualityType: "Defect",
  projectId: 2,
  projectCode: "PRJ-2026-00002",
  workItemId: 7,
  status: "Ready for Retest",
  testResult: "Fail",
  severity: "High",
  priority: "High",
  description: "Login fails under load.",
  assignedTo: { id: 11, displayName: "Developer" },
  raisedBy: { id: 9, displayName: "QA User" },
  raisedOn: new Date("2026-11-01T00:00:00Z"),
  isReleaseBlocking: true,
  ...overrides,
});

const riskItem = (overrides: Partial<IPmoRiskIssue> = {}): IPmoRiskIssue => ({
  id: 5,
  etag: '"risk-1"',
  title: "Vendor dependency",
  recordNumber: "RSK-2026-00005",
  recordType: "Risk",
  projectId: 2,
  projectCode: "PRJ-2026-00002",
  severity: "High",
  probability: "High",
  description: "Vendor delivery may be late.",
  impact: "Release date may move.",
  owner: { id: 12, displayName: "Owner" },
  raisedBy: { id: 9, displayName: "QA User" },
  raisedOn: new Date("2026-11-01T00:00:00Z"),
  status: "Open",
  isEscalated: false,
  ...overrides,
});

describe("Stage 10 quality and governance rules", () => {
  it("applies conditional quality validation for failed tests and production defects", () => {
    const failed = validateQualityItem({
      title: "Failed acceptance",
      qualityType: "Test Result",
      projectId: 2,
      description: "Expected output differs.",
      testResult: "Fail",
      isReleaseBlocking: true,
    });
    expect(failed.workItemId).toBeDefined();
    expect(failed.evidenceLink).toBeDefined();

    const production = validateQualityItem({
      title: "Production outage",
      qualityType: "Production Defect",
      projectId: 2,
      workItemId: 7,
      description: "Service unavailable.",
      severity: "Critical",
      isReleaseBlocking: true,
    });
    expect(production.customerImpact).toBeDefined();
  });

  it("records retest without changing the original failed test result", async () => {
    const updates: Record<string, unknown>[] = [];
    const item = qualityItem();
    const repository = {
      update: async (
        _id: number,
        values: Readonly<Record<string, unknown>>,
      ): Promise<IPmoQualityItem> => {
        updates.push({ ...values });
        return {
          ...item,
          status: values[F.qualityItems.Status] as IPmoQualityItem["status"],
          retestResult: values[
            F.qualityItems.RetestResult
          ] as IPmoQualityItem["retestResult"],
        };
      },
    };
    const service = new QualityGovernanceService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      capabilities as never,
      () => new Date("2026-11-09T10:00:00Z"),
    );
    const retested = await service.recordRetest(item, "Pass");
    expect(retested.status).toBe("Closed");
    expect(item.testResult).toBe("Fail");
    expect(updates[0]?.[F.qualityItems.TestResult]).toBeUndefined();
    expect(updates[0]?.[F.qualityItems.RetestResult]).toBe("Pass");
  });

  it("enforces risk probability and governed resolution transitions", async () => {
    expect(
      validateRiskIssue({
        title: "Risk",
        recordType: "Risk",
        projectId: 2,
        severity: "High",
        description: "Description",
        impact: "Impact",
        owner: { id: 12, displayName: "Owner" },
      }).probability,
    ).toBeDefined();
    const writes: Record<string, unknown>[] = [];
    const risk = riskItem();
    const service = new RiskManagementService(
      {
        update: async (
          _id: number,
          values: Readonly<Record<string, unknown>>,
        ) => {
          writes.push({ ...values });
          return {
            ...risk,
            status: values[F.risksIssues.Status] as IPmoRiskIssue["status"],
          };
        },
      } as never,
      {} as never,
      capabilities as never,
      () => new Date("2026-11-09T10:00:00Z"),
    );
    await expect(service.transition(risk, "Closed", "Done")).rejects.toThrow(
      /Cannot move/,
    );
    await expect(service.transition(risk, "Resolved")).rejects.toThrow(
      /requires resolution/,
    );
    const resolved = await service.transition(
      risk,
      "Resolved",
      "Vendor confirmed.",
    );
    expect(resolved.status).toBe("Resolved");
    expect(writes[0]?.[F.risksIssues.Resolution]).toBe("Vendor confirmed.");
  });
});

describe("Stage 10 status snapshots and closure readiness", () => {
  const project = {
    id: 2,
    projectCode: "PRJ-2026-00002",
    title: "Migration",
    percentComplete: 25,
    overallHealth: "Amber",
    currentApprovedEnd: new Date("2026-12-20T00:00:00Z"),
    approvedEffortHours: 100,
    forecastEffortHours: 120,
  } as IPmoProject;

  it("prepopulates operational metrics but leaves narrative blank and immutable", async () => {
    let createValues: Readonly<Record<string, unknown>> | undefined;
    const created = {
      id: 20,
      etag: '"report-1"',
      title: "Status",
      projectId: 2,
      projectCode: project.projectCode,
      reportingDate: new Date("2026-11-09T00:00:00Z"),
      periodStart: new Date("2026-11-09T00:00:00Z"),
      periodEnd: new Date("2026-11-15T00:00:00Z"),
      overallStatus: "Amber",
      percentComplete: 50,
      highlights: "Delivered migration wave.",
      risksIssuesSummary: "Vendor delay monitored.",
      nextSteps: "Complete validation.",
      reportStatus: "Draft",
    } as IPmoProjectStatusReport;
    const service = new ProjectStatusReportService(
      {
        create: async (values: Readonly<Record<string, unknown>>) => {
          createValues = values;
          return created;
        },
      } as never,
      { getById: async () => project } as never,
      {
        getByProject: async () => ({
          items: [
            { itemType: "Task", percentComplete: 40 },
            { itemType: "Task", percentComplete: 60 },
          ],
        }),
      } as never,
      capabilities as never,
      () => new Date("2026-11-09T10:00:00Z"),
    );
    const prepared = await service.prepareCurrentPeriod(2);
    expect(prepared.percentComplete).toBe(50);
    expect(prepared.forecastEffortHours).toBe(120);
    expect(prepared.highlights).toBe("");
    expect(prepared.risksIssuesSummary).toBe("");
    const saved = await service.saveDraft({
      ...prepared,
      highlights: "Delivered migration wave.",
      risksIssuesSummary: "Vendor delay monitored.",
      nextSteps: "Complete validation.",
    });
    expect(saved).toBe(created);
    expect(createValues?.[F.projectStatusReports.PercentComplete]).toBe(50);
    expect(createValues?.[F.projectStatusReports.ForecastEffortHours]).toBe(
      120,
    );
    await expect(
      service.saveDraft(
        {
          ...prepared,
          highlights: "Changed",
          risksIssuesSummary: "Changed",
          nextSteps: "Changed",
        },
        { ...created, reportStatus: "Approved" },
      ),
    ).rejects.toThrow(/immutable/);
  });

  it("blocks closure for mandatory open records and treats approved exceptions as non-blocking", async () => {
    const service = new ClosureReadinessService(
      {
        getByProject: async () => ({
          items: [
            {
              isActive: true,
              itemType: "Task",
              status: "In Progress",
              percentComplete: 50,
            },
          ],
        }),
      } as never,
      {
        getByProject: async () => ({
          items: [{ entryStatus: "Submitted" }],
        }),
      } as never,
      {
        getByProject: async () => ({
          items: [
            qualityItem({
              qualityType: "Release Exception",
              status: "Approved Exception",
            }),
          ],
        }),
      } as never,
      {
        getByProject: async () => ({ items: [] }),
      } as never,
      {
        getOpenByProject: async () => ({
          items: [riskItem({ severity: "Critical" })],
        }),
      } as never,
      {
        getByProject: async () => ({ items: [] }),
      } as never,
      () => new Date("2026-11-09T10:00:00Z"),
    );
    const result = await service.check(2, {
      requireApprovedStatusReport: true,
    });
    expect(result.ready).toBe(false);
    expect(result.blockingItems.map((item) => item.category)).toEqual(
      expect.arrayContaining(["tasks", "time", "risks", "statusEvidence"]),
    );
    expect(
      result.blockingItems.some((item) => item.category === "quality"),
    ).toBe(false);
    expect(
      result.nonBlockingItems.some((item) => item.category === "quality"),
    ).toBe(true);
  });
});
