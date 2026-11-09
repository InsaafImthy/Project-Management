import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import {
  DashboardLayout,
  DashboardSection,
  EntityDetailLayout,
  EntityListPage,
  FormPageLayout,
  FormRow,
  FormSection,
  KpiCard,
  KpiGrid,
  SummaryCard,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  DateDisplay,
  DateInput,
  LoadingSkeleton,
  NumberInput,
  SelectInput,
  Stack,
  StatusBadge,
  TextArea,
} from "../../../components/primitives";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import type { IPmoProjectStatusReport } from "../../../models/domain";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import {
  validateStatusReport,
  type IStatusReportDraft,
} from "../../../services/domain/ProjectStatusReportService";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { STATUS_REPORT_ROUTES } from "../routes";

const options = (values: readonly string[]) =>
  values.map((value) => ({ key: value, text: value }));
const toDraft = (report: IPmoProjectStatusReport): IStatusReportDraft => ({
  projectId: report.projectId,
  projectCode: report.projectCode,
  title: report.title,
  reportingDate: report.reportingDate.toISOString().slice(0, 10),
  periodStart: report.periodStart.toISOString().slice(0, 10),
  periodEnd: report.periodEnd.toISOString().slice(0, 10),
  overallStatus: report.overallStatus,
  percentComplete: report.percentComplete,
  forecastEnd: report.forecastEnd?.toISOString().slice(0, 10),
  forecastEffortHours: report.forecastEffortHours,
  highlights: report.highlights,
  risksIssuesSummary: report.risksIssuesSummary,
  decisionsRequired: report.decisionsRequired,
  nextSteps: report.nextSteps,
});

export const StatusReportDashboardPage = (): React.ReactElement => {
  const { statusReports } = usePmoServices();
  const user = usePmoCurrentUser();
  const { navigate } = usePmoRoute();
  const [reports, setReports] =
    React.useState<readonly IPmoProjectStatusReport[]>();
  const [projectId, setProjectId] = React.useState<number>();
  React.useEffect(() => {
    void statusReports.list({}).then((page) => setReports(page.items));
  }, [statusReports]);
  if (!reports)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading status reports" />
      </ContentContainer>
    );
  const openList = (status?: IPmoProjectStatusReport["reportStatus"]) =>
    navigate({
      view: STATUS_REPORT_ROUTES.list,
      parameters: {},
      query: { view: STATUS_REPORT_ROUTES.list, ...(status ? { status } : {}) },
    });
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="Project status reports"
          subtitle="Periodic, immutable project snapshots with governed narrative and approval."
          breadcrumbs={[{ text: "Status Reports" }]}
        />
        <DashboardSection title="Reporting state">
          <KpiGrid>
            {PMO_CHOICES.projectStatusReports.reportStatus.map((status) => (
              <KpiCard
                key={status}
                title={status}
                value={
                  reports.filter((report) => report.reportStatus === status)
                    .length
                }
                onDrillDown={() => openList(status)}
              />
            ))}
            <KpiCard
              title="Red reports"
              value={
                reports.filter((report) => report.overallStatus === "Red")
                  .length
              }
              onDrillDown={() =>
                navigate({
                  view: STATUS_REPORT_ROUTES.list,
                  parameters: {},
                  query: { view: STATUS_REPORT_ROUTES.list, health: "Red" },
                })
              }
            />
          </KpiGrid>
        </DashboardSection>
        {user.capabilities.indexOf("projects.manage") >= 0 ? (
          <DashboardSection
            title="Create current-period report"
            description="Operational metrics are prepopulated from Project and Work Items. Narrative remains blank for the project manager to author."
          >
            <Stack direction="horizontal" gap="md" wrap>
              <NumberInput
                label="Project ID"
                value={projectId}
                min={1}
                onChange={setProjectId}
              />
              <AppButton
                text="Create current period"
                variant="primary"
                disabled={!projectId}
                onClick={() =>
                  projectId &&
                  navigate({
                    view: STATUS_REPORT_ROUTES.editor,
                    parameters: { projectId: String(projectId) },
                    query: {
                      view: STATUS_REPORT_ROUTES.editor,
                      projectId: String(projectId),
                    },
                  })
                }
              />
              <AppButton text="View history" onClick={() => openList()} />
            </Stack>
          </DashboardSection>
        ) : null}
      </DashboardLayout>
    </ContentContainer>
  );
};

export const StatusReportListPage = (): React.ReactElement => {
  const { statusReports } = usePmoServices();
  const { route, navigate } = usePmoRoute();
  const [items, setItems] = React.useState<readonly IPmoProjectStatusReport[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const status =
    PMO_CHOICES.projectStatusReports.reportStatus.indexOf(
      route.query.status as IPmoProjectStatusReport["reportStatus"],
    ) >= 0
      ? (route.query.status as IPmoProjectStatusReport["reportStatus"])
      : undefined;
  const projectId = route.query.projectId
    ? Number(route.query.projectId)
    : undefined;
  React.useEffect(() => {
    let active = true;
    void statusReports
      .list({ reportStatus: status, projectId })
      .then((page) => active && setItems(page.items))
      .then(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusReports, status, projectId]);
  const columns: readonly IDataTableColumn<IPmoProjectStatusReport>[] = [
    { key: "title", header: "Status report", render: (item) => item.title },
    { key: "project", header: "Project", render: (item) => item.projectCode },
    {
      key: "date",
      header: "Reporting date",
      render: (item) => <DateDisplay value={item.reportingDate} />,
    },
    {
      key: "health",
      header: "Health",
      render: (item) => <StatusBadge text={item.overallStatus} />,
    },
    {
      key: "complete",
      header: "Complete",
      render: (item) => `${item.percentComplete}%`,
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge text={item.reportStatus} />,
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        ariaLabel="Status report history"
        title="Status report history"
        subtitle="Each row is a preserved period snapshot; later project changes do not rewrite it."
        breadcrumbs={[{ text: "Status Reports" }, { text: "History" }]}
        items={items}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{ pageIndex: 0, pageSize: 50, totalItems: items.length }}
        onPageChange={() => undefined}
        loading={loading}
        getRowActions={(item) => [
          {
            key: "open",
            label: item.reportStatus === "Draft" ? "Edit" : "Open",
            onClick: () =>
              navigate({
                view:
                  item.reportStatus === "Draft"
                    ? STATUS_REPORT_ROUTES.editor
                    : STATUS_REPORT_ROUTES.detail,
                parameters: { reportId: String(item.id) },
                query: {
                  view:
                    item.reportStatus === "Draft"
                      ? STATUS_REPORT_ROUTES.editor
                      : STATUS_REPORT_ROUTES.detail,
                  reportId: String(item.id),
                },
              }),
          },
        ]}
      />
    </ContentContainer>
  );
};

export const StatusReportEditorPage = (): React.ReactElement => {
  const { statusReports } = usePmoServices();
  const { route, navigate } = usePmoRoute();
  const reportId = Number(route.parameters.reportId);
  const projectId = Number(route.parameters.projectId ?? route.query.projectId);
  const [existing, setExisting] = React.useState<IPmoProjectStatusReport>();
  const [draft, setDraft] = React.useState<IStatusReportDraft>();
  const [error, setError] = React.useState<string>();
  const [showErrors, setShowErrors] = React.useState(false);
  React.useEffect(() => {
    const load = reportId
      ? statusReports.get(reportId).then((report) => {
          setExisting(report);
          setDraft(toDraft(report));
        })
      : statusReports.prepareCurrentPeriod(projectId).then(setDraft);
    void load.catch((reason) => setError(toUserSafeErrorMessage(reason)));
  }, [statusReports, reportId, projectId]);
  if (!draft)
    return (
      <ContentContainer>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <LoadingSkeleton label="Preparing status report" />
        )}
      </ContentContainer>
    );
  const set = <K extends keyof IStatusReportDraft>(
    key: K,
    value: IStatusReportDraft[K],
  ) => setDraft({ ...draft, [key]: value });
  const validation = validateStatusReport(draft);
  const save = async (submit: boolean): Promise<void> => {
    setShowErrors(true);
    if (Object.keys(validation).length) return;
    try {
      const saved = await statusReports.saveDraft(draft, existing);
      const result = submit ? await statusReports.submit(saved) : saved;
      navigate({
        view: submit ? STATUS_REPORT_ROUTES.detail : STATUS_REPORT_ROUTES.list,
        parameters: submit ? { reportId: String(result.id) } : {},
        query: submit
          ? { view: STATUS_REPORT_ROUTES.detail, reportId: String(result.id) }
          : { view: STATUS_REPORT_ROUTES.list },
      });
    } catch (reason) {
      setError(toUserSafeErrorMessage(reason));
    }
  };
  return (
    <ContentContainer>
      <FormPageLayout
        header={
          <PageHeader
            title={
              existing
                ? "Edit status report"
                : "Create current-period status report"
            }
            subtitle="Operational snapshot fields are fixed when the draft is created; write the period narrative without fabricating facts."
            breadcrumbs={[{ text: "Status Reports" }, { text: "Editor" }]}
          />
        }
        validationIssues={
          showErrors
            ? Object.keys(validation).map((key) => ({
                key,
                message: validation[key] ?? "Invalid value.",
              }))
            : []
        }
        actions={
          <>
            <AppButton text="Save draft" onClick={() => void save(false)} />
            <AppButton
              text="Submit"
              variant="primary"
              onClick={() => void save(true)}
            />
          </>
        }
      >
        {error ? <p role="alert">{error}</p> : null}
        <FormSection
          title="Snapshot metrics"
          description="These values were captured from the project and work items for this report period."
        >
          <FormRow>
            <DateInput
              label="Reporting date"
              value={draft.reportingDate}
              disabled
            />
            <DateInput
              label="Period start"
              value={draft.periodStart}
              disabled
            />
            <DateInput label="Period end" value={draft.periodEnd} disabled />
          </FormRow>
          <FormRow>
            <SelectInput
              label="Overall status"
              value={draft.overallStatus}
              options={options(PMO_CHOICES.projectStatusReports.overallStatus)}
              disabled
            />
            <NumberInput
              label="Percent complete"
              value={draft.percentComplete}
              disabled
            />
            <DateInput
              label="Forecast end"
              value={draft.forecastEnd}
              disabled
            />
            <NumberInput
              label="Forecast effort hours"
              value={draft.forecastEffortHours}
              disabled
            />
          </FormRow>
        </FormSection>
        <FormSection title="Management narrative">
          <TextArea
            label="Highlights"
            value={draft.highlights}
            required
            errorMessage={showErrors ? validation.highlights : undefined}
            onChange={(value) => set("highlights", value)}
          />
          <TextArea
            label="Risks and issues"
            value={draft.risksIssuesSummary}
            required
            errorMessage={
              showErrors ? validation.risksIssuesSummary : undefined
            }
            onChange={(value) => set("risksIssuesSummary", value)}
          />
          <TextArea
            label="Decisions required"
            value={draft.decisionsRequired ?? ""}
            onChange={(value) => set("decisionsRequired", value)}
          />
          <TextArea
            label="Next steps"
            value={draft.nextSteps}
            required
            errorMessage={showErrors ? validation.nextSteps : undefined}
            onChange={(value) => set("nextSteps", value)}
          />
        </FormSection>
      </FormPageLayout>
    </ContentContainer>
  );
};

export const StatusReportDetailPage = (): React.ReactElement => {
  const { statusReports } = usePmoServices();
  const user = usePmoCurrentUser();
  const { route, back } = usePmoRoute();
  const [report, setReport] = React.useState<IPmoProjectStatusReport>();
  const [error, setError] = React.useState<string>();
  React.useEffect(() => {
    void statusReports
      .get(Number(route.parameters.reportId))
      .then(setReport)
      .catch((reason) => setError(toUserSafeErrorMessage(reason)));
  }, [statusReports, route.parameters.reportId]);
  if (!report)
    return (
      <ContentContainer>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <LoadingSkeleton label="Loading status report" />
        )}
      </ContentContainer>
    );
  const approve = async (): Promise<void> => {
    try {
      setReport(await statusReports.approve(report));
    } catch (reason) {
      setError(toUserSafeErrorMessage(reason));
    }
  };
  return (
    <ContentContainer>
      <PageHeader
        title={report.title}
        subtitle={`Snapshot for ${report.projectCode}`}
        breadcrumbs={[
          { text: "Status Reports", onClick: back },
          { text: report.title },
        ]}
        commands={
          <Stack direction="horizontal" gap="sm">
            <AppButton text="Print" onClick={() => window.print()} />
            {report.reportStatus === "Submitted" &&
            user.capabilities.indexOf("approvals.decide") >= 0 ? (
              <AppButton
                text="Approve"
                variant="primary"
                onClick={() => void approve()}
              />
            ) : null}
          </Stack>
        }
      />
      {error ? <p role="alert">{error}</p> : null}
      <EntityDetailLayout
        summary={
          <Stack gap="sm">
            <StatusBadge text={report.reportStatus} />
            <p>
              <strong>Overall status:</strong> {report.overallStatus} ·{" "}
              <strong>Complete:</strong> {report.percentComplete}% ·{" "}
              <strong>Reporting date:</strong>{" "}
              <DateDisplay value={report.reportingDate} />
            </p>
            <p>
              Period <DateDisplay value={report.periodStart} /> to{" "}
              <DateDisplay value={report.periodEnd} />
            </p>
          </Stack>
        }
        sections={[
          {
            key: "highlights",
            title: "Highlights",
            content: (
              <SummaryCard title="Period achievements">
                <p>{report.highlights}</p>
              </SummaryCard>
            ),
          },
          {
            key: "risks",
            title: "Risks and issues",
            content: (
              <SummaryCard title="Material concerns">
                <p>{report.risksIssuesSummary}</p>
              </SummaryCard>
            ),
          },
          {
            key: "decisions",
            title: "Decisions required",
            content: (
              <SummaryCard title="Management decisions">
                <p>{report.decisionsRequired ?? "None recorded."}</p>
              </SummaryCard>
            ),
          },
          {
            key: "next",
            title: "Next steps",
            content: (
              <SummaryCard title="Next period">
                <p>{report.nextSteps}</p>
              </SummaryCard>
            ),
          },
        ]}
      />
    </ContentContainer>
  );
};
