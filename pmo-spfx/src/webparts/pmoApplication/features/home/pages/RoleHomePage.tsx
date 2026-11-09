import * as React from "react";
import {
  ChartCard,
  DashboardLayout,
  DashboardSection,
  DataTable,
  KpiCard,
  KpiGrid,
  SimpleBarChart,
  SummaryCard,
  type IDataTableColumn,
  type ISimpleBarChartItem,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  DateDisplay,
  HoursDisplay,
  LoadingSkeleton,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import type { IPmoProject } from "../../../models/domain";
import type { IPmoCurrentUser } from "../../../models/application";
import { usePmoRoute } from "../../../routing/pmoRoutes";

interface IChartRow {
  readonly label: string;
  readonly value: number;
}

const ChartEquivalent = ({
  label,
  items,
}: {
  readonly label: string;
  readonly items: readonly ISimpleBarChartItem[];
}): React.ReactElement => {
  const rows = items.map((item) => ({ label: item.label, value: item.value }));
  const columns: readonly IDataTableColumn<IChartRow>[] = [
    { key: "category", header: "Category", render: (row) => row.label },
    {
      key: "value",
      header: "Value",
      render: (row) => row.value,
      align: "right",
    },
  ];
  return (
    <DataTable
      ariaLabel={`${label} accessible data`}
      items={rows}
      columns={columns}
      getRowKey={(row) => row.label}
      paging={{ pageIndex: 0, pageSize: 10, totalItems: rows.length }}
      onPageChange={() => undefined}
      caption={`${label} chart data`}
    />
  );
};

const HomeChart = ({
  title,
  items,
  helpText,
}: {
  readonly title: string;
  readonly items: readonly ISimpleBarChartItem[];
  readonly helpText?: string;
}): React.ReactElement => (
  <ChartCard
    title={title}
    helpText={helpText}
    empty={items.every((item) => item.value === 0)}
    dataTableFallback={<ChartEquivalent label={title} items={items} />}
  >
    <SimpleBarChart items={items} />
  </ChartCard>
);

const PortfolioDateTable = ({
  projects,
}: {
  readonly projects: readonly IPmoProject[];
}): React.ReactElement => {
  const columns: readonly IDataTableColumn<IPmoProject>[] = [
    {
      key: "project",
      header: "Project",
      render: (project) => project.projectCode ?? project.title,
    },
    {
      key: "baseline",
      header: "Baseline end",
      render: (project) => <DateDisplay value={project.baselineEnd} />,
    },
    {
      key: "approved",
      header: "Current approved end",
      render: (project) => <DateDisplay value={project.currentApprovedEnd} />,
    },
    {
      key: "forecast",
      header: "Forecast end",
      render: (project) => (
        <DateDisplay
          value={project.forecastEnd ?? project.currentApprovedEnd}
        />
      ),
    },
  ];
  return (
    <DataTable
      ariaLabel="Baseline, approved, and forecast project dates"
      items={projects.slice(0, 50)}
      columns={columns}
      getRowKey={(project) => String(project.id)}
      paging={{
        pageIndex: 0,
        pageSize: 50,
        totalItems: Math.min(projects.length, 50),
      }}
      onPageChange={() => undefined}
      caption="Baseline versus current approved and forecast dates"
    />
  );
};

const count = (
  projects: readonly IPmoProject[],
  key: "status" | "overallHealth",
  value: string,
) => projects.filter((project) => project[key] === value).length;

const portfolioCharts = (projects: readonly IPmoProject[]) => ({
  health: ["Green", "Amber", "Red", "Not Set"].map((label) => ({
    label,
    value: count(projects, "overallHealth", label),
  })),
  status: [
    "Draft",
    "Pending Baseline Approval",
    "Approved",
    "Active",
    "On Hold",
    "Pending Closure",
  ].map((label) => ({ label, value: count(projects, "status", label) })),
  effort: [
    {
      label: "Baseline",
      value: projects.reduce(
        (sum, project) => sum + project.baselineEffortHours,
        0,
      ),
    },
    {
      label: "Approved",
      value: projects.reduce(
        (sum, project) => sum + project.approvedEffortHours,
        0,
      ),
    },
    {
      label: "Actual",
      value: projects.reduce(
        (sum, project) => sum + project.actualEffortHours,
        0,
      ),
    },
    {
      label: "Forecast",
      value: projects.reduce(
        (sum, project) =>
          sum + (project.forecastEffortHours ?? project.approvedEffortHours),
        0,
      ),
    },
  ],
});

export type PmoHomeRole = "employee" | "manager" | "qa" | "portfolio";

export const resolveHomeRole = (user: IPmoCurrentUser): PmoHomeRole => {
  const roles = new Set(user.securityRoles ?? []);
  if (
    roles.has("owner") ||
    roles.has("executive") ||
    user.capabilities.indexOf("portfolio.view") >= 0
  )
    return "portfolio";
  if (roles.has("qa") && !roles.has("projectManager")) return "qa";
  if (
    roles.has("projectManager") &&
    user.capabilities.indexOf("projects.manage") >= 0
  )
    return "manager";
  return "employee";
};

export const RoleHomePage = (): React.ReactElement => {
  const services = usePmoServices();
  const interactions = usePmoInteractions();
  const user = usePmoCurrentUser();
  const { navigate } = usePmoRoute();
  const role = resolveHomeRole(user);
  const [actions, setActions] =
    React.useState<
      Awaited<ReturnType<typeof services.actionCenter.getActions>>
    >();
  const [time, setTime] =
    React.useState<Awaited<ReturnType<typeof services.time.dashboard>>>();
  const [learningCount, setLearningCount] = React.useState(0);
  const [requestCount, setRequestCount] = React.useState(0);
  const [projects, setProjects] = React.useState<readonly IPmoProject[]>([]);
  const [quality, setQuality] =
    React.useState<Awaited<ReturnType<typeof services.quality.dashboard>>>();
  const [resources, setResources] =
    React.useState<Awaited<ReturnType<typeof services.resources.dashboard>>>();
  const [finance, setFinance] =
    React.useState<Awaited<ReturnType<typeof services.finance.dashboard>>>();
  const [criticalRiskCount, setCriticalRiskCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshProgress, setRefreshProgress] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    const requests: Promise<void>[] = [
      services.actionCenter
        .getActions()
        .then((result) => {
          if (active) setActions(result);
        })
        .catch(() => undefined),
    ];
    if (role === "employee") {
      requests.push(
        services.time
          .dashboard()
          .then((result) => {
            if (active) setTime(result);
          })
          .catch(() => undefined),
        services.learning
          .mine()
          .then((items) => {
            if (active)
              setLearningCount(
                items.filter(
                  (item) =>
                    ["Assigned", "In Progress", "Submitted"].indexOf(
                      item.status,
                    ) >= 0,
                ).length,
              );
          })
          .catch(() => undefined),
        services.changes
          .dashboard()
          .then((result) => {
            if (active)
              setRequestCount(
                result.myDrafts +
                  result.mySubmitted +
                  result.clarificationRequested,
              );
          })
          .catch(() => undefined),
      );
    }
    if (role === "manager") {
      requests.push(
        services.projects
          .getManagedProjects()
          .then((items) => {
            if (active) setProjects(items);
          })
          .catch(() => undefined),
        services.quality
          .dashboard()
          .then((result) => {
            if (active) setQuality(result);
          })
          .catch(() => undefined),
        services.risks
          .list({ severity: "Critical", openOnly: true })
          .then((page) => {
            if (active) setCriticalRiskCount(page.items.length);
          })
          .catch(() => undefined),
        services.changes
          .dashboard()
          .then((result) => {
            if (active)
              setRequestCount(
                result.projectVariationsAwaitingPmo + result.pendingMyApproval,
              );
          })
          .catch(() => undefined),
      );
    }
    if (role === "qa") {
      requests.push(
        services.quality
          .dashboard()
          .then((result) => {
            if (active) setQuality(result);
          })
          .catch(() => undefined),
      );
    }
    if (role === "portfolio") {
      const start = new Date();
      const end = new Date(start.valueOf() + 30 * 86400000);
      requests.push(
        services.projects
          .list({ isActive: true }, undefined, 100)
          .then((page) => {
            if (active) setProjects(page.items);
          })
          .catch(() => undefined),
        services.quality
          .dashboard()
          .then((result) => {
            if (active) setQuality(result);
          })
          .catch(() => undefined),
        services.resources
          .dashboard(start, end)
          .then((result) => {
            if (active) setResources(result);
          })
          .catch(() => undefined),
        services.risks
          .list({ severity: "Critical", openOnly: true })
          .then((page) => {
            if (active) setCriticalRiskCount(page.items.length);
          })
          .catch(() => undefined),
      );
      if (user.capabilities.indexOf("finance.view") >= 0) {
        requests.push(
          services.finance
            .dashboard()
            .then((result) => {
              if (active) setFinance(result);
            })
            .catch(() => undefined),
        );
      }
    }
    void Promise.all(requests).then(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [role, services, user.capabilities]);

  const drill = (view: string, query: Readonly<Record<string, string>> = {}) =>
    navigate({ view, parameters: {}, query: { view, ...query } });
  const refreshPortfolio = async (): Promise<void> => {
    setRefreshing(true);
    setRefreshProgress(0);
    try {
      await services.metrics.refreshPortfolio(
        projects.map((project) => project.id),
        user.capabilities.indexOf("finance.view") >= 0,
        (completed, total) =>
          setRefreshProgress(
            total ? Math.round((completed / total) * 100) : 100,
          ),
      );
      interactions.publishMessage({
        tone: "success",
        text: "Portfolio metrics refreshed.",
      });
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text:
          error instanceof Error ? error.message : "Portfolio refresh failed.",
      });
    } finally {
      setRefreshing(false);
    }
  };
  if (loading || !actions) {
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading role dashboard" />
      </ContentContainer>
    );
  }
  if (role === "employee") {
    const taskStatus = [
      {
        label: "Awaiting acceptance",
        value: actions.counts.awaitingAcceptance,
      },
      { label: "Due this week", value: actions.counts.dueSoon },
      { label: "Overdue", value: actions.counts.overdue },
      { label: "Blocked", value: actions.counts.blocked },
      { label: "Returned", value: actions.counts.returned },
    ];
    return (
      <ContentContainer>
        <DashboardLayout>
          <PageHeader
            title="Employee home"
            subtitle="Today's accountability, assigned work, requests, learning, and failed actions."
            breadcrumbs={[{ text: "Home" }]}
          />
          <KpiGrid>
            <KpiCard
              title="Required today"
              value={
                <HoursDisplay
                  value={
                    time?.requiredHours ??
                    actions.incompleteWorkday?.requiredHours ??
                    0
                  }
                />
              }
              onDrillDown={() => drill("my-time")}
            />
            <KpiCard
              title="Recorded today"
              value={
                <HoursDisplay
                  value={
                    time?.recordedHours ??
                    actions.incompleteWorkday?.recordedHours ??
                    0
                  }
                />
              }
              onDrillDown={() => drill("my-time")}
            />
            <KpiCard
              title="Awaiting acceptance"
              value={actions.counts.awaitingAcceptance}
              onDrillDown={() => drill("my-work", { status: "Assigned" })}
            />
            <KpiCard
              title="Due today or this week"
              value={actions.counts.dueSoon}
              onDrillDown={() => drill("my-work", { due: "week" })}
            />
            <KpiCard
              title="Blocked or returned"
              value={actions.counts.blocked + actions.counts.returned}
              onDrillDown={() =>
                drill("my-work", { attention: "blocked-returned" })
              }
            />
            <KpiCard
              title="Pending requests"
              value={requestCount}
              onDrillDown={() =>
                drill("change-requests", { filter: "pending" })
              }
            />
            <KpiCard
              title="Active learning"
              value={learningCount}
              onDrillDown={() => drill("my-learning", { status: "active" })}
            />
            <KpiCard
              title="Incomplete time"
              value={actions.counts.incompleteWorkday}
              onDrillDown={() => drill("my-time", { filter: "incomplete" })}
            />
            <KpiCard
              title="Failed actions"
              value={actions.counts.failedTaskActions}
              onDrillDown={() => drill("my-work", { actionStatus: "Failed" })}
            />
          </KpiGrid>
          <HomeChart title="Tasks by status" items={taskStatus} />
        </DashboardLayout>
      </ContentContainer>
    );
  }
  if (role === "qa") {
    const severity = Object.keys(quality?.openDefectsBySeverity ?? {}).map(
      (label) => ({
        label,
        value: quality?.openDefectsBySeverity[label] ?? 0,
      }),
    );
    return (
      <ContentContainer>
        <DashboardLayout>
          <PageHeader
            title="QA home"
            subtitle="QA queue, failed tests, retests, release blockers, and exceptions."
            breadcrumbs={[{ text: "Home" }]}
          />
          <KpiGrid>
            <KpiCard
              title="QA queue"
              value={quality?.awaitingAction ?? actions.qaWork.length}
              onDrillDown={() => drill("quality-list", { status: "New" })}
            />
            <KpiCard
              title="Failed tests"
              value={quality?.failedTests ?? 0}
              onDrillDown={() =>
                drill("quality-list", { result: "Fail", open: "true" })
              }
            />
            <KpiCard
              title="Retest queue"
              value={quality?.readyForRetest ?? 0}
              onDrillDown={() =>
                drill("quality-list", { status: "Ready for Retest" })
              }
            />
            <KpiCard
              title="Release-blocking defects"
              value={quality?.releaseBlocking ?? 0}
              onDrillDown={() =>
                drill("quality-list", { releaseBlocking: "true", open: "true" })
              }
            />
            <KpiCard
              title="Exceptions awaiting action"
              value={quality?.exceptionsAwaitingApproval ?? 0}
              onDrillDown={() =>
                drill("quality-list", {
                  type: "Release Exception",
                  status: "In Review",
                })
              }
            />
          </KpiGrid>
          <HomeChart title="Quality items by severity" items={severity} />
        </DashboardLayout>
      </ContentContainer>
    );
  }
  const charts = portfolioCharts(projects);
  if (role === "manager") {
    return (
      <ContentContainer>
        <DashboardLayout>
          <PageHeader
            title="Project manager home"
            subtitle="Managed delivery health, schedule outlook, accountability, approvals, and critical risk actions."
            breadcrumbs={[{ text: "Home" }]}
          />
          <KpiGrid>
            <KpiCard
              title="Managed projects"
              value={projects.length}
              onDrillDown={() => drill("project-list", { managedByMe: "true" })}
            />
            <KpiCard
              title="At-risk projects"
              value={charts.health
                .filter(
                  (item) => item.label === "Amber" || item.label === "Red",
                )
                .reduce((sum, item) => sum + item.value, 0)}
              onDrillDown={() => drill("project-list", { atRisk: "true" })}
            />
            <KpiCard
              title="Tasks due"
              value={actions.counts.dueSoon}
              onDrillDown={() => drill("my-work", { due: "week" })}
            />
            <KpiCard
              title="Overdue"
              value={actions.counts.overdue}
              onDrillDown={() => drill("my-work", { overdue: "true" })}
            />
            <KpiCard
              title="Blocked"
              value={actions.counts.blocked}
              onDrillDown={() => drill("my-work", { status: "Blocked" })}
            />
            <KpiCard
              title="Awaiting acceptance"
              value={actions.counts.awaitingAcceptance}
              onDrillDown={() => drill("my-work", { status: "Assigned" })}
            />
            <KpiCard
              title="Reviews awaiting action"
              value={actions.reviews.length}
              onDrillDown={() => drill("reviews")}
            />
            <KpiCard
              title="Pending approvals"
              value={actions.counts.pendingApprovals}
              onDrillDown={() => drill("approval-queue")}
            />
            <KpiCard
              title="Pending change requests"
              value={requestCount}
              onDrillDown={() =>
                drill("change-requests", { filter: "pending" })
              }
            />
            <KpiCard
              title="Time exceptions"
              value={actions.counts.incompleteWorkday}
              onDrillDown={() => drill("time-review")}
            />
            <KpiCard
              title="Critical quality"
              value={quality?.critical ?? 0}
              onDrillDown={() =>
                drill("quality-list", { severity: "Critical", open: "true" })
              }
            />
            <KpiCard
              title="Critical risks"
              value={criticalRiskCount}
              onDrillDown={() =>
                drill("risk-list", { severity: "Critical", open: "true" })
              }
            />
          </KpiGrid>
          <DashboardSection title="Delivery outlook">
            <HomeChart
              title="Managed projects by health"
              items={charts.health}
            />
            <HomeChart
              title="Tasks by status"
              items={[
                {
                  label: "Awaiting acceptance",
                  value: actions.counts.awaitingAcceptance,
                },
                { label: "Due this week", value: actions.counts.dueSoon },
                { label: "Overdue", value: actions.counts.overdue },
                { label: "Blocked", value: actions.counts.blocked },
                { label: "Review", value: actions.reviews.length },
              ]}
            />
            <HomeChart
              title="Effort baseline, approved, actual and forecast"
              items={charts.effort}
              helpText="Hours across the currently managed project set."
            />
          </DashboardSection>
        </DashboardLayout>
      </ContentContainer>
    );
  }
  const allocation = [
    { label: "Available", value: resources?.available ?? 0 },
    { label: "Partially allocated", value: resources?.partiallyAllocated ?? 0 },
    { label: "Fully allocated", value: resources?.fullyAllocated ?? 0 },
    { label: "Over-allocated", value: resources?.overAllocated ?? 0 },
  ];
  const severity = Object.keys(quality?.openDefectsBySeverity ?? {}).map(
    (label) => ({
      label,
      value: quality?.openDefectsBySeverity[label] ?? 0,
    }),
  );
  const financeItems = finance
    ? [
        { label: "Portfolio value", value: finance.portfolioValue },
        { label: "Actual cost", value: finance.actualCost },
        { label: "Forecast cost", value: finance.forecastCost },
        { label: "Forecast contribution", value: finance.forecastContribution },
      ]
    : [];
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="PMO and executive home"
          subtitle="Portfolio health, forecast, capacity, quality, approvals, and reporting confidence."
          breadcrumbs={[{ text: "Home" }]}
          commands={
            <AppButton
              text={
                refreshing
                  ? `Refreshing portfolio ${refreshProgress}%`
                  : "Refresh portfolio metrics"
              }
              disabled={refreshing || projects.length === 0}
              onClick={() => void refreshPortfolio()}
            />
          }
        />
        <KpiGrid>
          <KpiCard
            title="Active portfolio"
            value={projects.length}
            onDrillDown={() => drill("project-list", { active: "true" })}
          />
          <KpiCard
            title="Critical approvals"
            value={actions.counts.pendingApprovals}
            onDrillDown={() => drill("approval-queue")}
          />
          <KpiCard
            title="Critical quality"
            value={quality?.critical ?? 0}
            onDrillDown={() =>
              drill("quality-list", { severity: "Critical", open: "true" })
            }
          />
          <KpiCard
            title="Critical risks"
            value={criticalRiskCount}
            onDrillDown={() =>
              drill("risk-list", { severity: "Critical", open: "true" })
            }
          />
          <KpiCard
            title="Over-allocated resources"
            value={resources?.overAllocated ?? 0}
            onDrillDown={() =>
              drill("resources", { availability: "Over-allocated" })
            }
          />
          <KpiCard
            title="Stale metrics"
            value={actions.counts.staleMetrics}
            onDrillDown={() => drill("project-list", { stale: "true" })}
          />
          <KpiCard
            title="Data-quality warnings"
            value={
              actions.counts.staleMetrics +
              (finance?.missingRate ?? 0) +
              (finance?.missingValue ?? 0)
            }
            onDrillDown={() =>
              drill("reports", { report: "portfolio", status: "data-quality" })
            }
          />
        </KpiGrid>
        <DashboardSection title="Portfolio decisions">
          <HomeChart title="Projects by health" items={charts.health} />
          <HomeChart title="Projects by status" items={charts.status} />
          <HomeChart
            title="Effort baseline, approved, actual and forecast"
            items={charts.effort}
          />
          <PortfolioDateTable projects={projects} />
          <HomeChart
            title="Resource allocation categories"
            items={allocation}
          />
          <HomeChart title="Quality items by severity" items={severity} />
          {finance ? (
            <HomeChart
              title="Cost and margin comparison"
              items={financeItems}
              helpText={`Authorized financial summary in ${finance.currencyCode}.`}
            />
          ) : null}
        </DashboardSection>
        <SummaryCard title="Metrics freshness">
          <p>
            {actions.counts.staleMetrics} active project(s) have metrics older
            than the configured threshold or no calculation timestamp.
          </p>
        </SummaryCard>
      </DashboardLayout>
    </ContentContainer>
  );
};
