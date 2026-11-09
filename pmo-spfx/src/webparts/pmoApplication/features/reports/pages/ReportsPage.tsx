import * as React from "react";
import {
  DataTable,
  ExportMenu,
  FilterBar,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  DateInput,
  SelectInput,
  Stack,
  TextInput,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import type {
  IReportResult,
  IReportRow,
  PmoReportKey,
} from "../../../services/domain/ReportService";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import {
  downloadReportCsv,
  openPrintView,
  type IReportExportColumn,
} from "../../../utils/reportExport";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";

const reportOptions: readonly {
  readonly key: PmoReportKey;
  readonly text: string;
}[] = [
  { key: "project-status", text: "Project status" },
  { key: "portfolio", text: "Portfolio" },
  { key: "work-items", text: "Work items" },
  { key: "time-compliance", text: "Time entries and compliance" },
  { key: "utilization", text: "Utilization" },
  { key: "changes-approvals", text: "Change requests and approvals" },
  { key: "quality", text: "Quality" },
  { key: "employee-contribution", text: "Employee contribution" },
  { key: "project-closure", text: "Project closure" },
  { key: "financials", text: "Financials (authorized users)" },
];

const dateValue = (date?: Date): string =>
  date?.toISOString().slice(0, 10) ?? "";

export const ReportsPage = (): React.ReactElement => {
  const { reports } = usePmoServices();
  const user = usePmoCurrentUser();
  const interactions = usePmoInteractions();
  const { route, navigate } = usePmoRoute();
  const requestedReport = reportOptions.some(
    (item) => item.key === route.query.report,
  )
    ? (route.query.report as PmoReportKey)
    : user.capabilities.indexOf("projects.view") >= 0
      ? "portfolio"
      : "work-items";
  const canSelectRequested =
    (requestedReport !== "financials" ||
      user.capabilities.indexOf("finance.view") >= 0) &&
    (["project-status", "portfolio", "project-closure"].indexOf(
      requestedReport,
    ) < 0 ||
      user.capabilities.indexOf("projects.view") >= 0) &&
    (requestedReport !== "quality" ||
      user.capabilities.indexOf("quality.view") >= 0) &&
    (requestedReport !== "utilization" ||
      user.capabilities.indexOf("resources.view") >= 0);
  const initialReport = canSelectRequested
    ? requestedReport
    : user.capabilities.indexOf("projects.view") >= 0
      ? "portfolio"
      : "work-items";
  const [reportKey, setReportKey] = React.useState<PmoReportKey>(initialReport);
  const [projectId, setProjectId] = React.useState(route.query.projectId ?? "");
  const [employeeId, setEmployeeId] = React.useState(
    route.query.employeeId ?? "",
  );
  const [status, setStatus] = React.useState(route.query.status ?? "");
  const [dateFrom, setDateFrom] = React.useState(route.query.dateFrom ?? "");
  const [dateTo, setDateTo] = React.useState(route.query.dateTo ?? "");
  const [result, setResult] = React.useState<IReportResult>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [pageIndex, setPageIndex] = React.useState(0);
  const availableReports = reportOptions.filter(
    (option) =>
      (option.key !== "financials" ||
        user.capabilities.indexOf("finance.view") >= 0) &&
      (["project-status", "portfolio", "project-closure"].indexOf(option.key) <
        0 ||
        user.capabilities.indexOf("projects.view") >= 0) &&
      (option.key !== "quality" ||
        user.capabilities.indexOf("quality.view") >= 0) &&
      (option.key !== "utilization" ||
        user.capabilities.indexOf("resources.view") >= 0),
  );

  const run = React.useCallback(() => {
    setLoading(true);
    setError(undefined);
    const filters = {
      projectId: projectId ? Number(projectId) : undefined,
      employeeId: employeeId ? Number(employeeId) : undefined,
      status: status || undefined,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`) : undefined,
    };
    void reports
      .run(reportKey, filters)
      .then((next) => {
        setResult(next);
        setPageIndex(0);
        navigate({
          view: "reports",
          parameters: {},
          query: {
            view: "reports",
            report: reportKey,
            ...(projectId ? { projectId } : {}),
            ...(employeeId ? { employeeId } : {}),
            ...(status ? { status } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
          },
        });
      })
      .catch((caught) => setError(toUserSafeErrorMessage(caught)))
      .then(() => setLoading(false));
  }, [
    dateFrom,
    dateTo,
    employeeId,
    navigate,
    projectId,
    reportKey,
    reports,
    status,
  ]);

  React.useEffect(run, []);
  const pageSize = 100;
  const visibleRows =
    result?.rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize) ?? [];
  const columns: readonly IDataTableColumn<IReportRow>[] =
    result?.columns.map((column) => ({
      key: column.key,
      header: column.label,
      render: (row: IReportRow) => String(row.values[column.key] ?? "—"),
    })) ?? [];
  const exportColumns: readonly IReportExportColumn<IReportRow>[] =
    result?.columns.map((column) => ({
      header: column.label,
      value: (row: IReportRow) =>
        row.values[column.key] as string | number | boolean | undefined,
    })) ?? [];
  const metadata = result
    ? {
        reportName: result.name,
        asOf: result.asOf,
        filters: {
          projectId: result.filters.projectId,
          employeeId: result.filters.employeeId,
          status: result.filters.status,
          dateFrom: dateValue(result.filters.dateFrom),
          dateTo: dateValue(result.filters.dateTo),
        },
        confidentiality: result.confidentiality,
      }
    : undefined;
  const open = (row: IReportRow): void => {
    if (!row.route) return;
    const view = row.route.view ?? "reports";
    navigate({
      view,
      parameters: {
        projectId: row.route.projectId,
        workItemId: row.route.workItemId,
        approvalId: row.route.approvalId,
        requestId: row.route.requestId,
        qualityId: row.route.qualityId,
        reportId: row.route.reportId,
        employeeId: row.route.employeeId,
        returnView: "reports",
      },
      query: { ...row.route, returnView: "reports" },
    });
  };
  return (
    <ContentContainer>
      <PageHeader
        title="Reports and exports"
        subtitle="Reusable operational reports use the same underlying lists, filters, and authorization boundaries as their source modules."
        breadcrumbs={[{ text: "Reports" }]}
        commands={
          <Stack direction="horizontal" gap="sm">
            <ExportMenu
              formats={["csv"]}
              disabled={!result?.rows.length || !metadata}
              onExport={() =>
                metadata && result
                  ? downloadReportCsv(metadata, exportColumns, result.rows)
                  : undefined
              }
            />
            {result?.printFriendly && metadata ? (
              <AppButton
                text="Print view"
                onClick={() => {
                  try {
                    openPrintView(metadata, exportColumns, result.rows);
                  } catch (caught) {
                    interactions.publishMessage({
                      tone: "danger",
                      text: toUserSafeErrorMessage(caught),
                    });
                  }
                }}
              />
            ) : null}
          </Stack>
        }
      />
      <DataTable
        ariaLabel={result?.name ?? "Report results"}
        items={visibleRows}
        columns={columns}
        getRowKey={(row) => row.id}
        paging={{
          pageIndex,
          pageSize,
          totalItems: result?.rows.length ?? 0,
        }}
        onPageChange={setPageIndex}
        loading={loading}
        errorMessage={error}
        onRetry={run}
        caption={
          result
            ? `${result.name}; as of ${result.asOf.toLocaleString()}; ${result.confidentiality}`
            : undefined
        }
        getRowActions={(row) =>
          row.route
            ? [{ key: "open", label: "Open record", onClick: open }]
            : []
        }
        filterSlot={
          <FilterBar
            searchLabel="Report selection"
            searchValue=""
            onSearch={() => run()}
            controls={
              <>
                <SelectInput
                  label="Report"
                  value={reportKey}
                  options={availableReports}
                  onChange={(value) => setReportKey(value as PmoReportKey)}
                />
                <TextInput
                  label="Project ID"
                  value={projectId}
                  onChange={setProjectId}
                />
                <TextInput
                  label="Employee ID"
                  value={employeeId}
                  onChange={setEmployeeId}
                />
                <TextInput label="Status" value={status} onChange={setStatus} />
                <DateInput
                  label="From"
                  value={dateFrom}
                  onChange={setDateFrom}
                />
                <DateInput label="To" value={dateTo} onChange={setDateTo} />
                <AppButton variant="primary" text="Run report" onClick={run} />
              </>
            }
          />
        }
      />
    </ContentContainer>
  );
};
