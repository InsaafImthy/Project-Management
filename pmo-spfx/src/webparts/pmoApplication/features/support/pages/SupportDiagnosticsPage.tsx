import * as React from "react";
import {
  DataTable,
  DescriptionList,
  KpiCard,
  KpiGrid,
  SummaryCard,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  DateDisplay,
  LoadingSkeleton,
  StatusBadge,
} from "../../../components/primitives";
import {
  PMO_APPLICATION_VERSION,
  pmoEnvironment,
} from "../../../config/environment";
import { usePmoServices } from "../../../context/PmoServicesContext";
import type {
  IPmoFailedActionDiagnostic,
  IPmoPermissionDiagnostic,
  IPmoSupportDiagnosticResult,
} from "../../../services/domain/SupportDiagnosticsService";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";

export const SupportDiagnosticsPage = (): React.ReactElement => {
  const { diagnostics } = usePmoServices();
  const [result, setResult] = React.useState<IPmoSupportDiagnosticResult>();
  const [error, setError] = React.useState<string>();
  const [loading, setLoading] = React.useState(true);
  const load = React.useCallback((): void => {
    setLoading(true);
    setError(undefined);
    diagnostics.run().then(
      (next) => {
        setResult(next);
        setLoading(false);
      },
      (caught: unknown) => {
        setError(toUserSafeErrorMessage(caught));
        setLoading(false);
      },
    );
  }, [diagnostics]);
  React.useEffect(load, [load]);

  const permissionColumns: readonly IDataTableColumn<IPmoPermissionDiagnostic>[] =
    [
      {
        key: "container",
        header: "List or library",
        render: (item) => item.containerName,
      },
      {
        key: "connectivity",
        header: "Connectivity",
        render: (item) => (
          <StatusBadge
            text={item.connected ? "Connected" : "Unavailable"}
            tone={item.connected ? "success" : "danger"}
          />
        ),
      },
      {
        key: "read",
        header: "Read",
        render: (item) => (item.canRead ? "Yes" : "No"),
      },
      {
        key: "write",
        header: "Write",
        render: (item) =>
          item.expectedWrite
            ? item.canAdd && item.canEdit
              ? "Ready"
              : "Missing add or edit"
            : "Not required for this role",
      },
      {
        key: "result",
        header: "Readiness",
        render: (item) => (
          <StatusBadge
            text={item.ready ? "Ready" : "Action required"}
            tone={item.ready ? "success" : "danger"}
          />
        ),
      },
      {
        key: "reference",
        header: "Support reference",
        render: (item) => item.supportReference ?? "—",
      },
    ];
  const failureColumns: readonly IDataTableColumn<IPmoFailedActionDiagnostic>[] =
    [
      { key: "kind", header: "Kind", render: (item) => item.kind },
      {
        key: "reference",
        header: "Reference",
        render: (item) => item.reference,
      },
      {
        key: "project",
        header: "Project",
        render: (item) => item.projectCode ?? "—",
      },
      { key: "action", header: "Action", render: (item) => item.actionType },
      {
        key: "date",
        header: "Failed on",
        render: (item) => <DateDisplay value={item.occurredOn} includeTime />,
      },
      {
        key: "result",
        header: "Safe result",
        render: (item) => item.safeResult ?? "Processing failed.",
      },
    ];

  return (
    <ContentContainer>
      <PageHeader
        title="Support diagnostics"
        subtitle="Metadata-only checks for application identity, capabilities, SharePoint connectivity, effective permissions, and failed governed actions."
        breadcrumbs={[
          { text: "Administration" },
          { text: "Support diagnostics" },
        ]}
        commands={
          <AppButton
            text="Run checks again"
            onClick={load}
            disabled={loading}
          />
        }
      />
      {loading && !result ? (
        <LoadingSkeleton label="Running support diagnostics" lines={6} />
      ) : null}
      {error ? (
        <SummaryCard title="Diagnostics unavailable">
          <p>{error}</p>
          <AppButton text="Retry" onClick={load} />
        </SummaryCard>
      ) : null}
      {result ? (
        <>
          <KpiGrid>
            <KpiCard
              title="Application version"
              value={PMO_APPLICATION_VERSION}
            />
            <KpiCard
              title="Connected containers"
              value={result.permissions.filter((item) => item.connected).length}
              helpText={`of ${result.permissions.length} checked`}
            />
            <KpiCard
              title="Permission issues"
              value={result.permissions.filter((item) => !item.ready).length}
            />
            <KpiCard
              title="Failed actions"
              value={result.failedActions.length}
            />
          </KpiGrid>
          <SummaryCard title="Runtime and authorization">
            <DescriptionList
              items={[
                {
                  key: "version",
                  label: "Application version",
                  value: PMO_APPLICATION_VERSION,
                },
                {
                  key: "environment",
                  label: "SharePoint environment",
                  value: pmoEnvironment.siteUrl,
                },
                {
                  key: "actor",
                  label: "Checked as",
                  value: result.actorDisplayName,
                },
                {
                  key: "checked",
                  label: "Checked on",
                  value: <DateDisplay value={result.checkedOn} includeTime />,
                },
                {
                  key: "roles",
                  label: "Security roles",
                  value: result.securityRoles.join(", ") || "None resolved",
                },
                {
                  key: "capabilities",
                  label: "Capabilities",
                  value: result.capabilities.join(", ") || "None resolved",
                },
              ]}
            />
          </SummaryCard>
          <DataTable
            ariaLabel="SharePoint permission readiness"
            caption="Effective permissions only; no list records are read by this check."
            items={result.permissions}
            columns={permissionColumns}
            getRowKey={(item) => item.containerName}
            paging={{
              pageIndex: 0,
              pageSize: result.permissions.length || 1,
              totalItems: result.permissions.length,
            }}
            onPageChange={() => undefined}
          />
          <DataTable
            ariaLabel="Failed governed actions"
            caption="Only minimal identifiers and safe processing results are shown."
            items={result.failedActions}
            columns={failureColumns}
            getRowKey={(item) => `${item.kind}-${item.id}`}
            paging={{
              pageIndex: 0,
              pageSize: 50,
              totalItems: result.failedActions.length,
            }}
            onPageChange={() => undefined}
            emptyTitle="No failed governed actions"
            emptyDescription="No failed Task Actions or Approval Requests require support attention."
          />
        </>
      ) : null}
    </ContentContainer>
  );
};
