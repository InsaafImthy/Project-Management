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
  NumberInput,
  PersonInput,
  SelectInput,
  Stack,
  StatusBadge,
  TextInput,
} from "../../../components/primitives";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import type { IPmoPerson, IPmoQualityItem } from "../../../models/domain";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import type { IQualityItemListFilters } from "../../../services/repositories/repositories";
import {
  validateQualityItem,
  type IQualityItemDraft,
} from "../../../services/domain/QualityGovernanceService";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { QualityItemForm } from "../components/QualityItemForm";
import { QUALITY_ROUTES } from "../routes";

const choices = (values: readonly string[]) =>
  values.map((value) => ({ key: value, text: value }));
const initialDraft = (projectId?: number): IQualityItemDraft => ({
  title: "",
  qualityType: "Test Result",
  projectId,
  description: "",
  priority: "Normal",
  isReleaseBlocking: false,
});
const filtersFromQuery = (
  query: Readonly<Record<string, string>>,
): IQualityItemListFilters => ({
  qualityType:
    PMO_CHOICES.qualityItems.qualityType.indexOf(
      query.type as IPmoQualityItem["qualityType"],
    ) >= 0
      ? (query.type as IPmoQualityItem["qualityType"])
      : undefined,
  status:
    PMO_CHOICES.qualityItems.status.indexOf(
      query.status as IPmoQualityItem["status"],
    ) >= 0
      ? (query.status as IPmoQualityItem["status"])
      : undefined,
  testResult:
    PMO_CHOICES.qualityItems.testResult.indexOf(
      query.result as NonNullable<IPmoQualityItem["testResult"]>,
    ) >= 0
      ? (query.result as IPmoQualityItem["testResult"])
      : undefined,
  severity:
    PMO_CHOICES.qualityItems.severity.indexOf(
      query.severity as NonNullable<IPmoQualityItem["severity"]>,
    ) >= 0
      ? (query.severity as IPmoQualityItem["severity"])
      : undefined,
  releaseBlocking: query.releaseBlocking === "true" ? true : undefined,
  openOnly: query.open === "true" ? true : undefined,
  overdueBefore: query.overdue === "true" ? new Date() : undefined,
  projectId: query.projectId ? Number(query.projectId) : undefined,
});

export const QualityDashboardPage = (): React.ReactElement => {
  const { quality } = usePmoServices();
  const { navigate } = usePmoRoute();
  const [summary, setSummary] =
    React.useState<Awaited<ReturnType<typeof quality.dashboard>>>();
  React.useEffect(() => {
    void quality.dashboard().then(setSummary);
  }, [quality]);
  const drill = (query: Record<string, string>) =>
    navigate({
      view: QUALITY_ROUTES.list,
      parameters: {},
      query: { view: QUALITY_ROUTES.list, ...query },
    });
  if (!summary)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading quality dashboard" />
      </ContentContainer>
    );
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="Quality governance"
          subtitle={`QA actions, release controls, defects, and retest readiness. As of ${summary.asOf.toLocaleString()}.`}
          breadcrumbs={[{ text: "Quality" }]}
        />
        <DashboardSection title="Quality action queues">
          <KpiGrid>
            <KpiCard
              title="QA awaiting action"
              value={summary.awaitingAction}
              onDrillDown={() => drill({ status: "New" })}
            />
            <KpiCard
              title="Failed tests"
              value={summary.failedTests}
              onDrillDown={() => drill({ result: "Fail", open: "true" })}
            />
            <KpiCard
              title="Open defects"
              value={
                (summary.openDefectsBySeverity.Low ?? 0) +
                (summary.openDefectsBySeverity.Medium ?? 0) +
                (summary.openDefectsBySeverity.High ?? 0) +
                (summary.openDefectsBySeverity.Critical ?? 0)
              }
              helpText={`Critical ${summary.openDefectsBySeverity.Critical ?? 0}; High ${summary.openDefectsBySeverity.High ?? 0}`}
              onDrillDown={() => drill({ type: "Defect", open: "true" })}
            />
            <KpiCard
              title="Release blocking"
              value={summary.releaseBlocking}
              status={{
                label: summary.releaseBlocking ? "Blocked" : "Clear",
                tone: summary.releaseBlocking ? "danger" : "success",
              }}
              onDrillDown={() =>
                drill({ releaseBlocking: "true", open: "true" })
              }
            />
            <KpiCard
              title="Ready for retest"
              value={summary.readyForRetest}
              onDrillDown={() => drill({ status: "Ready for Retest" })}
            />
            <KpiCard
              title="Production defects"
              value={summary.productionDefects}
              onDrillDown={() =>
                drill({ type: "Production Defect", open: "true" })
              }
            />
            <KpiCard
              title="Exceptions awaiting approval"
              value={summary.exceptionsAwaitingApproval}
              onDrillDown={() =>
                drill({ type: "Release Exception", status: "In Review" })
              }
            />
            <KpiCard
              title="Critical open"
              value={summary.critical}
              status={{
                label: summary.critical ? "Critical" : "Clear",
                tone: summary.critical ? "danger" : "success",
              }}
              onDrillDown={() => drill({ severity: "Critical", open: "true" })}
            />
            <KpiCard
              title="Overdue"
              value={summary.overdue}
              onDrillDown={() => drill({ overdue: "true", open: "true" })}
            />
          </KpiGrid>
        </DashboardSection>
      </DashboardLayout>
    </ContentContainer>
  );
};

export const QualityListPage = (): React.ReactElement => {
  const { quality, people } = usePmoServices();
  const { route, navigate } = usePmoRoute();
  const user = usePmoCurrentUser();
  const [filters, setFilters] = React.useState<IQualityItemListFilters>(() =>
    filtersFromQuery(route.query),
  );
  const [items, setItems] = React.useState<readonly IPmoQualityItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<IQualityItemDraft>(() =>
    initialDraft(filters.projectId),
  );
  const [showErrors, setShowErrors] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void quality
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
  }, [quality, JSON.stringify(filters), version]);
  const validation = validateQualityItem(draft);
  const save = async (): Promise<void> => {
    setShowErrors(true);
    if (Object.keys(validation).length) return;
    try {
      await quality.save(draft);
      setCreateOpen(false);
      setDraft(initialDraft(filters.projectId));
      setShowErrors(false);
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(toUserSafeErrorMessage(reason));
    }
  };
  const open = (item: IPmoQualityItem) =>
    navigate({
      view: QUALITY_ROUTES.detail,
      parameters: {
        qualityId: String(item.id),
        returnView: QUALITY_ROUTES.list,
      },
      query: {
        view: QUALITY_ROUTES.detail,
        qualityId: String(item.id),
        returnView: QUALITY_ROUTES.list,
      },
    });
  const columns: readonly IDataTableColumn<IPmoQualityItem>[] = [
    { key: "number", header: "Number", render: (item) => item.qualityNumber },
    { key: "title", header: "Quality item", render: (item) => item.title },
    { key: "type", header: "Type", render: (item) => item.qualityType },
    {
      key: "severity",
      header: "Severity",
      render: (item) => item.severity ?? "—",
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge text={item.status} />,
    },
    {
      key: "due",
      header: "Target fix",
      render: (item) =>
        item.targetFixDate ? <DateDisplay value={item.targetFixDate} /> : "—",
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        title="Quality items"
        ariaLabel="Quality items"
        subtitle="One governed list for tests, defects, production defects, and release exceptions."
        breadcrumbs={[
          {
            text: "Quality",
            onClick: () =>
              navigate({
                view: QUALITY_ROUTES.dashboard,
                parameters: {},
                query: { view: QUALITY_ROUTES.dashboard },
              }),
          },
          { text: "Items" },
        ]}
        items={items}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{ pageIndex: 0, pageSize: 50, totalItems: items.length }}
        onPageChange={() => undefined}
        loading={loading}
        errorMessage={error}
        onRetry={() => setVersion((value) => value + 1)}
        onCreate={
          user.capabilities.indexOf("quality.manage") >= 0
            ? () => setCreateOpen(true)
            : undefined
        }
        createLabel="Record quality item"
        getRowActions={() => [{ key: "open", label: "Open", onClick: open }]}
        filterSlot={
          <Stack direction="horizontal" gap="md" wrap>
            <SelectInput
              label="Type"
              value={filters.qualityType ?? ""}
              options={[
                { key: "", text: "All types" },
                ...choices(PMO_CHOICES.qualityItems.qualityType),
              ]}
              onChange={(value) =>
                setFilters({
                  qualityType: (value ||
                    undefined) as IQualityItemListFilters["qualityType"],
                })
              }
            />
            <SelectInput
              label="Status"
              value={filters.status ?? ""}
              options={[
                { key: "", text: "All statuses" },
                ...choices(PMO_CHOICES.qualityItems.status),
              ]}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  status: (value ||
                    undefined) as IQualityItemListFilters["status"],
                }))
              }
            />
          </Stack>
        }
      />
      <FormPanel
        open={createOpen}
        title="Record quality item"
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
        <QualityItemForm
          draft={draft}
          errors={showErrors ? validation : {}}
          onChange={setDraft}
          onResolvePeople={(query) => people.search(query)}
        />
      </FormPanel>
    </ContentContainer>
  );
};

export const QualityDetailPage = (): React.ReactElement => {
  const { quality, people } = usePmoServices();
  const { route, back } = usePmoRoute();
  const user = usePmoCurrentUser();
  const id = Number(route.parameters.qualityId);
  const [item, setItem] = React.useState<IPmoQualityItem>();
  const [error, setError] = React.useState<string>();
  const [fixOpen, setFixOpen] = React.useState(false);
  const [effort, setEffort] = React.useState(0);
  const [evidence, setEvidence] = React.useState("");
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignee, setAssignee] = React.useState<IPmoPerson>();
  const [linkedOpen, setLinkedOpen] = React.useState(false);
  const [linkedDraft, setLinkedDraft] = React.useState<IQualityItemDraft>(() =>
    initialDraft(),
  );
  const [showLinkedErrors, setShowLinkedErrors] = React.useState(false);
  const [reasonTarget, setReasonTarget] = React.useState<
    "Deferred" | "Rejected"
  >();
  const reload = React.useCallback(() => {
    void quality
      .get(id)
      .then(setItem)
      .catch((reason) => setError(toUserSafeErrorMessage(reason)));
  }, [quality, id]);
  React.useEffect(reload, [reload]);
  if (!item)
    return (
      <ContentContainer>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <LoadingSkeleton label="Loading quality item" />
        )}
      </ContentContainer>
    );
  const act = async (
    operation: () => Promise<IPmoQualityItem>,
  ): Promise<void> => {
    try {
      setItem(await operation());
      setError(undefined);
    } catch (reason) {
      setError(toUserSafeErrorMessage(reason));
    }
  };
  const canManage = user.capabilities.indexOf("quality.manage") >= 0;
  const linkedValidation = validateQualityItem(linkedDraft);
  const openLinkedDefect = (): void => {
    setLinkedDraft({
      title: `Defect from ${item.qualityNumber}`,
      qualityType: "Defect",
      projectId: item.projectId,
      projectCode: item.projectCode,
      workItemId: item.workItemId,
      releaseName: item.releaseName,
      severity: "High",
      priority: "High",
      description: "",
      evidenceLink: item.evidenceLink?.url,
      isReleaseBlocking: item.isReleaseBlocking,
    });
    setShowLinkedErrors(false);
    setLinkedOpen(true);
  };
  return (
    <ContentContainer>
      <PageHeader
        title={item.title}
        subtitle={`${item.qualityNumber} · ${item.qualityType}`}
        breadcrumbs={[
          { text: "Quality", onClick: back },
          { text: item.qualityNumber },
        ]}
      />
      {error ? <p role="alert">{error}</p> : null}
      <EntityDetailLayout
        actions={
          canManage ? (
            <Stack direction="horizontal" gap="sm" wrap>
              {item.qualityType === "Release Exception" &&
              !item.approvalRequestId ? (
                <AppButton
                  text="Submit exception"
                  variant="primary"
                  onClick={() => void act(() => quality.submitException(item))}
                />
              ) : null}
              {item.qualityType === "Test Result" &&
              item.testResult === "Fail" ? (
                <AppButton
                  text="Create linked defect"
                  variant="primary"
                  onClick={openLinkedDefect}
                />
              ) : null}
              {(item.qualityType === "Defect" ||
                item.qualityType === "Production Defect") &&
              item.status === "New" ? (
                <AppButton
                  text="Assign defect"
                  onClick={() => {
                    setAssignee(item.assignedTo);
                    setAssignOpen(true);
                  }}
                />
              ) : null}
              {item.status === "In Fix" ? (
                <AppButton
                  text="Submit for retest"
                  onClick={() => void act(() => quality.submitForRetest(item))}
                />
              ) : null}
              {item.status === "Ready for Retest" ? (
                <>
                  <AppButton
                    text="Retest passed"
                    variant="primary"
                    onClick={() =>
                      void act(() => quality.recordRetest(item, "Pass"))
                    }
                  />
                  <AppButton
                    text="Retest failed"
                    onClick={() =>
                      void act(() => quality.recordRetest(item, "Fail"))
                    }
                  />
                </>
              ) : null}
              {["Assigned", "In Fix", "Retest Failed"].indexOf(item.status) >=
              0 ? (
                <AppButton text="Record fix" onClick={() => setFixOpen(true)} />
              ) : null}
              {["Closed", "Rejected", "Approved Exception"].indexOf(
                item.status,
              ) < 0 ? (
                <>
                  <AppButton
                    text="Defer"
                    onClick={() => setReasonTarget("Deferred")}
                  />
                  <AppButton
                    text="Reject"
                    onClick={() => setReasonTarget("Rejected")}
                  />
                </>
              ) : null}
            </Stack>
          ) : undefined
        }
        summary={
          <Stack gap="sm">
            <StatusBadge text={item.status} />
            <p>{item.description}</p>
            <p>
              <strong>Project:</strong> {item.projectCode} ·{" "}
              <strong>Release blocking:</strong>{" "}
              {item.isReleaseBlocking ? "Yes" : "No"}
            </p>
          </Stack>
        }
        sections={[
          {
            key: "quality",
            title: "Quality result",
            content: (
              <SummaryCard title="Result and evidence">
                <p>Test result: {item.testResult ?? "Not applicable"}</p>
                <p>Severity: {item.severity ?? "Not set"}</p>
                <p>
                  Evidence:{" "}
                  {item.evidenceLink?.url ? (
                    <a href={item.evidenceLink.url}>Open evidence</a>
                  ) : (
                    "Not supplied"
                  )}
                </p>
              </SummaryCard>
            ),
          },
          {
            key: "cause",
            title: "Root cause and impact",
            content: (
              <SummaryCard title="Analysis">
                <p>Root cause: {item.rootCauseCategory ?? "Not recorded"}</p>
                <p>{item.rootCauseDetails ?? "No root-cause narrative."}</p>
                <p>
                  Customer impact: {item.customerImpact ?? "Not applicable"}
                </p>
              </SummaryCard>
            ),
          },
          {
            key: "history",
            title: "Retest and approval",
            content: (
              <SummaryCard title="Governance">
                <p>Retest: {item.retestResult ?? "Not run"}</p>
                <p>Approval request: {item.approvalRequestId ?? "None"}</p>
                <p>
                  Approved exceptions remain exceptions and do not change the
                  original test result.
                </p>
              </SummaryCard>
            ),
          },
          {
            key: "timeline",
            title: "Lifecycle timeline",
            content: (
              <Timeline
                ariaLabel="Quality item lifecycle"
                items={[
                  {
                    key: "raised",
                    title: "Quality item raised",
                    actor: item.raisedBy.displayName,
                    timestamp: <DateDisplay value={item.raisedOn} />,
                  },
                  ...(item.assignedTo
                    ? [
                        {
                          key: "assigned",
                          title: "Assigned for action",
                          actor: item.assignedTo.displayName,
                        },
                      ]
                    : []),
                  ...(item.retestedOn
                    ? [
                        {
                          key: "retested",
                          title: `Retest ${item.retestResult ?? "recorded"}`,
                          actor: item.retestedBy?.displayName,
                          timestamp: <DateDisplay value={item.retestedOn} />,
                        },
                      ]
                    : []),
                  {
                    key: "current",
                    title: `Current status: ${item.status}`,
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
      <FormPanel
        open={fixOpen}
        title="Record defect fix"
        onDismiss={() => setFixOpen(false)}
        onSubmit={() =>
          void act(async () => {
            const updated = await quality.recordFix(item, effort, evidence);
            setFixOpen(false);
            return updated;
          })
        }
      >
        <NumberInput
          label="Fix effort hours"
          value={effort}
          min={0}
          precision={2}
          onChange={(value) => setEffort(value ?? 0)}
        />
        <TextInput
          label="Fix evidence link"
          value={evidence}
          required
          onChange={setEvidence}
        />
      </FormPanel>
      <FormPanel
        open={assignOpen}
        title="Assign defect"
        onDismiss={() => setAssignOpen(false)}
        onSubmit={() => {
          if (!assignee) {
            setError("Select an accountable defect owner.");
            return;
          }
          void act(async () => {
            const updated = await quality.assign(item, assignee);
            setAssignOpen(false);
            return updated;
          });
        }}
      >
        <PersonInput
          label="Assigned to"
          required
          selectedPeople={
            assignee
              ? [
                  {
                    id: String(assignee.id),
                    email: assignee.email ?? "",
                    text: assignee.displayName,
                  },
                ]
              : []
          }
          onResolveSuggestions={async (query) =>
            (await people.search(query)).map((person) => ({
              id: String(person.id),
              email: person.email ?? "",
              text: person.displayName,
            }))
          }
          onChange={(selected) => {
            const person = selected[0];
            setAssignee(
              person
                ? {
                    id: Number(person.id),
                    displayName: person.text ?? person.email,
                    email: person.email,
                  }
                : undefined,
            );
          }}
        />
      </FormPanel>
      <FormPanel
        open={linkedOpen}
        title="Create linked defect"
        width="large"
        onDismiss={() => setLinkedOpen(false)}
        onSubmit={() => {
          setShowLinkedErrors(true);
          if (Object.keys(linkedValidation).length) return;
          void quality
            .createLinkedDefect(item, linkedDraft)
            .then(() => {
              setLinkedOpen(false);
              setError(undefined);
            })
            .catch((reason) => setError(toUserSafeErrorMessage(reason)));
        }}
        validationIssues={
          showLinkedErrors
            ? Object.keys(linkedValidation).map((key) => ({
                key,
                message: linkedValidation[key] ?? "Invalid value.",
              }))
            : []
        }
      >
        <QualityItemForm
          draft={linkedDraft}
          errors={showLinkedErrors ? linkedValidation : {}}
          onChange={setLinkedDraft}
          onResolvePeople={(query) => people.search(query)}
        />
      </FormPanel>
      <ReasonDialog
        open={Boolean(reasonTarget)}
        title={`${reasonTarget ?? "Conclude"} quality item`}
        actionLabel={reasonTarget ?? "Save"}
        onDismiss={() => setReasonTarget(undefined)}
        onSubmit={(reason) => {
          if (reasonTarget)
            void act(() => quality.conclude(item, reasonTarget, reason));
          setReasonTarget(undefined);
        }}
      />
    </ContentContainer>
  );
};
