import * as React from "react";
import {
  DashboardLayout,
  DashboardSection,
  EntityListPage,
  FormPanel,
  FormRow,
  FormSection,
  KpiCard,
  KpiGrid,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  CheckboxInput,
  DateDisplay,
  DateInput,
  EmptyState,
  HoursDisplay,
  LoadingSkeleton,
  NumberInput,
  PriorityBadge,
  SelectInput,
  Stack,
  StatusBadge,
  TextArea,
  TextInput,
} from "../../../components/primitives";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import type {
  IPmoEmployee,
  IPmoProject,
  IPmoWorkItem,
} from "../../../models/domain";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import type { IWorkItemDraft } from "../../../services/domain/PlanningService";
import { PLANNING_ROUTES } from "../routes";

const dateInput = (value?: Date): string =>
  value?.toISOString().slice(0, 10) ?? "";
const emptyDraft = (
  type: IPmoWorkItem["itemType"] = "Task",
): IWorkItemDraft => ({
  title: "",
  itemType: type,
  qaRequired: false,
  priority: "Normal",
  dependencyIds: [],
  isCritical: false,
});
const draftFrom = (
  item: IPmoWorkItem,
  employees: readonly IPmoEmployee[],
): IWorkItemDraft => ({
  title: item.title,
  itemType: item.itemType,
  parentWorkItemId: item.parentWorkItemId,
  description: item.description,
  assignedEmployee: employees.find(
    (employee) => employee.id === item.assignedEmployeeId,
  ),
  reviewer: item.reviewer,
  qaRequired: item.qaRequired,
  qaOwner: item.qaOwner,
  priority: item.priority,
  plannedStart: dateInput(item.plannedStart),
  plannedEnd: dateInput(item.plannedEnd),
  baselineEffortHours: item.baselineEffortHours,
  approvedEffortHours: item.approvedEffortHours,
  forecastEffortHours: item.forecastEffortHours,
  acceptanceCriteria: item.acceptanceCriteria,
  dependencyIds: item.dependencyIds,
  isCritical: item.isCritical,
});

const useProject = (projectId: number) => {
  const { projects } = usePmoServices();
  const [project, setProject] = React.useState<IPmoProject>();
  const [error, setError] = React.useState<string>();
  React.useEffect(() => {
    if (projectId)
      void projects
        .get(projectId)
        .then(setProject)
        .catch((e) => setError(toUserSafeErrorMessage(e)));
  }, [projectId, projects]);
  return { project, error };
};

const WorkItemEditor = ({
  project,
  items,
  employees,
  item,
  open,
  onDismiss,
  onSaved,
}: {
  readonly project: IPmoProject;
  readonly items: readonly IPmoWorkItem[];
  readonly employees: readonly IPmoEmployee[];
  readonly item?: IPmoWorkItem;
  readonly open: boolean;
  readonly onDismiss: () => void;
  readonly onSaved: () => void;
}): React.ReactElement => {
  const { planning, people } = usePmoServices();
  const interactions = usePmoInteractions();
  const [draft, setDraft] = React.useState<IWorkItemDraft>(() =>
    item ? draftFrom(item, employees) : emptyDraft(),
  );
  const [saving, setSaving] = React.useState(false);
  const [peopleOptions, setPeopleOptions] = React.useState<
    readonly { id: number; displayName: string }[]
  >([]);
  React.useEffect(() => {
    if (open) setDraft(item ? draftFrom(item, employees) : emptyDraft());
  }, [open, item, employees]);
  const searchPeople = async (query: string) =>
    setPeopleOptions(await people.search(query));
  const save = async () => {
    setSaving(true);
    try {
      item
        ? await planning.update(project, item, draft)
        : await planning.create(project, draft);
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
  const parentOptions = items.filter(
    (candidate) =>
      candidate.id !== item?.id && candidate.itemType !== "Subtask",
  );
  return (
    <FormPanel
      open={open}
      title={
        item
          ? `Edit ${item.workItemCode ?? item.title}`
          : `Create ${draft.itemType}`
      }
      onDismiss={onDismiss}
      onSubmit={save}
      saving={saving}
      width="large"
    >
      <FormSection title="Work breakdown">
        <FormRow>
          <SelectInput
            label="Item type"
            required
            value={draft.itemType}
            options={PMO_CHOICES.workItems.itemType.map((value) => ({
              key: value,
              text: value,
            }))}
            onChange={(value) =>
              setDraft({
                ...draft,
                itemType: value as IPmoWorkItem["itemType"],
              })
            }
          />
          <TextInput
            label="Title"
            required
            value={draft.title}
            onChange={(value) => setDraft({ ...draft, title: value })}
          />
          <SelectInput
            label="Parent"
            value={draft.parentWorkItemId}
            placeholder="No parent"
            options={[
              { key: "", text: "No parent" },
              ...parentOptions.map((candidate) => ({
                key: candidate.id,
                text: `${candidate.workItemCode ?? candidate.id} — ${candidate.title}`,
              })),
            ]}
            onChange={(value) =>
              setDraft({
                ...draft,
                parentWorkItemId: value ? Number(value) : undefined,
              })
            }
          />
        </FormRow>
        <TextArea
          label="Description"
          value={draft.description}
          onChange={(value) => setDraft({ ...draft, description: value })}
        />
      </FormSection>
      <FormSection title="Accountability and schedule">
        <FormRow>
          <SelectInput
            label="Assigned employee"
            required={draft.itemType === "Task" || draft.itemType === "Subtask"}
            value={draft.assignedEmployee?.id}
            options={[
              { key: "", text: "Select an active employee" },
              ...employees.map((employee) => ({
                key: employee.id,
                text: employee.name,
              })),
            ]}
            onChange={(value) =>
              setDraft({
                ...draft,
                assignedEmployee: employees.find(
                  (employee) => employee.id === Number(value),
                ),
              })
            }
          />
          <SelectInput
            label="Reviewer"
            value={draft.reviewer?.id}
            options={[
              { key: "", text: "No reviewer" },
              ...peopleOptions.map((person) => ({
                key: person.id,
                text: person.displayName,
              })),
            ]}
            hint="Type a name below to find reviewer or QA owner."
            onChange={(value) =>
              setDraft({
                ...draft,
                reviewer: peopleOptions.find(
                  (person) => person.id === Number(value),
                ),
              })
            }
          />
          <TextInput
            label="Find people"
            onChange={(value) => {
              if (value.length >= 2) void searchPeople(value);
            }}
            hint="Searches SharePoint people; select from Reviewer or QA owner."
          />
          <DateInput
            label="Planned start"
            value={draft.plannedStart}
            onChange={(value) => setDraft({ ...draft, plannedStart: value })}
          />
          <DateInput
            label="Planned end or milestone due date"
            value={draft.plannedEnd}
            onChange={(value) => setDraft({ ...draft, plannedEnd: value })}
          />
        </FormRow>
        <CheckboxInput
          label="QA required"
          checked={draft.qaRequired}
          onChange={(value) => setDraft({ ...draft, qaRequired: value })}
        />
        {draft.qaRequired ? (
          <SelectInput
            label="QA owner"
            required
            value={draft.qaOwner?.id}
            options={[
              { key: "", text: "Select QA owner" },
              ...peopleOptions.map((person) => ({
                key: person.id,
                text: person.displayName,
              })),
            ]}
            onChange={(value) =>
              setDraft({
                ...draft,
                qaOwner: peopleOptions.find(
                  (person) => person.id === Number(value),
                ),
              })
            }
          />
        ) : null}
      </FormSection>
      <FormSection title="Plan controls">
        <FormRow>
          <SelectInput
            label="Priority"
            value={draft.priority}
            options={PMO_CHOICES.workItems.priority.map((value) => ({
              key: value,
              text: value,
            }))}
            onChange={(value) =>
              setDraft({
                ...draft,
                priority: value as IPmoWorkItem["priority"],
              })
            }
          />
          <NumberInput
            label="Baseline effort hours"
            value={draft.baselineEffortHours}
            min={0}
            precision={2}
            disabled={Boolean(item && project.currentPlanVersion > 0)}
            hint={
              item && project.currentPlanVersion > 0
                ? "Baseline is preserved after approval."
                : undefined
            }
            onChange={(value) =>
              setDraft({ ...draft, baselineEffortHours: value })
            }
          />
          <NumberInput
            label="Approved effort hours"
            value={draft.approvedEffortHours}
            min={0}
            precision={2}
            onChange={(value) =>
              setDraft({ ...draft, approvedEffortHours: value })
            }
          />
          <NumberInput
            label="Forecast effort hours"
            value={draft.forecastEffortHours}
            min={0}
            precision={2}
            onChange={(value) =>
              setDraft({ ...draft, forecastEffortHours: value })
            }
          />
        </FormRow>
        <CheckboxInput
          label="Critical work item"
          checked={draft.isCritical}
          onChange={(value) => setDraft({ ...draft, isCritical: value })}
        />
        <TextArea
          label="Acceptance criteria"
          required={draft.itemType === "Task"}
          value={draft.acceptanceCriteria}
          onChange={(value) =>
            setDraft({ ...draft, acceptanceCriteria: value })
          }
        />
        <fieldset>
          <legend>Dependencies from this project</legend>
          {items
            .filter((candidate) => candidate.id !== item?.id)
            .map((candidate) => (
              <label key={candidate.id}>
                <input
                  type="checkbox"
                  checked={draft.dependencyIds.indexOf(candidate.id) >= 0}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      dependencyIds: event.target.checked
                        ? [...draft.dependencyIds, candidate.id]
                        : draft.dependencyIds.filter(
                            (id) => id !== candidate.id,
                          ),
                    })
                  }
                />{" "}
                {candidate.workItemCode ?? candidate.id} — {candidate.title}
              </label>
            ))}
        </fieldset>
      </FormSection>
    </FormPanel>
  );
};

export const ProjectPlanPage = (): React.ReactElement => {
  const { route, navigate } = usePmoRoute();
  const { planning, projects } = usePmoServices();
  const interactions = usePmoInteractions();
  const projectId = Number(route.parameters.projectId);
  const { project, error } = useProject(projectId);
  const [items, setItems] = React.useState<readonly IPmoWorkItem[]>([]);
  const [employees, setEmployees] = React.useState<readonly IPmoEmployee[]>([]);
  const [editor, setEditor] = React.useState<{
    open: boolean;
    item?: IPmoWorkItem;
    type?: IPmoWorkItem["itemType"];
  }>({ open: false });
  const [expanded, setExpanded] = React.useState<ReadonlySet<number>>(
    new Set(),
  );
  const load = () => {
    if (projectId) {
      void planning.getPlan(projectId).then((values) => {
        setItems(values);
        setExpanded(
          new Set(
            values
              .filter((item) => item.itemType === "Phase")
              .map((item) => item.id),
          ),
        );
      });
      void projects
        .getCandidateEmployees()
        .then((page) => setEmployees(page.items));
    }
  };
  React.useEffect(load, [planning, projects, projectId]);
  if (error)
    return (
      <ContentContainer>
        <EmptyState title="Plan unavailable" description={error} />
      </ContentContainer>
    );
  if (!project)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading project plan" />
      </ContentContainer>
    );
  const validation = planning.validate(project, items);
  const filter = route.query.filter;
  const matchesFilter = (item: IPmoWorkItem): boolean => {
    switch (filter) {
      case "drafts":
        return item.status === "Draft";
      case "owners":
        return (
          (item.itemType === "Task" || item.itemType === "Subtask") &&
          !item.assignedTo
        );
      case "dates":
        return !item.plannedEnd;
      case "milestones":
        return item.itemType === "Milestone";
      case "critical":
        return item.isCritical;
      case "blocked":
        return item.status === "Blocked";
      case "reviews":
        return (
          [
            "Submitted for Review",
            "In Review",
            "Submitted to QA",
            "QA In Progress",
          ].indexOf(item.status) >= 0
        );
      case "effort":
        return item.itemType === "Task" || item.itemType === "Subtask";
      default:
        return true;
    }
  };
  const visible = items.filter(
    (item) =>
      (!item.phaseWorkItemId ||
        item.itemType === "Phase" ||
        expanded.has(item.phaseWorkItemId)) &&
      matchesFilter(item),
  );
  const columns: readonly IDataTableColumn<IPmoWorkItem>[] = [
    {
      key: "title",
      header: "Work breakdown",
      render: (item) => (
        <Stack direction="horizontal" gap="sm">
          <span
            style={{
              paddingLeft: `${item.itemType === "Subtask" ? 32 : item.itemType === "Task" || item.itemType === "Milestone" ? 16 : 0}px`,
            }}
          >
            {item.itemType === "Phase" ? (
              <AppButton
                variant="subtle"
                text={expanded.has(item.id) ? "Collapse" : "Expand"}
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    current.has(item.id)
                      ? next.delete(item.id)
                      : next.add(item.id);
                    return next;
                  })
                }
              />
            ) : null}
          </span>
          <strong>{item.title}</strong>
        </Stack>
      ),
    },
    { key: "type", header: "Type", render: (item) => item.itemType },
    {
      key: "owner",
      header: "Owner",
      render: (item) =>
        item.assignedTo?.displayName ??
        item.reviewer?.displayName ??
        "Unassigned",
    },
    {
      key: "dates",
      header: "Dates",
      render: (item) => (
        <>
          <DateDisplay value={item.plannedStart} /> –{" "}
          <DateDisplay value={item.plannedEnd} />
        </>
      ),
    },
    {
      key: "effort",
      header: "Approved effort",
      render: (item) => <HoursDisplay value={item.approvedEffortHours} />,
    },
    {
      key: "priority",
      header: "Priority",
      render: (item) => <PriorityBadge value={item.priority} />,
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge text={item.status} />,
    },
  ];
  const submit = async () => {
    const approver = employees.find((employee) => employee.isApprover);
    if (!approver) {
      interactions.publishMessage({
        tone: "danger",
        text: "Add or select an active approver before submitting the execution plan.",
      });
      return;
    }
    try {
      const approval = await planning.submitForExecutionPlanApproval(project, {
        ...approver.user,
        isApproverEligible: approver.isApprover,
        hasApproverRole: approver.isApprover,
        isOwner: false,
      });
      interactions.publishMessage({
        tone: "success",
        text: `Execution plan submitted as ${approval.approvalNumber}.`,
      });
    } catch (caught) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(caught),
      });
    }
  };
  return (
    <ContentContainer>
      <PageHeader
        title={`${project.title} plan`}
        subtitle="One governed work breakdown for phases, milestones, tasks and subtasks."
        breadcrumbs={[
          {
            text: "Projects",
            onClick: () =>
              navigate({
                view: "project-list",
                parameters: {},
                query: { view: "project-list" },
              }),
          },
          { text: project.title },
        ]}
        commands={
          <Stack direction="horizontal" gap="sm" wrap>
            {(["Phase", "Milestone", "Task", "Subtask"] as const).map(
              (type) => (
                <AppButton
                  key={type}
                  text={`Add ${type}`}
                  onClick={() => setEditor({ open: true, type })}
                />
              ),
            )}
            <AppButton
              variant="primary"
              text="Submit execution plan"
              disabled={validation.errors.length > 0}
              onClick={submit}
            />
          </Stack>
        }
      />
      <DashboardSection title="Plan validation">
        <p>
          {validation.approvedEffort} planned approved hours of{" "}
          {validation.projectApprovedEffort};{" "}
          {validation.remainingUnplannedEffort} remaining.
        </p>
        {validation.errors.map((message) => (
          <p key={message} role="alert">
            {message}
          </p>
        ))}
        {validation.warnings.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </DashboardSection>
      <EntityListPage
        title="Work items"
        subtitle="Server-filtered by project; pagination is retained by the repository."
        ariaLabel="Project work items"
        items={visible}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{ pageIndex: 0, pageSize: 200, totalItems: visible.length }}
        onPageChange={() => undefined}
        getRowActions={(item) => [
          {
            key: "edit",
            label: "Edit",
            onClick: () => setEditor({ open: true, item }),
          },
          {
            key: "resequence",
            label: "Move to root",
            onClick: () =>
              void planning
                .resequence(item)
                .then(load)
                .catch((e) =>
                  interactions.publishMessage({
                    tone: "danger",
                    text: toUserSafeErrorMessage(e),
                  }),
                ),
          },
        ]}
      />
      <WorkItemEditor
        project={project}
        items={items}
        employees={employees}
        item={editor.item}
        open={editor.open}
        onDismiss={() => setEditor({ open: false })}
        onSaved={load}
      />
    </ContentContainer>
  );
};

export const PlanningDashboardPage = (): React.ReactElement => {
  const { route, navigate } = usePmoRoute();
  const projectId = Number(route.parameters.projectId);
  const { project } = useProject(projectId);
  const { planning } = usePmoServices();
  const [items, setItems] = React.useState<readonly IPmoWorkItem[]>([]);
  React.useEffect(() => {
    if (projectId) void planning.getPlan(projectId).then(setItems);
  }, [planning, projectId]);
  if (!project)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading planning dashboard" />
      </ContentContainer>
    );
  const today = new Date();
  const soon = new Date(today);
  soon.setDate(today.getDate() + 14);
  const drill = (filter: string) =>
    navigate({
      view: PLANNING_ROUTES.plan,
      parameters: { projectId: String(projectId) },
      query: {
        view: PLANNING_ROUTES.plan,
        projectId: String(projectId),
        filter,
      },
    });
  const counts = {
    drafts: items.filter((item) => item.status === "Draft").length,
    owners: items.filter(
      (item) =>
        (item.itemType === "Task" || item.itemType === "Subtask") &&
        !item.assignedTo,
    ).length,
    dates: items.filter((item) => !item.plannedEnd).length,
    milestones: items.filter(
      (item) =>
        item.itemType === "Milestone" &&
        item.plannedEnd &&
        item.plannedEnd <= soon,
    ).length,
    critical: items.filter((item) => item.isCritical).length,
    blocked: items.filter((item) => item.status === "Blocked").length,
    reviews: items.filter(
      (item) =>
        [
          "Submitted for Review",
          "In Review",
          "Submitted to QA",
          "QA In Progress",
        ].indexOf(item.status) >= 0,
    ).length,
  };
  const effort = items
    .filter((item) => item.itemType === "Task" || item.itemType === "Subtask")
    .reduce((total, item) => total + (item.approvedEffortHours ?? 0), 0);
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="Planning dashboard"
          subtitle={`${project.title} planning readiness and delivery controls.`}
          breadcrumbs={[{ text: project.title }]}
        />
        <DashboardSection title="Plan readiness">
          <KpiGrid>
            {[
              ["Draft work items", counts.drafts, "drafts"],
              ["Tasks without owner", counts.owners, "owners"],
              ["Tasks without dates", counts.dates, "dates"],
              [
                "Planned versus approved effort",
                `${effort} / ${project.approvedEffortHours} h`,
                "effort",
              ],
              ["Milestones due soon", counts.milestones, "milestones"],
              ["Critical tasks", counts.critical, "critical"],
              ["Blocked tasks", counts.blocked, "blocked"],
              ["Awaiting review or QA", counts.reviews, "reviews"],
            ].map(([title, value, filter]) => (
              <KpiCard
                key={String(filter)}
                title={String(title)}
                value={value}
                onDrillDown={() => drill(String(filter))}
              />
            ))}
          </KpiGrid>
        </DashboardSection>
      </DashboardLayout>
    </ContentContainer>
  );
};
