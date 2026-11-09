import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import {
  DashboardLayout,
  DashboardSection,
  EntityListPage,
  FormPanel,
  FormRow,
  FormSection,
  KpiCard,
  KpiGrid,
  ReasonDialog,
  SummaryCard,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  DateDisplay,
  DateInput,
  EmptyState,
  LoadingSkeleton,
  MoneyDisplay,
  NumberInput,
  PercentageDisplay,
  SelectInput,
  Stack,
  StatusBadge,
  TextArea,
  TextInput,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import type {
  IPmoEmployeeRate,
  IPmoProjectCost,
  IPmoProjectFinancials,
} from "../../../models/domain";
import type {
  IEmployeeRateDraft,
  IManualProjectCostDraft,
  IProjectFinancialDraft,
  RateView,
} from "../../../services/domain/FinancialManagementService";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { FINANCE_ROUTES } from "../routes";

const today = (): string => new Date().toISOString().slice(0, 10);

const useConfidentialCleanup = (): void => {
  const { finance } = usePmoServices();
  React.useEffect(() => () => finance.clearConfidentialData(), [finance]);
};

const navigateTo = (
  navigate: ReturnType<typeof usePmoRoute>["navigate"],
  view: string,
  filters: Readonly<Record<string, string>> = {},
): void => {
  navigate({ view, parameters: {}, query: { view, ...filters } });
};

export const FinanceDashboardPage = (): React.ReactElement => {
  const { finance } = usePmoServices();
  const user = usePmoCurrentUser();
  const { navigate } = usePmoRoute();
  const [data, setData] =
    React.useState<Awaited<ReturnType<typeof finance.dashboard>>>();
  const [error, setError] = React.useState<string>();
  useConfidentialCleanup();
  React.useEffect(() => {
    let active = true;
    finance
      .dashboard()
      .then((value) => active && setData(value))
      .catch((caught) => active && setError(toUserSafeErrorMessage(caught)));
    return () => {
      active = false;
      setData(undefined);
    };
  }, [finance]);
  if (error)
    return (
      <ContentContainer>
        <EmptyState title="Finance dashboard unavailable" description={error} />
      </ContentContainer>
    );
  if (!data)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading restricted finance dashboard" />
      </ContentContainer>
    );
  const money = (value: number): React.ReactElement => (
    <MoneyDisplay value={value} currency={data.currencyCode} />
  );
  return (
    <ContentContainer>
      <PageHeader
        title="Finance dashboard"
        subtitle={`Restricted portfolio view. As of ${data.calculatedOn.toLocaleString()}.`}
        breadcrumbs={[{ text: "Restricted" }, { text: "Finance" }]}
      />
      <DashboardLayout>
        <KpiGrid>
          <KpiCard
            title="Portfolio value"
            value={money(data.portfolioValue)}
            onDrillDown={() =>
              navigateTo(navigate, FINANCE_ROUTES.projectFinancials)
            }
          />
          <KpiCard
            title="Actual cost"
            value={money(data.actualCost)}
            onDrillDown={() =>
              navigateTo(navigate, FINANCE_ROUTES.costs, { status: "Approved" })
            }
          />
          <KpiCard
            title="Forecast cost"
            value={money(data.forecastCost)}
            onDrillDown={() =>
              navigateTo(navigate, FINANCE_ROUTES.projectFinancials)
            }
          />
          <KpiCard
            title="Forecast contribution"
            value={money(data.forecastContribution)}
            helpText={
              data.forecastMarginPercent === undefined
                ? "Margin is not applicable when portfolio value is zero."
                : undefined
            }
            trend={
              <PercentageDisplay
                value={data.forecastMarginPercent}
                emptyText="Not applicable"
              />
            }
            onDrillDown={() =>
              navigateTo(navigate, FINANCE_ROUTES.projectFinancials)
            }
          />
          <KpiCard
            title="Below margin threshold"
            value={data.belowMarginThreshold}
            onDrillDown={() =>
              navigateTo(navigate, FINANCE_ROUTES.projectFinancials, {
                exception: "low-margin",
              })
            }
          />
          <KpiCard
            title="Missing rate"
            value={data.missingRate}
            onDrillDown={() =>
              navigateTo(navigate, FINANCE_ROUTES.costs, {
                queue: "missing-rate",
              })
            }
          />
          <KpiCard
            title="Missing value"
            value={data.missingValue}
            onDrillDown={() =>
              navigateTo(navigate, FINANCE_ROUTES.projectFinancials, {
                status: "Missing Value",
              })
            }
          />
          <KpiCard
            title="Unapproved costs"
            value={data.unapprovedCosts}
            onDrillDown={() =>
              navigateTo(navigate, FINANCE_ROUTES.costs, { status: "Draft" })
            }
          />
          <KpiCard
            title="Awaiting cost synchronization"
            value={data.awaitingCostSynchronization}
            onDrillDown={() =>
              navigateTo(navigate, FINANCE_ROUTES.costs, { queue: "sync" })
            }
          />
        </KpiGrid>
        <DashboardSection title="Restricted operations">
          <Stack direction="horizontal" gap="sm" wrap>
            <AppButton
              text="Employee rates"
              onClick={() => navigateTo(navigate, FINANCE_ROUTES.rates)}
            />
            <AppButton
              text="Project costs"
              onClick={() => navigateTo(navigate, FINANCE_ROUTES.costs)}
            />
            <AppButton
              text="Project financials"
              onClick={() =>
                navigateTo(navigate, FINANCE_ROUTES.projectFinancials)
              }
            />
            {user.capabilities.indexOf("finance.manage") >= 0 ? (
              <AppButton
                text="Initialize missing summaries"
                onClick={() => {
                  finance
                    .initializeMissingProjectFinancials()
                    .then(() => finance.dashboard())
                    .then(setData)
                    .catch((caught) =>
                      setError(toUserSafeErrorMessage(caught)),
                    );
                }}
              />
            ) : null}
          </Stack>
        </DashboardSection>
      </DashboardLayout>
    </ContentContainer>
  );
};

const blankRate = (): IEmployeeRateDraft => ({
  employeeId: 0,
  employeeNumber: "",
  employeeName: "",
  rateType: "Hourly",
  costRate: 0,
  currencyCode: "OMR",
  effectiveFrom: today(),
});

const rateDraft = (rate: IPmoEmployeeRate): IEmployeeRateDraft => ({
  employeeId: rate.employeeId,
  employeeNumber: rate.employeeNumber,
  employeeName: rate.employeeName,
  rateType: rate.rateType,
  costRate: rate.costRate,
  currencyCode: rate.currencyCode,
  effectiveFrom: rate.effectiveFrom.toISOString().slice(0, 10),
  effectiveTo: rate.effectiveTo?.toISOString().slice(0, 10),
  approvalReference: rate.approvalReference,
  notes: rate.notes,
});

export const EmployeeRatesPage = (): React.ReactElement => {
  const { finance } = usePmoServices();
  const user = usePmoCurrentUser();
  const interactions = usePmoInteractions();
  const [view, setView] = React.useState<RateView>("current");
  const [items, setItems] = React.useState<readonly IPmoEmployeeRate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [editing, setEditing] = React.useState<IPmoEmployeeRate>();
  const [replacing, setReplacing] = React.useState<IPmoEmployeeRate>();
  const [draft, setDraft] = React.useState<IEmployeeRateDraft>(blankRate());
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const canManage = user.capabilities.indexOf("finance.manage") >= 0;
  useConfidentialCleanup();
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setItems((await finance.listRates(view)).items);
    } catch (caught) {
      setError(toUserSafeErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [finance, view]);
  React.useEffect(() => {
    load().catch(() => undefined);
    return () => setItems([]);
  }, [load]);
  const openRate = (rate?: IPmoEmployeeRate, replace = false): void => {
    setEditing(replace ? undefined : rate);
    setReplacing(replace ? rate : undefined);
    setDraft(
      rate
        ? {
            ...rateDraft(rate),
            effectiveFrom: replace ? "" : rateDraft(rate).effectiveFrom,
            effectiveTo: undefined,
          }
        : blankRate(),
    );
    setOpen(true);
  };
  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      if (replacing) await finance.closeCurrentAndAdd(replacing, draft);
      else await finance.saveRate(draft, editing);
      setOpen(false);
      setEditing(undefined);
      setReplacing(undefined);
      interactions.publishMessage({
        tone: "success",
        text: "Rate record saved.",
      });
      await load();
    } catch (caught) {
      setError(toUserSafeErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };
  const columns: readonly IDataTableColumn<IPmoEmployeeRate>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (item) => item.employeeName,
    },
    { key: "type", header: "Rate type", render: (item) => item.rateType },
    {
      key: "rate",
      header: "Cost rate",
      align: "right",
      render: (item) => (
        <MoneyDisplay value={item.costRate} currency={item.currencyCode} />
      ),
    },
    {
      key: "from",
      header: "Effective from",
      render: (item) => <DateDisplay value={item.effectiveFrom} />,
    },
    {
      key: "to",
      header: "Effective to",
      render: (item) => (
        <DateDisplay value={item.effectiveTo} emptyText="Open ended" />
      ),
    },
    {
      key: "approval",
      header: "Approval reference",
      render: (item) => item.approvalReference ?? "Not set",
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        title="Employee rates"
        subtitle="Restricted effective-dated cost rates. Historical project costs are not recalculated by rate maintenance."
        breadcrumbs={[{ text: "Finance" }, { text: "Employee rates" }]}
        ariaLabel="Employee rates"
        items={items}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{ pageIndex: 0, pageSize: 50, totalItems: items.length }}
        onPageChange={() => undefined}
        loading={loading}
        errorMessage={error}
        onRetry={load}
        onCreate={canManage ? () => openRate() : undefined}
        createLabel="Add rate"
        filterSlot={
          <SelectInput
            label="Rate view"
            value={view}
            options={[
              { key: "current", text: "Current rates" },
              { key: "future", text: "Future rates" },
              { key: "expired", text: "Expired rates" },
            ]}
            onChange={(value) => setView(value as RateView)}
          />
        }
        getRowActions={
          canManage
            ? (item) => [
                { key: "edit", label: "Edit", onClick: () => openRate(item) },
                ...(item.isCurrent
                  ? [
                      {
                        key: "replace",
                        label: "Close and add new",
                        onClick: () => openRate(item, true),
                      },
                    ]
                  : []),
              ]
            : undefined
        }
      />
      <FormPanel
        open={open}
        title={
          replacing
            ? "Close current rate and add replacement"
            : editing
              ? "Edit rate"
              : "Add rate"
        }
        onDismiss={() => setOpen(false)}
        onSubmit={save}
        saving={saving}
      >
        <FormSection title="Employee and basis">
          <FormRow>
            <NumberInput
              label="Employee ID"
              required
              min={1}
              value={draft.employeeId || undefined}
              onChange={(value) =>
                setDraft({ ...draft, employeeId: value ?? 0 })
              }
              disabled={Boolean(editing || replacing)}
            />
            <TextInput
              label="Employee number"
              required
              value={draft.employeeNumber}
              onChange={(value) =>
                setDraft({ ...draft, employeeNumber: value })
              }
              readOnly={Boolean(editing || replacing)}
            />
            <TextInput
              label="Employee name"
              required
              value={draft.employeeName}
              onChange={(value) => setDraft({ ...draft, employeeName: value })}
              readOnly={Boolean(editing || replacing)}
            />
          </FormRow>
          <FormRow>
            <SelectInput
              label="Rate type"
              required
              value={draft.rateType}
              options={PMO_CHOICES.employeeRates.rateType.map((value) => ({
                key: value,
                text: value,
              }))}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  rateType: value as IPmoEmployeeRate["rateType"],
                })
              }
              disabled={Boolean(replacing)}
            />
            <NumberInput
              label="Cost rate"
              required
              min={0}
              precision={2}
              value={draft.costRate}
              onChange={(value) => setDraft({ ...draft, costRate: value ?? 0 })}
            />
            <TextInput
              label="Currency code"
              required
              value={draft.currencyCode}
              onChange={(value) => setDraft({ ...draft, currencyCode: value })}
            />
          </FormRow>
        </FormSection>
        <FormSection title="Effective period and approval">
          <FormRow>
            <DateInput
              label="Effective from"
              required
              value={draft.effectiveFrom}
              onChange={(value) => setDraft({ ...draft, effectiveFrom: value })}
            />
            <DateInput
              label="Effective to"
              value={draft.effectiveTo}
              onChange={(value) =>
                setDraft({ ...draft, effectiveTo: value || undefined })
              }
              disabled={Boolean(replacing)}
            />
          </FormRow>
          <TextInput
            label="Approval reference"
            value={draft.approvalReference}
            onChange={(value) =>
              setDraft({ ...draft, approvalReference: value })
            }
          />
          <TextArea
            label="Notes"
            value={draft.notes}
            onChange={(value) => setDraft({ ...draft, notes: value })}
          />
        </FormSection>
      </FormPanel>
    </ContentContainer>
  );
};

const blankCost = (): IManualProjectCostDraft => ({
  projectId: 0,
  projectCode: "",
  costType: "Vendor",
  costDate: today(),
  amount: 0,
  currencyCode: "OMR",
  description: "",
});

export const ProjectCostsPage = (): React.ReactElement => {
  const { finance } = usePmoServices();
  const user = usePmoCurrentUser();
  const { route } = usePmoRoute();
  const interactions = usePmoInteractions();
  const [items, setItems] = React.useState<readonly IPmoProjectCost[]>([]);
  const [missing, setMissing] = React.useState<
    Awaited<
      ReturnType<typeof finance.previewLaborSynchronization>
    >["missingRates"]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [costType, setCostType] = React.useState<IPmoProjectCost["costType"]>();
  const [costStatus, setCostStatus] = React.useState<
    IPmoProjectCost["costStatus"] | undefined
  >(
    PMO_CHOICES.projectCosts.costStatus.indexOf(
      route.query.status as IPmoProjectCost["costStatus"],
    ) >= 0
      ? (route.query.status as IPmoProjectCost["costStatus"])
      : undefined,
  );
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [draft, setDraft] =
    React.useState<IManualProjectCostDraft>(blankCost());
  const [reversing, setReversing] = React.useState<IPmoProjectCost>();
  const canManage = user.capabilities.indexOf("finance.manage") >= 0;
  useConfidentialCleanup();
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const projectId = Number(route.query.projectId) || undefined;
      const [page, preview] = await Promise.all([
        finance.listCosts({
          projectId,
          costType,
          costStatus,
          dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined,
          dateTo: dateTo ? new Date(`${dateTo}T23:59:59`) : undefined,
        }),
        finance.previewLaborSynchronization(),
      ]);
      setItems(page.items);
      setMissing(preview.missingRates);
      setError(undefined);
    } catch (caught) {
      setError(toUserSafeErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [costStatus, costType, dateFrom, dateTo, finance, route.query.projectId]);
  React.useEffect(() => {
    load().catch(() => undefined);
    return () => {
      setItems([]);
      setMissing([]);
    };
  }, [load]);
  const save = async (): Promise<void> => {
    try {
      await finance.createManualCost(draft);
      setFormOpen(false);
      setDraft(blankCost());
      interactions.publishMessage({
        tone: "success",
        text: "Cost transaction saved for approval.",
      });
      await load();
    } catch (caught) {
      setError(toUserSafeErrorMessage(caught));
    }
  };
  const sync = async (): Promise<void> => {
    try {
      const result = await finance.synchronizeLaborCosts();
      interactions.publishMessage({
        tone: result.missingRates.length ? "warning" : "success",
        text: result.missingRates.length
          ? "Labor synchronization completed with missing-rate items."
          : "Labor synchronization completed.",
      });
      await load();
    } catch (caught) {
      setError(toUserSafeErrorMessage(caught));
    }
  };
  const columns: readonly IDataTableColumn<IPmoProjectCost>[] = [
    { key: "number", header: "Cost number", render: (item) => item.costNumber },
    { key: "project", header: "Project", render: (item) => item.projectCode },
    { key: "type", header: "Type", render: (item) => item.costType },
    {
      key: "date",
      header: "Cost date",
      render: (item) => <DateDisplay value={item.costDate} />,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (item) => (
        <MoneyDisplay value={item.amount} currency={item.currencyCode} />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge text={item.costStatus} />,
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        title="Project costs"
        subtitle="Restricted labor and non-labor transactions with approval and reversal history."
        breadcrumbs={[{ text: "Finance" }, { text: "Project costs" }]}
        ariaLabel="Project costs"
        items={items}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{ pageIndex: 0, pageSize: 100, totalItems: items.length }}
        onPageChange={() => undefined}
        loading={loading}
        errorMessage={error}
        onRetry={load}
        onCreate={canManage ? () => setFormOpen(true) : undefined}
        createLabel="Add non-labor cost"
        filterSlot={
          <FormRow>
            <SelectInput
              label="Cost type"
              value={costType ?? "all"}
              options={[
                { key: "all", text: "All types" },
                ...PMO_CHOICES.projectCosts.costType.map((value) => ({
                  key: value,
                  text: value,
                })),
              ]}
              onChange={(value) =>
                setCostType(
                  value === "all"
                    ? undefined
                    : (value as IPmoProjectCost["costType"]),
                )
              }
            />
            <SelectInput
              label="Status"
              value={costStatus ?? "all"}
              options={[
                { key: "all", text: "All statuses" },
                ...PMO_CHOICES.projectCosts.costStatus.map((value) => ({
                  key: value,
                  text: value,
                })),
              ]}
              onChange={(value) =>
                setCostStatus(
                  value === "all"
                    ? undefined
                    : (value as IPmoProjectCost["costStatus"]),
                )
              }
            />
            <DateInput
              label="From date"
              value={dateFrom}
              onChange={setDateFrom}
            />
            <DateInput label="To date" value={dateTo} onChange={setDateTo} />
          </FormRow>
        }
        commands={
          canManage ? (
            <AppButton text="Synchronize approved time" onClick={sync} />
          ) : undefined
        }
        getRowActions={
          canManage
            ? (item) => [
                ...(item.costStatus === "Draft"
                  ? [
                      {
                        key: "approve",
                        label: "Approve",
                        onClick: async () => {
                          try {
                            await finance.approveCost(item);
                            interactions.publishMessage({
                              tone: "success",
                              text: "Cost approved.",
                            });
                            await load();
                          } catch (caught) {
                            setError(toUserSafeErrorMessage(caught));
                          }
                        },
                      },
                    ]
                  : []),
                ...(item.costStatus === "Approved"
                  ? [
                      {
                        key: "reverse",
                        label: "Reverse",
                        onClick: () => setReversing(item),
                      },
                    ]
                  : []),
              ]
            : undefined
        }
      />
      <SummaryCard title="Missing-rate queue">
        {missing.length ? (
          <ul>
            {missing.map((item) => (
              <li key={item.timeEntryId}>
                Time entry {item.timeEntryId} · Project {item.projectId} ·{" "}
                {item.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No missing-rate items are present in the current synchronization
            batch.
          </p>
        )}
      </SummaryCard>
      <FormPanel
        open={formOpen}
        title="Add non-labor cost"
        onDismiss={() => setFormOpen(false)}
        onSubmit={save}
      >
        <FormSection title="Project and transaction">
          <FormRow>
            <NumberInput
              label="Project ID"
              required
              min={1}
              value={draft.projectId || undefined}
              onChange={(value) =>
                setDraft({ ...draft, projectId: value ?? 0 })
              }
            />
            <TextInput
              label="Project code"
              required
              value={draft.projectCode}
              onChange={(value) => setDraft({ ...draft, projectCode: value })}
            />
            <SelectInput
              label="Cost type"
              value={draft.costType}
              options={PMO_CHOICES.projectCosts.costType
                .filter((value) => value !== "Labor")
                .map((value) => ({ key: value, text: value }))}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  costType: value as IManualProjectCostDraft["costType"],
                })
              }
            />
          </FormRow>
          <FormRow>
            <DateInput
              label="Cost date"
              required
              value={draft.costDate}
              onChange={(value) => setDraft({ ...draft, costDate: value })}
            />
            <NumberInput
              label="Amount"
              required
              min={0}
              precision={2}
              value={draft.amount}
              onChange={(value) => setDraft({ ...draft, amount: value ?? 0 })}
            />
            <TextInput
              label="Currency code"
              required
              value={draft.currencyCode}
              onChange={(value) => setDraft({ ...draft, currencyCode: value })}
            />
          </FormRow>
          <TextArea
            label="Description"
            required
            value={draft.description}
            onChange={(value) => setDraft({ ...draft, description: value })}
          />
        </FormSection>
      </FormPanel>
      <ReasonDialog
        open={Boolean(reversing)}
        title="Reverse approved cost"
        actionLabel="Reverse"
        minimumLength={3}
        onDismiss={() => setReversing(undefined)}
        onSubmit={(reason) => {
          const target = reversing;
          setReversing(undefined);
          if (target)
            finance
              .reverseCost(target, reason)
              .then(load)
              .then(() =>
                interactions.publishMessage({
                  tone: "success",
                  text: "Cost reversal recorded.",
                }),
              )
              .catch((caught) => setError(toUserSafeErrorMessage(caught)));
        }}
      />
    </ContentContainer>
  );
};

const financialDraft = (
  item: IPmoProjectFinancials,
): IProjectFinancialDraft => ({
  projectValue: item.projectValue,
  baselineCostBudget: item.baselineCostBudget,
  approvedCostBudget: item.approvedCostBudget,
});

export const ProjectFinancialsPage = (): React.ReactElement => {
  const { finance } = usePmoServices();
  const user = usePmoCurrentUser();
  const { route } = usePmoRoute();
  const interactions = usePmoInteractions();
  const [items, setItems] = React.useState<readonly IPmoProjectFinancials[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [editing, setEditing] = React.useState<IPmoProjectFinancials>();
  const [draft, setDraft] = React.useState<IProjectFinancialDraft>({});
  const canManage = user.capabilities.indexOf("finance.manage") >= 0;
  const projectId =
    Number(route.parameters.projectId ?? route.query.projectId) || undefined;
  useConfidentialCleanup();
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      if (projectId) {
        const item = await finance.getProjectFinancials(projectId);
        setItems(item ? [item] : []);
      } else if (user.capabilities.indexOf("finance.view") >= 0) {
        const status =
          PMO_CHOICES.projectFinancials.calculationStatus.indexOf(
            route.query.status as IPmoProjectFinancials["calculationStatus"],
          ) >= 0
            ? (route.query.status as IPmoProjectFinancials["calculationStatus"])
            : undefined;
        setItems((await finance.listFinancials(status)).items);
      } else {
        setError("Open financials from a project you manage.");
      }
    } catch (caught) {
      setError(toUserSafeErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [finance, projectId, route.query.status, user.capabilities]);
  React.useEffect(() => {
    load().catch(() => undefined);
    return () => setItems([]);
  }, [load]);
  const save = async (): Promise<void> => {
    if (!editing) return;
    try {
      await finance.saveProjectFinancials(editing.projectId, draft);
      setEditing(undefined);
      interactions.publishMessage({
        tone: "success",
        text: "Project financial summary saved.",
      });
      await load();
    } catch (caught) {
      setError(toUserSafeErrorMessage(caught));
    }
  };
  const recalculate = async (item: IPmoProjectFinancials): Promise<void> => {
    try {
      await finance.recalculateProjectFinancials(item.projectId);
      interactions.publishMessage({
        tone: "success",
        text: "Project financial summary recalculated.",
      });
      await load();
    } catch (caught) {
      setError(toUserSafeErrorMessage(caught));
    }
  };
  const columns: readonly IDataTableColumn<IPmoProjectFinancials>[] = [
    { key: "project", header: "Project", render: (item) => item.projectCode },
    {
      key: "value",
      header: "Project value",
      align: "right",
      render: (item) => (
        <MoneyDisplay value={item.projectValue} currency={item.currencyCode} />
      ),
    },
    {
      key: "baseline",
      header: "Baseline budget",
      align: "right",
      render: (item) => (
        <MoneyDisplay
          value={item.baselineCostBudget}
          currency={item.currencyCode}
        />
      ),
    },
    {
      key: "approved",
      header: "Approved budget",
      align: "right",
      render: (item) => (
        <MoneyDisplay
          value={item.approvedCostBudget}
          currency={item.currencyCode}
        />
      ),
    },
    {
      key: "actual",
      header: "Actual cost",
      align: "right",
      render: (item) => (
        <MoneyDisplay value={item.actualCost} currency={item.currencyCode} />
      ),
    },
    {
      key: "forecast",
      header: "Forecast cost",
      align: "right",
      render: (item) => (
        <MoneyDisplay value={item.forecastCost} currency={item.currencyCode} />
      ),
    },
    {
      key: "margin",
      header: "Forecast margin",
      align: "right",
      render: (item) =>
        item.projectValue === 0 ? (
          "Not applicable"
        ) : (
          <PercentageDisplay value={item.forecastMarginPercent} />
        ),
    },
    {
      key: "status",
      header: "Calculation status",
      render: (item) => <StatusBadge text={item.calculationStatus} />,
    },
    {
      key: "calculated",
      header: "Last calculated",
      render: (item) => <DateDisplay value={item.calculatedOn} includeTime />,
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        title="Project financials"
        subtitle="Restricted project value, budgets, actual cost, forecast, contribution, and margin."
        breadcrumbs={[{ text: "Finance" }, { text: "Project financials" }]}
        ariaLabel="Project financial summaries"
        items={items}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{ pageIndex: 0, pageSize: 100, totalItems: items.length }}
        onPageChange={() => undefined}
        loading={loading}
        errorMessage={error}
        onRetry={load}
        onCreate={
          canManage && projectId && items.length === 0
            ? () => {
                finance
                  .saveProjectFinancials(projectId, {})
                  .then(load)
                  .then(() =>
                    interactions.publishMessage({
                      tone: "success",
                      text: "Project financial summary created.",
                    }),
                  )
                  .catch((caught) => setError(toUserSafeErrorMessage(caught)));
              }
            : undefined
        }
        createLabel="Create financial summary"
        getRowActions={
          canManage
            ? (item) => [
                {
                  key: "edit",
                  label: "Edit value and budgets",
                  onClick: () => {
                    setEditing(item);
                    setDraft(financialDraft(item));
                  },
                },
                {
                  key: "recalculate",
                  label: "Recalculate",
                  onClick: () => recalculate(item),
                },
              ]
            : undefined
        }
      />
      <FormPanel
        open={Boolean(editing)}
        title="Edit project value and budgets"
        onDismiss={() => setEditing(undefined)}
        onSubmit={save}
      >
        <FormSection title="Authorized financial inputs">
          <FormRow>
            <NumberInput
              label="Project value"
              min={0}
              precision={2}
              value={draft.projectValue}
              onChange={(value) => setDraft({ ...draft, projectValue: value })}
            />
            <NumberInput
              label="Baseline cost budget"
              min={0}
              precision={2}
              value={draft.baselineCostBudget}
              onChange={(value) =>
                setDraft({ ...draft, baselineCostBudget: value })
              }
            />
            <NumberInput
              label="Approved cost budget"
              min={0}
              precision={2}
              value={draft.approvedCostBudget}
              onChange={(value) =>
                setDraft({ ...draft, approvedCostBudget: value })
              }
            />
          </FormRow>
        </FormSection>
      </FormPanel>
    </ContentContainer>
  );
};
