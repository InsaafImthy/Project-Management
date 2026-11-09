import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import {
  DashboardLayout,
  DashboardSection,
  EntityListPage,
  FormDialog,
  FormRow,
  KpiCard,
  KpiGrid,
  ReasonDialog,
  SummaryCard,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  CheckboxInput,
  DateDisplay,
  DateInput,
  HoursDisplay,
  LoadingSkeleton,
  NumberInput,
  SelectInput,
  StatusBadge,
  TextArea,
  TextInput,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import type { IPmoTimeEntry } from "../../../models/domain";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import type { ITimeEntryDraft } from "../../../services/domain/TimeManagementService";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { TIME_ROUTES } from "../routes";

const iso = (date: Date): string => date.toISOString().slice(0, 10);
const blank = (date: Date): ITimeEntryDraft => ({
  workDate: iso(date),
  workCategory: "Project Task",
  hours: 0,
  workPerformed: "",
  isBillable: true,
});
const toDraft = (entry: IPmoTimeEntry): ITimeEntryDraft => ({
  workDate: iso(entry.workDate),
  projectId: entry.projectId,
  projectCode: entry.projectCode,
  workItemId: entry.workItemId,
  workCategory: entry.workCategory,
  hours: entry.hours,
  workPerformed: entry.workPerformed,
  progressPercent: entry.progressPercent,
  blockerSummary: entry.blockerSummary,
  isBillable: entry.isBillable,
  correctionReason: entry.correctionReason,
});

const TimeEntryDialog = ({
  open,
  entry,
  date,
  onDismiss,
  onSaved,
}: {
  readonly open: boolean;
  readonly entry?: IPmoTimeEntry;
  readonly date: Date;
  readonly onDismiss: () => void;
  readonly onSaved: () => void;
}): React.ReactElement => {
  const { time } = usePmoServices();
  const interactions = usePmoInteractions();
  const [draft, setDraft] = React.useState<ITimeEntryDraft>(blank(date));
  const [saving, setSaving] = React.useState(false);
  const [eligible, setEligible] = React.useState<Awaited<
    ReturnType<typeof time.eligibleWork>
  > | null>(null);
  React.useEffect(() => {
    if (open) setDraft(entry ? toDraft(entry) : blank(date));
  }, [open, entry, date]);
  React.useEffect(() => {
    if (!open) return;
    void time
      .eligibleWork(new Date(`${draft.workDate}T00:00:00`))
      .then(setEligible);
  }, [open, time, draft.workDate]);
  const update = <K extends keyof ITimeEntryDraft>(
    key: K,
    value: ITimeEntryDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const result = await time.save(draft, entry);
      result.warnings.forEach((text) =>
        interactions.publishMessage({ tone: "warning", text }),
      );
      interactions.publishMessage({
        tone: "success",
        text: "Time entry saved.",
      });
      onSaved();
      onDismiss();
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };
  const projectNeeded =
    draft.workCategory === "Project Task" ||
    draft.workCategory === "Project Support";
  const projects = Array.from(
    new Map([
      ...(eligible?.memberships ?? []).map(
        (member) => [member.projectId, member.projectCode] as const,
      ),
      ...(eligible?.workItems ?? []).map(
        (item) => [item.projectId, item.projectCode] as const,
      ),
    ]).entries(),
  );
  return (
    <FormDialog
      open={open}
      title={entry ? "Edit time entry" : "Add time entry"}
      onDismiss={onDismiss}
      onSubmit={save}
      saving={saving}
      submitLabel="Save entry"
    >
      <FormRow>
        <DateInput
          label="Work date"
          value={draft.workDate}
          max={iso(new Date())}
          required
          onChange={(value) => update("workDate", value)}
        />
        <NumberInput
          label="Hours"
          value={draft.hours}
          min={0}
          precision={2}
          required
          onChange={(value) => update("hours", value ?? 0)}
        />
      </FormRow>
      <SelectInput
        label="Work category"
        value={draft.workCategory}
        options={PMO_CHOICES.timeEntries.workCategory.map((category) => ({
          key: category,
          text: category,
        }))}
        onChange={(value) =>
          update("workCategory", value as ITimeEntryDraft["workCategory"])
        }
      />
      {projectNeeded ? (
        <FormRow>
          <SelectInput
            label="Project"
            value={draft.projectId}
            required
            placeholder="Select an active eligible project"
            options={projects.map(([id, code]) => ({ key: id, text: code }))}
            onChange={(value) => {
              const id = typeof value === "number" ? value : Number(value);
              const project = projects.find(([candidate]) => candidate === id);
              setDraft((current) => ({
                ...current,
                projectId: id,
                projectCode: project?.[1],
                workItemId: undefined,
              }));
            }}
          />
        </FormRow>
      ) : null}
      {draft.workCategory === "Project Task" ? (
        <SelectInput
          label="Work item"
          value={draft.workItemId}
          required
          hint="Only active work assigned to you is eligible."
          placeholder="Select an assigned work item"
          options={(eligible?.workItems ?? [])
            .filter((item) => item.projectId === draft.projectId)
            .map((item) => ({
              key: item.id,
              text: `${item.workItemCode ?? item.id} — ${item.title}`,
            }))}
          onChange={(value) =>
            update(
              "workItemId",
              typeof value === "number" ? value : Number(value),
            )
          }
        />
      ) : null}
      <TextArea
        label="Work performed"
        value={draft.workPerformed}
        required
        onChange={(value) => update("workPerformed", value)}
      />
      <FormRow>
        <NumberInput
          label="Progress percent"
          value={draft.progressPercent}
          min={0}
          max={100}
          onChange={(value) => update("progressPercent", value)}
        />
        <CheckboxInput
          label="Billable"
          checked={draft.isBillable}
          onChange={(value) => update("isBillable", value)}
        />
      </FormRow>
      <TextArea
        label="Blocker summary"
        value={draft.blockerSummary}
        onChange={(value) => update("blockerSummary", value)}
      />
      {entry?.entryStatus === "Returned" ? (
        <TextArea
          label="Correction reason"
          required
          value={draft.correctionReason}
          onChange={(value) => update("correctionReason", value)}
        />
      ) : null}
    </FormDialog>
  );
};

const TimeTable = ({
  entries,
  onEdit,
}: {
  readonly entries: readonly IPmoTimeEntry[];
  readonly onEdit: (entry: IPmoTimeEntry) => void;
}): React.ReactElement => {
  const columns: readonly IDataTableColumn<IPmoTimeEntry>[] = [
    {
      key: "date",
      header: "Date",
      render: (entry) => <DateDisplay value={entry.workDate} />,
    },
    {
      key: "category",
      header: "Category",
      render: (entry) => entry.workCategory,
    },
    {
      key: "project",
      header: "Project",
      render: (entry) => entry.projectCode ?? "—",
    },
    {
      key: "hours",
      header: "Hours",
      render: (entry) => <HoursDisplay value={entry.hours} />,
    },
    {
      key: "work",
      header: "Work performed",
      render: (entry) => entry.workPerformed,
    },
    {
      key: "status",
      header: "Status",
      render: (entry) => <StatusBadge text={entry.entryStatus} />,
    },
  ];
  return (
    <EntityListPage
      title="Time entries"
      subtitle="Daily and weekly views reuse this same entry table and dialog."
      ariaLabel="Time entries"
      items={entries}
      columns={columns}
      getRowKey={(entry) => String(entry.id)}
      paging={{ pageIndex: 0, pageSize: 100, totalItems: entries.length }}
      onPageChange={() => undefined}
      getRowActions={(entry) =>
        entry.isLocked || entry.entryStatus === "Locked"
          ? []
          : [{ key: "edit", label: "Edit", onClick: () => onEdit(entry) }]
      }
    />
  );
};

export const MyTimePage = (): React.ReactElement => {
  const { time } = usePmoServices();
  const { route, navigate } = usePmoRoute();
  const interactions = usePmoInteractions();
  const weekly = route.view === TIME_ROUTES.weekly;
  const [dashboard, setDashboard] =
    React.useState<Awaited<ReturnType<typeof time.dashboard>>>();
  const [dialog, setDialog] = React.useState(false);
  const [editing, setEditing] = React.useState<IPmoTimeEntry>();
  const [version, setVersion] = React.useState(0);
  const selectedDate = route.query.date
    ? new Date(`${route.query.date}T00:00:00`)
    : new Date();
  React.useEffect(() => {
    void time
      .dashboard(selectedDate)
      .then(setDashboard)
      .catch((error) =>
        interactions.publishMessage({
          tone: "danger",
          text: toUserSafeErrorMessage(error),
        }),
      );
  }, [time, selectedDate.valueOf(), version]);
  if (!dashboard)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading time" />
      </ContentContainer>
    );
  const submit = async () => {
    try {
      await time.submitDay(selectedDate);
      interactions.publishMessage({
        tone: "success",
        text: "Day submitted for review.",
      });
      setVersion((value) => value + 1);
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title={weekly ? "Weekly time entry" : "My Time"}
          subtitle="Account for your workday with active work, approved learning, leave, and authorized activities."
          breadcrumbs={[{ text: "My work" }, { text: "My Time" }]}
          commands={
            <>
              <AppButton
                text="Add entry"
                variant="primary"
                onClick={() => {
                  setEditing(undefined);
                  setDialog(true);
                }}
              />
              <AppButton
                text={weekly ? "Daily view" : "Weekly view"}
                onClick={() =>
                  navigate({
                    view: weekly ? TIME_ROUTES.dashboard : TIME_ROUTES.weekly,
                    parameters: {},
                    query: {
                      view: weekly ? TIME_ROUTES.dashboard : TIME_ROUTES.weekly,
                      date: iso(selectedDate),
                    },
                  })
                }
              />
            </>
          }
        />
        <KpiGrid>
          <KpiCard
            title="Required today"
            value={<HoursDisplay value={dashboard.requiredHours} />}
          />
          <KpiCard
            title="Recorded"
            value={<HoursDisplay value={dashboard.recordedHours} />}
          />
          <KpiCard
            title="Missing"
            value={<HoursDisplay value={dashboard.missingHours} />}
          />
          <KpiCard
            title="Current week"
            value={<HoursDisplay value={dashboard.currentWeekHours} />}
          />
          <KpiCard title="Returned" value={dashboard.returnedEntries.length} />
          <KpiCard title="Locked" value={dashboard.lockedEntries.length} />
        </KpiGrid>
        <DashboardSection
          title="Daily accountability"
          commands={
            <AppButton
              text="Submit day"
              disabled={dashboard.missingHours > 0}
              onClick={() => void submit()}
            />
          }
        >
          <SummaryCard title="Submission status">
            <p>
              {dashboard.missingHours > 0
                ? `${dashboard.missingHours} hour(s) are still missing. Add a valid entry before submitting.`
                : "Your day meets the configured requirement and can be submitted."}
            </p>
          </SummaryCard>
        </DashboardSection>
        <TimeTable
          entries={weekly ? dashboard.weekEntries : dashboard.entries}
          onEdit={(entry) => {
            setEditing(entry);
            setDialog(true);
          }}
        />
      </DashboardLayout>
      <TimeEntryDialog
        open={dialog}
        entry={editing}
        date={selectedDate}
        onDismiss={() => setDialog(false)}
        onSaved={() => setVersion((value) => value + 1)}
      />
    </ContentContainer>
  );
};

export const TimeReviewPage = (): React.ReactElement => {
  const { time } = usePmoServices();
  const { route } = usePmoRoute();
  const interactions = usePmoInteractions();
  const projectId = Number(route.query.projectId);
  const [entries, setEntries] = React.useState<readonly IPmoTimeEntry[]>();
  const [reasonAction, setReasonAction] = React.useState<{
    entry: IPmoTimeEntry;
    action: "Return" | "Reopen";
  }>();
  const reload = () => {
    if (projectId)
      void time
        .reviewEntries(
          projectId,
          new Date(route.query.from ?? "2026-01-01"),
          new Date(route.query.to ?? "2099-12-31"),
        )
        .then(setEntries)
        .catch((error) =>
          interactions.publishMessage({
            tone: "danger",
            text: toUserSafeErrorMessage(error),
          }),
        );
  };
  React.useEffect(reload, [projectId, route.query.from, route.query.to]);
  const act = async (entry: IPmoTimeEntry, action: "Approve" | "Lock") => {
    try {
      await time.review(entry, action);
      reload();
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  const columns: readonly IDataTableColumn<IPmoTimeEntry>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (entry) => entry.employeeUser.displayName,
    },
    {
      key: "date",
      header: "Date",
      render: (entry) => <DateDisplay value={entry.workDate} />,
    },
    {
      key: "project",
      header: "Project",
      render: (entry) => entry.projectCode ?? "—",
    },
    {
      key: "hours",
      header: "Hours",
      render: (entry) => <HoursDisplay value={entry.hours} />,
    },
    {
      key: "status",
      header: "Status",
      render: (entry) => <StatusBadge text={entry.entryStatus} />,
    },
  ];
  return (
    <ContentContainer>
      <PageHeader
        title="Manager time review"
        subtitle="Project-scoped time is visible only to authorized project managers and time approvers."
        breadcrumbs={[{ text: "Reviews" }, { text: "Time" }]}
      />
      <TextInput
        label="Project ID"
        value={route.query.projectId ?? ""}
        readOnly
        hint="Open this view from an authorized project time drill-down."
      />
      {entries ? (
        <EntityListPage
          title="Reviewed entries"
          subtitle="Filter dates through the URL's from and to parameters."
          ariaLabel="Manager time review"
          items={entries}
          columns={columns}
          getRowKey={(entry) => String(entry.id)}
          paging={{ pageIndex: 0, pageSize: 200, totalItems: entries.length }}
          onPageChange={() => undefined}
          getRowActions={(entry) => [
            {
              key: "approve",
              label: "Approve",
              onClick: () => void act(entry, "Approve"),
            },
            {
              key: "return",
              label: "Return",
              onClick: () => setReasonAction({ entry, action: "Return" }),
            },
            {
              key: "lock",
              label: "Lock",
              onClick: () => void act(entry, "Lock"),
            },
          ]}
        />
      ) : (
        <LoadingSkeleton label="Loading review entries" />
      )}
      <ReasonDialog
        open={Boolean(reasonAction)}
        title="Return or reopen time"
        actionLabel={reasonAction?.action ?? "Return"}
        onDismiss={() => setReasonAction(undefined)}
        onSubmit={(reason) => {
          if (reasonAction)
            void time
              .review(reasonAction.entry, reasonAction.action, reason)
              .then(reload);
          setReasonAction(undefined);
        }}
      />
    </ContentContainer>
  );
};
