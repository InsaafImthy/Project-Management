import * as React from "react";
import {
  DashboardLayout,
  DashboardSection,
  EntityDetailLayout,
  EntityListPage,
  FormDialog,
  FormRow,
  KpiCard,
  KpiGrid,
  Timeline,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  DateDisplay,
  EmptyState,
  HoursDisplay,
  LoadingSkeleton,
  NumberInput,
  PercentageDisplay,
  PriorityBadge,
  Stack,
  StatusBadge,
  TextArea,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import type { IPmoTaskAction, IPmoWorkItem } from "../../../models/domain";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import type { ITaskActionInput } from "../../../services/domain/DomainRules";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { WORK_ROUTES } from "../routes";

const actionOptions = (
  item: IPmoWorkItem,
): readonly ITaskActionInput["actionType"][] => {
  switch (item.status) {
    case "Assigned":
      return ["Accept", "Return", "Comment"];
    case "Ready":
      return ["Start", "Comment"];
    case "In Progress":
      return ["Progress Update", "Block", "Submit for Review", "Comment"];
    case "Blocked":
      return ["Unblock", "Progress Update", "Comment"];
    case "Submitted for Review":
    case "In Review":
    case "Accepted":
      return ["Reopen Request", "Comment"];
    default:
      return ["Comment"];
  }
};

const ActionDialog = ({
  item,
  open,
  onDismiss,
  onApplied,
}: {
  readonly item: IPmoWorkItem;
  readonly open: boolean;
  readonly onDismiss: () => void;
  readonly onApplied: () => void;
}): React.ReactElement => {
  const { work } = usePmoServices();
  const interactions = usePmoInteractions();
  const [actionType, setActionType] =
    React.useState<ITaskActionInput["actionType"]>("Comment");
  const [comment, setComment] = React.useState("");
  const [progressPercent, setProgressPercent] = React.useState<number>();
  const [remainingEffortHours, setRemainingEffortHours] =
    React.useState<number>();
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setActionType(actionOptions(item)[0] ?? "Comment");
      setComment("");
      setProgressPercent(item.percentComplete);
      setRemainingEffortHours(undefined);
    }
  }, [open, item]);
  const apply = async () => {
    setSaving(true);
    try {
      const result = await work.request(item.id, {
        actionType,
        comment,
        progressPercent,
        remainingEffortHours,
      });
      interactions.publishMessage({
        tone:
          result.processingStatus === "Applied"
            ? "success"
            : result.processingStatus === "Rejected"
              ? "warning"
              : "danger",
        text:
          result.resultMessage ?? `Task Action is ${result.processingStatus}.`,
      });
      onApplied();
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
  return (
    <FormDialog
      open={open}
      title={`Task action: ${item.title}`}
      onDismiss={onDismiss}
      onSubmit={apply}
      saving={saving}
      submitLabel={actionType}
    >
      <label>
        Action{" "}
        <select
          value={actionType}
          onChange={(event) =>
            setActionType(event.target.value as ITaskActionInput["actionType"])
          }
        >
          {actionOptions(item).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {actionType === "Progress Update" ? (
        <FormRow>
          <NumberInput
            label="Progress percent"
            required
            value={progressPercent}
            min={0}
            max={100}
            onChange={setProgressPercent}
          />
          <NumberInput
            label="Remaining effort hours"
            required
            value={remainingEffortHours}
            min={0}
            precision={2}
            onChange={setRemainingEffortHours}
          />
        </FormRow>
      ) : null}
      <TextArea
        label={
          actionType === "Submit for Review"
            ? "Work summary and evidence link"
            : "Comment"
        }
        required={
          [
            "Return",
            "Block",
            "Unblock",
            "Submit for Review",
            "Reopen Request",
          ].indexOf(actionType) >= 0
        }
        hint="Document links can be pasted now; project-library selection is completed in Stage 12."
        value={comment}
        onChange={setComment}
      />
    </FormDialog>
  );
};

const WorkTable = ({
  items,
  onOpen,
}: {
  readonly items: readonly IPmoWorkItem[];
  readonly onOpen: (item: IPmoWorkItem) => void;
}): React.ReactElement => {
  const columns: readonly IDataTableColumn<IPmoWorkItem>[] = [
    {
      key: "code",
      header: "Code",
      render: (item) => item.workItemCode ?? `ID-${item.id}`,
    },
    {
      key: "task",
      header: "Task",
      render: (item) => <strong>{item.title}</strong>,
    },
    { key: "project", header: "Project", render: (item) => item.projectCode },
    {
      key: "due",
      header: "Due",
      render: (item) => <DateDisplay value={item.plannedEnd} />,
    },
    {
      key: "priority",
      header: "Priority",
      render: (item) => <PriorityBadge value={item.priority} />,
    },
    {
      key: "progress",
      header: "Progress",
      render: (item) => <PercentageDisplay value={item.percentComplete} />,
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge text={item.status} />,
    },
  ];
  return (
    <EntityListPage
      title="My assigned work"
      subtitle="Filtered server-side by your indexed Employee ID and active status."
      ariaLabel="My assigned work"
      items={items}
      columns={columns}
      getRowKey={(item) => String(item.id)}
      paging={{ pageIndex: 0, pageSize: 50, totalItems: items.length }}
      onPageChange={() => undefined}
      getRowActions={(item) => [
        { key: "open", label: "Open", onClick: () => onOpen(item) },
      ]}
    />
  );
};

export const MyWorkPage = (): React.ReactElement => {
  const { work } = usePmoServices();
  const { navigate } = usePmoRoute();
  const [items, setItems] = React.useState<readonly IPmoWorkItem[]>([]);
  const [actions, setActions] = React.useState<readonly IPmoTaskAction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const load = () => {
    setLoading(true);
    void Promise.all([work.myWork(), work.myActionHistory()])
      .then(
        ([tasks, history]) => {
          setItems(tasks.items);
          setActions(history.items);
        },
        () => undefined,
      )
      .then(() => setLoading(false));
  };
  React.useEffect(load, [work]);
  if (loading)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading My Work" />
      </ContentContainer>
    );
  const today = new Date();
  const dueSoon = items.filter(
    (item) =>
      item.plannedEnd &&
      item.plannedEnd <= new Date(today.valueOf() + 7 * 86400000) &&
      item.status !== "Accepted",
  ).length;
  const blocked = items.filter((item) => item.status === "Blocked").length;
  const pending = actions.filter(
    (action) => ["New", "Processing"].indexOf(action.processingStatus) >= 0,
  ).length;
  const returned = actions.filter(
    (action) => action.processingStatus === "Rejected",
  ).length;
  const open = (item: IPmoWorkItem) =>
    navigate({
      view: WORK_ROUTES.task,
      parameters: {
        workItemId: String(item.id),
        returnView: WORK_ROUTES.myWork,
      },
      query: {
        view: WORK_ROUTES.task,
        workItemId: String(item.id),
        returnView: WORK_ROUTES.myWork,
      },
    });
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="My Work"
          subtitle="Assigned tasks, action processing status and delivery commitments."
          breadcrumbs={[{ text: "My Work" }]}
        />
        <DashboardSection title="Today">
          <KpiGrid>
            <KpiCard title="Assigned tasks" value={items.length} />
            <KpiCard title="Due within 7 days" value={dueSoon} />
            <KpiCard title="Blocked tasks" value={blocked} />
            <KpiCard title="Pending Task Actions" value={pending} />
            <KpiCard title="Rejected Task Actions" value={returned} />
          </KpiGrid>
        </DashboardSection>
        <WorkTable items={items} onOpen={open} />
      </DashboardLayout>
    </ContentContainer>
  );
};

export const TaskDetailPage = (): React.ReactElement => {
  const { route, back } = usePmoRoute();
  const { work } = usePmoServices();
  const user = usePmoCurrentUser();
  const interactions = usePmoInteractions();
  const id = Number(route.parameters.workItemId);
  const [item, setItem] = React.useState<IPmoWorkItem>();
  const [history, setHistory] = React.useState<readonly IPmoTaskAction[]>([]);
  const [error, setError] = React.useState<string>();
  const [actionOpen, setActionOpen] = React.useState(false);
  const load = () => {
    if (!id) {
      setError("A work item ID is required.");
      return;
    }
    void Promise.all([work.get(id), work.history(id)])
      .then(([task, actions]) => {
        setItem(task);
        setHistory(actions.items);
      })
      .catch((caught) => setError(toUserSafeErrorMessage(caught)));
  };
  React.useEffect(load, [id, work]);
  if (error)
    return (
      <ContentContainer>
        <EmptyState title="Task unavailable" description={error} />
      </ContentContainer>
    );
  if (!item)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading task" />
      </ContentContainer>
    );
  const canAct =
    user.capabilities.indexOf("work.act-own") >= 0 &&
    item.assignedEmployeeId === user.employeeId;
  return (
    <ContentContainer>
      <EntityDetailLayout
        actions={
          <PageHeader
            title={item.title}
            subtitle={`${item.workItemCode ?? `ID-${item.id}`} · ${item.projectCode}`}
            breadcrumbs={[
              { text: "My Work", onClick: back },
              { text: item.title },
            ]}
            commands={
              canAct ? (
                <AppButton
                  variant="primary"
                  text="Task action"
                  onClick={() => setActionOpen(true)}
                />
              ) : undefined
            }
          />
        }
        summary={
          <Stack direction="horizontal" gap="lg" wrap>
            <StatusBadge text={item.status} />
            <PriorityBadge value={item.priority} />
            <PercentageDisplay value={item.percentComplete} />
            <HoursDisplay value={item.forecastEffortHours} />
          </Stack>
        }
        sections={[
          {
            key: "details",
            title: "Task details",
            content: (
              <Stack gap="sm">
                <p>{item.description ?? "No description"}</p>
                <p>
                  <strong>Acceptance criteria:</strong>{" "}
                  {item.acceptanceCriteria ?? "Not set"}
                </p>
                <p>
                  <strong>Planned:</strong>{" "}
                  <DateDisplay value={item.plannedStart} /> to{" "}
                  <DateDisplay value={item.plannedEnd} />
                </p>
                <p>
                  <strong>Reviewer:</strong>{" "}
                  {item.reviewer?.displayName ?? "Not assigned"};{" "}
                  <strong>QA:</strong>{" "}
                  {item.qaRequired
                    ? (item.qaOwner?.displayName ?? "Owner missing")
                    : "Not required"}
                </p>
              </Stack>
            ),
          },
          {
            key: "actions",
            title: "Task Action history",
            content: (
              <Timeline
                ariaLabel="Task Action history"
                items={history.map((action) => ({
                  key: String(action.id),
                  title: `${action.actionType} — ${action.processingStatus}`,
                  actor: action.requestedBy.displayName,
                  detail: (
                    <>
                      {action.comment ?? action.resultMessage ?? "No comment"}
                      {action.processingStatus === "Failed" ? (
                        <AppButton
                          text="Retry"
                          onClick={() =>
                            void work
                              .retry(action.id)
                              .then(load)
                              .catch((caught) =>
                                interactions.publishMessage({
                                  tone: "danger",
                                  text: toUserSafeErrorMessage(caught),
                                }),
                              )
                          }
                        />
                      ) : null}
                    </>
                  ),
                  timestamp: (
                    <DateDisplay
                      value={action.processedOn ?? action.requestedOn}
                      includeTime
                    />
                  ),
                }))}
              />
            ),
          },
        ]}
      />
      <ActionDialog
        item={item}
        open={actionOpen}
        onDismiss={() => setActionOpen(false)}
        onApplied={load}
      />
    </ContentContainer>
  );
};

export const ReviewQueuePage = (): React.ReactElement => {
  const { work } = usePmoServices();
  const { navigate } = usePmoRoute();
  const interactions = usePmoInteractions();
  const [items, setItems] = React.useState<readonly IPmoWorkItem[]>([]);
  const [error, setError] = React.useState<string>();
  const load = () => {
    void Promise.all([work.reviewQueue(), work.qaQueue()])
      .then(([review, qa]) => setItems([...review.items, ...qa.items]))
      .catch((caught) => setError(toUserSafeErrorMessage(caught)));
  };
  React.useEffect(load, [work]);
  if (error)
    return (
      <ContentContainer>
        <EmptyState title="Review queue unavailable" description={error} />
      </ContentContainer>
    );
  const columns: readonly IDataTableColumn<IPmoWorkItem>[] = [
    { key: "task", header: "Task", render: (item) => item.title },
    {
      key: "submitted",
      header: "Submitted",
      render: (item) => <DateDisplay value={item.submittedOn} includeTime />,
    },
    {
      key: "owner",
      header: "Owner",
      render: (item) => item.assignedTo?.displayName ?? "Unassigned",
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge text={item.status} />,
    },
  ];
  const apply = (
    item: IPmoWorkItem,
    action: "Accept" | "Return" | "Request Clarification" | "Route to QA",
  ) => {
    const comment =
      action === "Accept" || action === "Route to QA"
        ? undefined
        : (window.prompt(`${action} comment`) ?? undefined);
    if ((action === "Return" || action === "Request Clarification") && !comment)
      return;
    void work
      .review(item.id, action, comment)
      .then(() => {
        interactions.publishMessage({
          tone: "success",
          text: `${action} applied.`,
        });
        load();
      })
      .catch((caught) =>
        interactions.publishMessage({
          tone: "danger",
          text: toUserSafeErrorMessage(caught),
        }),
      );
  };
  return (
    <ContentContainer>
      <EntityListPage
        title="Reviews"
        subtitle="Reviewer and QA queue. Submitted and accepted timestamps remain separate."
        ariaLabel="Review queue"
        items={items}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{ pageIndex: 0, pageSize: 50, totalItems: items.length }}
        onPageChange={() => undefined}
        getRowActions={(item) => [
          {
            key: "open",
            label: "Open",
            onClick: () =>
              navigate({
                view: WORK_ROUTES.task,
                parameters: {
                  workItemId: String(item.id),
                  returnView: WORK_ROUTES.reviews,
                },
                query: {
                  view: WORK_ROUTES.task,
                  workItemId: String(item.id),
                  returnView: WORK_ROUTES.reviews,
                },
              }),
          },
          {
            key: "accept",
            label: item.qaRequired ? "Route to QA" : "Accept",
            onClick: () =>
              apply(item, item.qaRequired ? "Route to QA" : "Accept"),
          },
          {
            key: "return",
            label: "Return",
            onClick: () => apply(item, "Return"),
          },
          {
            key: "clarify",
            label: "Clarify",
            onClick: () => apply(item, "Request Clarification"),
          },
        ]}
      />
    </ContentContainer>
  );
};
