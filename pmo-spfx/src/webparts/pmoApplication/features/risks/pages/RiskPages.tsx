import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import {
  DashboardLayout,
  DashboardSection,
  EntityDetailLayout,
  EntityListPage,
  FormPanel,
  KpiCard,
  KpiGrid,
  ReasonDialog,
  SummaryCard,
  Timeline,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  DateDisplay,
  LoadingSkeleton,
  SelectInput,
  Stack,
  StatusBadge,
} from "../../../components/primitives";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import type { IPmoRiskIssue } from "../../../models/domain";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import {
  validateRiskIssue,
  type IRiskIssueDraft,
} from "../../../services/domain/RiskManagementService";
import type { IRiskIssueListFilters } from "../../../services/repositories/repositories";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { RiskIssueForm } from "../components/RiskIssueForm";
import { RISK_ROUTES } from "../routes";

const options = (values: readonly string[]) =>
  values.map((value) => ({ key: value, text: value }));
const initialDraft = (projectId?: number): IRiskIssueDraft => ({
  title: "",
  recordType: "Risk",
  projectId,
  severity: "Medium",
  probability: "Medium",
  description: "",
  impact: "",
});

export const RiskDashboardPage = (): React.ReactElement => {
  const { risks } = usePmoServices();
  const { navigate } = usePmoRoute();
  const [items, setItems] = React.useState<readonly IPmoRiskIssue[]>();
  React.useEffect(() => {
    void risks.list({ openOnly: true }).then((page) => setItems(page.items));
  }, [risks]);
  if (!items)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading risks and issues" />
      </ContentContainer>
    );
  const drill = (query: Record<string, string>) =>
    navigate({
      view: RISK_ROUTES.list,
      parameters: {},
      query: { view: RISK_ROUTES.list, ...query },
    });
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="Risks, issues, and blockers"
          subtitle="Owned response plans, escalation, resolution, and task-linked blockers."
          breadcrumbs={[{ text: "Risks and Issues" }]}
        />
        <DashboardSection title="Open governance items">
          <KpiGrid>
            {(["Risk", "Issue", "Blocker"] as const).map((type) => (
              <KpiCard
                key={type}
                title={`Open ${type.toLowerCase()}s`}
                value={items.filter((item) => item.recordType === type).length}
                onDrillDown={() => drill({ type, open: "true" })}
              />
            ))}
            <KpiCard
              title="Critical"
              value={
                items.filter((item) => item.severity === "Critical").length
              }
              onDrillDown={() => drill({ severity: "Critical", open: "true" })}
            />
            <KpiCard
              title="Escalated"
              value={items.filter((item) => item.isEscalated).length}
              onDrillDown={() => drill({ escalated: "true", open: "true" })}
            />
            <KpiCard
              title="Overdue"
              value={
                items.filter(
                  (item) =>
                    item.targetResolutionDate &&
                    item.targetResolutionDate < new Date(),
                ).length
              }
              onDrillDown={() => drill({ overdue: "true", open: "true" })}
            />
          </KpiGrid>
        </DashboardSection>
      </DashboardLayout>
    </ContentContainer>
  );
};

export const RiskListPage = (): React.ReactElement => {
  const { risks, people } = usePmoServices();
  const user = usePmoCurrentUser();
  const { route, navigate } = usePmoRoute();
  const [filters, setFilters] = React.useState<IRiskIssueListFilters>({
    recordType:
      PMO_CHOICES.risksIssues.recordType.indexOf(
        route.query.type as IPmoRiskIssue["recordType"],
      ) >= 0
        ? (route.query.type as IPmoRiskIssue["recordType"])
        : undefined,
    severity:
      PMO_CHOICES.risksIssues.severity.indexOf(
        route.query.severity as IPmoRiskIssue["severity"],
      ) >= 0
        ? (route.query.severity as IPmoRiskIssue["severity"])
        : undefined,
    openOnly: route.query.open === "true" ? true : undefined,
    escalated: route.query.escalated === "true" ? true : undefined,
    dueBefore: route.query.overdue === "true" ? new Date() : undefined,
    projectId: route.query.projectId
      ? Number(route.query.projectId)
      : undefined,
  });
  const [items, setItems] = React.useState<readonly IPmoRiskIssue[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(() =>
    initialDraft(filters.projectId),
  );
  const [showErrors, setShowErrors] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void risks
      .list(filters)
      .then(
        (page) => active && setItems(page.items),
        (reason) => active && setError(toUserSafeErrorMessage(reason)),
      )
      .then(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [risks, JSON.stringify(filters), version]);
  const validation = validateRiskIssue(draft);
  const save = async (): Promise<void> => {
    setShowErrors(true);
    if (Object.keys(validation).length) return;
    try {
      await risks.save(draft);
      setCreateOpen(false);
      setDraft(initialDraft(filters.projectId));
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(toUserSafeErrorMessage(reason));
    }
  };
  const columns: readonly IDataTableColumn<IPmoRiskIssue>[] = [
    { key: "number", header: "Number", render: (item) => item.recordNumber },
    {
      key: "title",
      header: "Risk, issue, or blocker",
      render: (item) => item.title,
    },
    { key: "type", header: "Type", render: (item) => item.recordType },
    { key: "severity", header: "Severity", render: (item) => item.severity },
    { key: "owner", header: "Owner", render: (item) => item.owner.displayName },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge text={item.status} />,
    },
    {
      key: "due",
      header: "Due",
      render: (item) =>
        item.targetResolutionDate ? (
          <DateDisplay value={item.targetResolutionDate} />
        ) : (
          "—"
        ),
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        ariaLabel="Risks, issues, and blockers"
        title="Risks, issues, and blockers"
        subtitle="One governed list with owner, due-date, severity, and status filtering."
        breadcrumbs={[{ text: "Risks and Issues" }, { text: "Register" }]}
        items={items}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{ pageIndex: 0, pageSize: 50, totalItems: items.length }}
        onPageChange={() => undefined}
        loading={loading}
        errorMessage={error}
        onRetry={() => setVersion((value) => value + 1)}
        onCreate={
          user.capabilities.indexOf("projects.manage") >= 0
            ? () => setCreateOpen(true)
            : undefined
        }
        createLabel="Create record"
        getRowActions={(item) => [
          {
            key: "open",
            label: "Open",
            onClick: () =>
              navigate({
                view: RISK_ROUTES.detail,
                parameters: { riskId: String(item.id) },
                query: { view: RISK_ROUTES.detail, riskId: String(item.id) },
              }),
          },
        ]}
        filterSlot={
          <Stack direction="horizontal" gap="md" wrap>
            <SelectInput
              label="Type"
              value={filters.recordType ?? ""}
              options={[
                { key: "", text: "All types" },
                ...options(PMO_CHOICES.risksIssues.recordType),
              ]}
              onChange={(value) =>
                setFilters({
                  recordType: (value ||
                    undefined) as IRiskIssueListFilters["recordType"],
                })
              }
            />
            <SelectInput
              label="Status"
              value={filters.status ?? ""}
              options={[
                { key: "", text: "All statuses" },
                ...options(PMO_CHOICES.risksIssues.status),
              ]}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  status: (value ||
                    undefined) as IRiskIssueListFilters["status"],
                }))
              }
            />
          </Stack>
        }
      />
      <FormPanel
        open={createOpen}
        title="Create risk, issue, or blocker"
        width="large"
        onDismiss={() => setCreateOpen(false)}
        onSubmit={() => void save()}
        validationIssues={
          showErrors
            ? Object.keys(validation).map((key) => ({
                key,
                message: validation[key] ?? "Invalid value.",
              }))
            : []
        }
      >
        <RiskIssueForm
          draft={draft}
          errors={showErrors ? validation : {}}
          onChange={setDraft}
          onResolvePeople={(query) => people.search(query)}
        />
      </FormPanel>
    </ContentContainer>
  );
};

export const RiskDetailPage = (): React.ReactElement => {
  const { risks } = usePmoServices();
  const user = usePmoCurrentUser();
  const { route, back } = usePmoRoute();
  const [item, setItem] = React.useState<IPmoRiskIssue>();
  const [error, setError] = React.useState<string>();
  const [action, setAction] = React.useState<
    "escalate" | IPmoRiskIssue["status"]
  >();
  React.useEffect(() => {
    void risks
      .get(Number(route.parameters.riskId))
      .then(setItem)
      .catch((reason) => setError(toUserSafeErrorMessage(reason)));
  }, [risks, route.parameters.riskId]);
  if (!item)
    return (
      <ContentContainer>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <LoadingSkeleton label="Loading risk or issue" />
        )}
      </ContentContainer>
    );
  const apply = async (reason: string): Promise<void> => {
    if (!action) return;
    try {
      setItem(
        action === "escalate"
          ? await risks.escalate(item, reason)
          : await risks.transition(item, action, reason),
      );
      setAction(undefined);
    } catch (reasonValue) {
      setError(toUserSafeErrorMessage(reasonValue));
    }
  };
  return (
    <ContentContainer>
      <PageHeader
        title={item.title}
        subtitle={`${item.recordNumber} · ${item.recordType}`}
        breadcrumbs={[
          { text: "Risks and Issues", onClick: back },
          { text: item.recordNumber },
        ]}
      />
      {error ? <p role="alert">{error}</p> : null}
      <EntityDetailLayout
        actions={
          user.capabilities.indexOf("projects.manage") >= 0 ? (
            <Stack direction="horizontal" gap="sm" wrap>
              {["Resolved", "Accepted", "Closed"].indexOf(item.status) < 0 ? (
                <>
                  <AppButton
                    text="Escalate"
                    onClick={() => setAction("escalate")}
                  />
                  <AppButton
                    text="Resolve"
                    variant="primary"
                    onClick={() => setAction("Resolved")}
                  />
                  <AppButton
                    text="Accept"
                    onClick={() => setAction("Accepted")}
                  />
                </>
              ) : null}
              {["Resolved", "Accepted"].indexOf(item.status) >= 0 ? (
                <AppButton
                  text="Close"
                  variant="primary"
                  onClick={() => setAction("Closed")}
                />
              ) : null}
            </Stack>
          ) : undefined
        }
        summary={
          <Stack gap="sm">
            <StatusBadge text={item.status} />
            <p>{item.description}</p>
            <p>
              <strong>Severity:</strong> {item.severity} ·{" "}
              <strong>Owner:</strong> {item.owner.displayName} ·{" "}
              <strong>Escalated:</strong> {item.isEscalated ? "Yes" : "No"}
            </p>
          </Stack>
        }
        sections={[
          {
            key: "impact",
            title: "Impact and response",
            content: (
              <SummaryCard title="Response plan">
                <p>{item.impact}</p>
                <p>{item.responsePlan ?? "No response plan recorded."}</p>
              </SummaryCard>
            ),
          },
          {
            key: "resolution",
            title: "Resolution",
            content: (
              <SummaryCard title="Closure evidence">
                <p>{item.resolution ?? "Not resolved."}</p>
              </SummaryCard>
            ),
          },
          {
            key: "timeline",
            title: "Lifecycle timeline",
            content: (
              <Timeline
                ariaLabel={`${item.recordType} lifecycle`}
                items={[
                  {
                    key: "raised",
                    title: `${item.recordType} raised`,
                    actor: item.raisedBy.displayName,
                    timestamp: <DateDisplay value={item.raisedOn} />,
                  },
                  ...(item.isEscalated
                    ? [
                        {
                          key: "escalated",
                          title: "Escalated",
                          detail: "Escalation remains visible on the record.",
                        },
                      ]
                    : []),
                  ...(item.resolvedOn
                    ? [
                        {
                          key: "resolved",
                          title: "Resolution recorded",
                          detail: item.resolution,
                          timestamp: <DateDisplay value={item.resolvedOn} />,
                        },
                      ]
                    : []),
                  {
                    key: "current",
                    title: `Current status: ${item.status}`,
                    actor: item.owner.displayName,
                    timestamp: item.modified ? (
                      <DateDisplay value={item.modified} />
                    ) : undefined,
                  },
                ]}
              />
            ),
          },
        ]}
      />
      <ReasonDialog
        open={Boolean(action)}
        title={
          action === "escalate"
            ? "Escalate record"
            : `${action ?? "Update"} record`
        }
        actionLabel={action === "escalate" ? "Escalate" : (action ?? "Save")}
        onDismiss={() => setAction(undefined)}
        onSubmit={(reason) => void apply(reason)}
      />
    </ContentContainer>
  );
};
