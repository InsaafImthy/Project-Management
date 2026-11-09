import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import {
  ActionQueue,
  DashboardLayout,
  DashboardSection,
  EntityDetailLayout,
  EntityListPage,
  ExportMenu,
  FormActions,
  FormPageLayout,
  FormPanel,
  FormRow,
  FormSection,
  KpiCard,
  KpiGrid,
  ProgressSummary,
  QuickActions,
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
  NumberInput,
  PercentageDisplay,
  AvatarName,
  PersonInput,
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
  IPmoEmployee,
  IPmoPerson,
  IPmoProject,
  IPmoProjectMember,
} from "../../../models/domain";
import type { IProjectListFilters } from "../../../services/domain/ProjectManagementService";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { useFormState } from "../../../hooks/useFormState";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import { FilterBar } from "../../../components/composites";
import {
  IProjectDraft,
  IProjectMemberDraft,
  validateProjectDraft,
  validateProjectMemberDraft,
} from "../validation";
import { PROJECT_ROUTES } from "../routes";

const asDateInput = (date?: Date): string =>
  date?.toISOString().slice(0, 10) ?? "";
const personInput = (person?: IPmoPerson) =>
  person
    ? [
        {
          id: String(person.id),
          email: person.email ?? "",
          text: person.displayName,
        },
      ]
    : [];
const fromPicker = (
  items: readonly {
    readonly id: string;
    readonly email: string;
    readonly text?: string;
  }[],
): IPmoPerson | undefined => {
  const first = items[0];
  return first
    ? {
        id: Number(first.id),
        displayName: first.text ?? first.email,
        email: first.email,
      }
    : undefined;
};
const toDraft = (project?: IPmoProject): IProjectDraft => ({
  title: project?.title ?? "",
  projectType: project?.projectType ?? "Customer",
  customerName: project?.customerName,
  poReference: project?.poReference,
  description: project?.description ?? "",
  scopeSummary: project?.scopeSummary ?? "",
  exclusions: project?.exclusions,
  projectManager: project?.projectManager,
  sponsor: project?.sponsor,
  pmoOwner: project?.pmoOwner,
  priority: project?.priority ?? "Normal",
  plannedStart: asDateInput(project?.plannedStart),
  baselineEnd: asDateInput(project?.baselineEnd),
  baselineEffortHours: project?.baselineEffortHours ?? 0,
  currencyCode: project?.currencyCode ?? "USD",
  confidentiality: project?.confidentiality ?? "Internal",
});
const filtersFromQuery = (
  query: Readonly<Record<string, string>>,
): IProjectListFilters => ({
  status:
    PMO_CHOICES.projects.status.indexOf(
      query.status as IPmoProject["status"],
    ) >= 0
      ? (query.status as IPmoProject["status"])
      : undefined,
  overallHealth:
    PMO_CHOICES.projects.overallHealth.indexOf(
      query.health as IPmoProject["overallHealth"],
    ) >= 0
      ? (query.health as IPmoProject["overallHealth"])
      : undefined,
  atRisk: query.atRisk === "true" ? true : undefined,
  projectManagerId: query.manager ? Number(query.manager) : undefined,
  customerName: query.customer || undefined,
  isActive: query.active === "false" ? false : true,
  search: query.search || undefined,
});

const useProjectPage = (filters: IProjectListFilters) => {
  const { projects } = usePmoServices();
  const [items, setItems] = React.useState<readonly IPmoProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void projects
      .list(filters)
      .then(
        (page) => {
          if (active) setItems(page.items);
        },
        () => {
          if (active) setError("Projects could not be loaded.");
        },
      )
      .then(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projects, JSON.stringify(filters), version]);
  return {
    items,
    loading,
    error,
    reload: () => setVersion((value) => value + 1),
  };
};

export const ProjectDashboardPage = (): React.ReactElement => {
  const { projects } = usePmoServices();
  const user = usePmoCurrentUser();
  const { navigate } = usePmoRoute();
  const [summary, setSummary] =
    React.useState<Awaited<ReturnType<typeof projects.getDashboardSummary>>>();
  React.useEffect(() => {
    projects
      .getDashboardSummary()
      .then(setSummary)
      .catch(() => undefined);
  }, [projects]);
  const drill = (query: Record<string, string>) =>
    navigate({
      view: PROJECT_ROUTES.list,
      parameters: {},
      query: { view: PROJECT_ROUTES.list, ...query },
    });
  if (!summary)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading project dashboard" />
      </ContentContainer>
    );
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="Projects"
          subtitle="Portfolio health, project action queue, and governed onboarding."
          breadcrumbs={[{ text: "Projects" }]}
        />
        <DashboardSection title="Portfolio">
          <KpiGrid>
            <KpiCard
              title="Active projects"
              value={summary.active}
              onDrillDown={() => drill({ status: "Active" })}
            />
            <KpiCard
              title="Draft projects"
              value={summary.drafts}
              onDrillDown={() => drill({ status: "Draft" })}
            />
            <KpiCard
              title="Pending baseline approval"
              value={summary.pendingBaseline}
              onDrillDown={() => drill({ status: "Pending Baseline Approval" })}
            />
            <KpiCard
              title="At risk"
              value={summary.atRisk}
              helpText="Amber and Red health"
              onDrillDown={() => drill({ atRisk: "true" })}
            />
            <KpiCard
              title="Ending soon"
              value={summary.endingSoon}
              onDrillDown={() =>
                drill({ status: "Active", endingSoon: "true" })
              }
            />
            <KpiCard
              title="Managed by me"
              value={summary.managedByMe}
              onDrillDown={() =>
                drill({ manager: String(user.employeeId ?? "") })
              }
            />
          </KpiGrid>
        </DashboardSection>
        <DashboardSection
          title="Actions"
          commands={
            <QuickActions
              actions={[
                {
                  key: "browse",
                  label: "Browse projects",
                  onClick: () =>
                    navigate({
                      view: PROJECT_ROUTES.list,
                      parameters: {},
                      query: { view: PROJECT_ROUTES.list },
                    }),
                },
                ...(user.capabilities.indexOf("projects.manage") >= 0
                  ? [
                      {
                        key: "create",
                        label: "Create project",
                        onClick: () =>
                          navigate({
                            view: PROJECT_ROUTES.onboarding,
                            parameters: {},
                            query: { view: PROJECT_ROUTES.onboarding },
                          }),
                      },
                    ]
                  : []),
              ]}
            />
          }
        >
          <ActionQueue
            items={[
              ...(summary.drafts
                ? [
                    {
                      key: "drafts",
                      title: `${summary.drafts} draft project(s) need completion`,
                      actionLabel: "Open drafts",
                      onAction: () => drill({ status: "Draft" }),
                    },
                  ]
                : []),
              ...(summary.pendingBaseline
                ? [
                    {
                      key: "baseline",
                      title: `${summary.pendingBaseline} baseline approval(s) are pending`,
                      actionLabel: "Open approvals",
                      onAction: () =>
                        drill({ status: "Pending Baseline Approval" }),
                    },
                  ]
                : []),
            ]}
          />
        </DashboardSection>
      </DashboardLayout>
    </ContentContainer>
  );
};

export const ProjectListPage = (): React.ReactElement => {
  const { route, navigate } = usePmoRoute();
  const user = usePmoCurrentUser();
  const interactions = usePmoInteractions();
  const [filters, setFilters] = React.useState<IProjectListFilters>(() =>
    filtersFromQuery(route.query),
  );
  const [search, setSearch] = React.useState(filters.search ?? "");
  const page = useProjectPage(filters);
  const open = (project: IPmoProject) =>
    navigate({
      view: PROJECT_ROUTES.overview,
      parameters: {
        projectId: String(project.id),
        returnView: PROJECT_ROUTES.list,
      },
      query: {
        view: PROJECT_ROUTES.overview,
        projectId: String(project.id),
        returnView: PROJECT_ROUTES.list,
      },
    });
  const exportRows = (): void => {
    const header = ["Code", "Name", "Status", "Manager", "End", "Health"];
    const rows = page.items.map((p) => [
      p.projectCode ?? "",
      p.title,
      p.status,
      p.projectManager.displayName,
      asDateInput(p.currentApprovedEnd),
      p.overallHealth,
    ]);
    const blob = new Blob(
      [
        [header, ...rows]
          .map((row) =>
            row
              .map((value) => `"${String(value).replace(/"/g, '""')}"`)
              .join(","),
          )
          .join("\n"),
      ],
      { type: "text/csv" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "projects.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const columns: readonly IDataTableColumn<IPmoProject>[] = [
    {
      key: "code",
      header: "Code",
      render: (p) => p.projectCode ?? "Generating…",
    },
    {
      key: "name",
      header: "Project",
      render: (p) => <strong>{p.title}</strong>,
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge text={p.status} />,
    },
    {
      key: "manager",
      header: "Manager",
      render: (p) => (
        <AvatarName
          name={p.projectManager.displayName}
          secondaryText={p.projectManager.email}
        />
      ),
    },
    {
      key: "end",
      header: "Approved end",
      render: (p) => <DateDisplay value={p.currentApprovedEnd} />,
    },
    {
      key: "health",
      header: "Health",
      render: (p) => <StatusBadge text={p.overallHealth} />,
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        title="Project list"
        subtitle="Server-filtered portfolio records. Search is prefix-bounded to 80 characters."
        breadcrumbs={[{ text: "Projects" }, { text: "Project list" }]}
        ariaLabel="Projects"
        items={page.items}
        columns={columns}
        getRowKey={(p) => String(p.id)}
        loading={page.loading}
        errorMessage={page.error}
        onRetry={page.reload}
        paging={{ pageIndex: 0, pageSize: 50, totalItems: page.items.length }}
        onPageChange={() => undefined}
        onCreate={
          user.capabilities.indexOf("projects.manage") >= 0
            ? () =>
                navigate({
                  view: PROJECT_ROUTES.onboarding,
                  parameters: {},
                  query: { view: PROJECT_ROUTES.onboarding },
                })
            : undefined
        }
        createLabel="Create project"
        commands={
          <ExportMenu
            formats={["csv"]}
            disabled={!page.items.length}
            onExport={exportRows}
          />
        }
        getRowActions={(project) => [
          { key: "open", label: "Open", onClick: () => open(project) },
          ...(user.capabilities.indexOf("projects.manage") >= 0 &&
          project.status === "Draft"
            ? [{ key: "edit", label: "Edit", onClick: () => open(project) }]
            : []),
          ...(user.capabilities.indexOf("projects.manage") >= 0 &&
          project.status === "Draft"
            ? [
                {
                  key: "baseline",
                  label: "Submit baseline",
                  onClick: () => {
                    interactions.publishMessage({
                      tone: "information",
                      text: "Open the draft to select its baseline approver and submit.",
                    });
                    open(project);
                  },
                },
              ]
            : []),
        ]}
        filterSlot={
          <FilterBar
            searchLabel="Search code or project name"
            searchValue={search}
            onSearchValueChange={setSearch}
            onSearch={(value) =>
              setFilters({ ...filters, search: value || undefined })
            }
            controls={
              <>
                <SelectInput
                  label="Status"
                  value={filters.status ?? "all"}
                  options={[
                    { key: "all", text: "All statuses" },
                    ...PMO_CHOICES.projects.status.map((value) => ({
                      key: value,
                      text: value,
                    })),
                  ]}
                  onChange={(value) =>
                    setFilters({
                      ...filters,
                      status:
                        value === "all"
                          ? undefined
                          : (value as IPmoProject["status"]),
                    })
                  }
                />
                <SelectInput
                  label="Health"
                  value={filters.overallHealth ?? "all"}
                  options={[
                    { key: "all", text: "All health" },
                    ...PMO_CHOICES.projects.overallHealth.map((value) => ({
                      key: value,
                      text: value,
                    })),
                  ]}
                  onChange={(value) =>
                    setFilters({
                      ...filters,
                      overallHealth:
                        value === "all"
                          ? undefined
                          : (value as IPmoProject["overallHealth"]),
                    })
                  }
                />
              </>
            }
          />
        }
      />
    </ContentContainer>
  );
};

const ProjectForm = ({
  project,
  onSaved,
}: {
  readonly project?: IPmoProject;
  readonly onSaved: (project: IPmoProject) => void;
}): React.ReactElement => {
  const { projects, people } = usePmoServices();
  const user = usePmoCurrentUser();
  const { navigate } = usePmoRoute();
  const interactions = usePmoInteractions();
  const form = useFormState(toDraft(project), validateProjectDraft);
  const [saving, setSaving] = React.useState(false);
  const resolvePeople = async (query: string) =>
    (await people.search(query)).map((person) => ({
      id: String(person.id),
      text: person.displayName,
      email: person.email ?? "",
    }));
  const save = async () => {
    if (!form.validate()) return;
    setSaving(true);
    try {
      const result = project
        ? await projects.updateDraft(project, form.values)
        : await projects.createDraft(form.values);
      interactions.publishMessage({
        tone: "success",
        text: project
          ? "Draft project updated."
          : `Draft created with code ${result.projectCode}.`,
      });
      onSaved(result);
    } catch (error) {
      form.setErrors({ title: toUserSafeErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };
  const issues = (Object.keys(form.errors) as (keyof IProjectDraft)[])
    .filter((key) => Boolean(form.errors[key]))
    .map((key) => ({
      key: String(key),
      message: form.errors[key] as string,
      fieldId: String(key),
    }));
  return (
    <FormPageLayout
      header={
        <PageHeader
          title={project ? `Edit ${project.projectCode}` : "Create project"}
          subtitle="Creates a Draft. Baseline approval is a separate governed action."
          breadcrumbs={[
            { text: "Projects" },
            { text: project ? "Edit draft" : "New project" },
          ]}
        />
      }
      validationIssues={issues}
      actions={
        <FormActions>
          <AppButton
            text="Cancel"
            disabled={saving}
            onClick={() =>
              navigate({
                view: PROJECT_ROUTES.list,
                parameters: {},
                query: { view: PROJECT_ROUTES.list },
              })
            }
          />
          <AppButton
            variant="primary"
            text={saving ? "Saving…" : "Save draft"}
            disabled={saving}
            onClick={save}
          />
        </FormActions>
      }
    >
      <FormSection title="Identity and commercial reference">
        <FormRow>
          <TextInput
            label="Project name"
            required
            value={form.values.title}
            errorMessage={form.errors.title}
            onChange={(value) => form.setValue("title", value)}
          />
          <SelectInput
            label="Project type"
            required
            value={form.values.projectType}
            options={PMO_CHOICES.projects.projectType.map((value) => ({
              key: value,
              text: value,
            }))}
            onChange={(value) =>
              form.setValue(
                "projectType",
                value as IProjectDraft["projectType"],
              )
            }
          />
          <TextInput
            label="Customer"
            value={form.values.customerName}
            onChange={(value) => form.setValue("customerName", value)}
          />
          <TextInput
            label="PO or award reference"
            value={form.values.poReference}
            onChange={(value) => form.setValue("poReference", value)}
          />
        </FormRow>
      </FormSection>
      <FormSection title="Purpose, scope and exclusions">
        <TextArea
          label="Purpose"
          required
          value={form.values.description}
          errorMessage={form.errors.description}
          onChange={(value) => form.setValue("description", value)}
        />
        <TextArea
          label="Scope summary"
          required
          value={form.values.scopeSummary}
          errorMessage={form.errors.scopeSummary}
          onChange={(value) => form.setValue("scopeSummary", value)}
        />
        <TextArea
          label="Exclusions"
          value={form.values.exclusions}
          onChange={(value) => form.setValue("exclusions", value)}
        />
      </FormSection>
      <FormSection title="Ownership">
        <FormRow>
          <PersonInput
            label="Project manager"
            required
            selectedPeople={personInput(form.values.projectManager)}
            errorMessage={form.errors.projectManager}
            onResolveSuggestions={resolvePeople}
            onChange={(value) =>
              form.setValue("projectManager", fromPicker(value))
            }
          />
          <PersonInput
            label="Sponsor"
            selectedPeople={personInput(form.values.sponsor)}
            onResolveSuggestions={resolvePeople}
            onChange={(value) => form.setValue("sponsor", fromPicker(value))}
          />
          <PersonInput
            label="PMO owner"
            required
            selectedPeople={personInput(form.values.pmoOwner)}
            errorMessage={form.errors.pmoOwner}
            onResolveSuggestions={resolvePeople}
            onChange={(value) => form.setValue("pmoOwner", fromPicker(value))}
          />
        </FormRow>
      </FormSection>
      <FormSection title="Dates and effort">
        <FormRow>
          <DateInput
            label="Planned start"
            required
            value={form.values.plannedStart}
            errorMessage={form.errors.plannedStart}
            onChange={(value) => form.setValue("plannedStart", value)}
          />
          <DateInput
            label="Baseline end"
            required
            value={form.values.baselineEnd}
            errorMessage={form.errors.baselineEnd}
            onChange={(value) => form.setValue("baselineEnd", value)}
          />
          <NumberInput
            label="Baseline effort hours"
            required
            value={form.values.baselineEffortHours}
            min={0}
            errorMessage={form.errors.baselineEffortHours}
            onChange={(value) => form.setValue("baselineEffortHours", value)}
          />
          <TextInput
            label="Currency code"
            required
            value={form.values.currencyCode}
            errorMessage={form.errors.currencyCode}
            onChange={(value) => form.setValue("currencyCode", value)}
          />
        </FormRow>
      </FormSection>
      <FormSection title="Priority and confidentiality">
        <FormRow>
          <SelectInput
            label="Priority"
            value={form.values.priority}
            options={PMO_CHOICES.projects.priority.map((value) => ({
              key: value,
              text: value,
            }))}
            onChange={(value) =>
              form.setValue("priority", value as IProjectDraft["priority"])
            }
          />
          <SelectInput
            label="Confidentiality"
            value={form.values.confidentiality}
            options={PMO_CHOICES.projects.confidentiality.map((value) => ({
              key: value,
              text: value,
            }))}
            onChange={(value) =>
              form.setValue(
                "confidentiality",
                value as IProjectDraft["confidentiality"],
              )
            }
          />
        </FormRow>
      </FormSection>
      {user.capabilities.indexOf("finance.manage") >= 0 ? (
        <FormSection title="Finance">
          <FormRow>
            <NumberInput
              label="Project value"
              value={form.values.projectValue}
              min={0}
              onChange={(value) => form.setValue("projectValue", value)}
            />
            <NumberInput
              label="Baseline cost budget"
              value={form.values.baselineCostBudget}
              min={0}
              onChange={(value) => form.setValue("baselineCostBudget", value)}
            />
          </FormRow>
        </FormSection>
      ) : null}
    </FormPageLayout>
  );
};

export const ProjectOnboardingPage = (): React.ReactElement => {
  const { route, navigate } = usePmoRoute();
  const { projects } = usePmoServices();
  const projectId = Number(route.parameters.projectId);
  const [project, setProject] = React.useState<IPmoProject>();
  const [error, setError] = React.useState<string>();
  React.useEffect(() => {
    if (!projectId) return;
    projects
      .get(projectId)
      .then(setProject)
      .catch((caught) => setError(toUserSafeErrorMessage(caught)));
  }, [projectId, projects]);
  if (error)
    return (
      <ContentContainer>
        <EmptyState title="Draft unavailable" description={error} />
      </ContentContainer>
    );
  if (projectId && !project)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading draft" />
      </ContentContainer>
    );
  return (
    <ContentContainer>
      <ProjectForm
        project={project}
        onSaved={(saved) =>
          navigate({
            view: PROJECT_ROUTES.overview,
            parameters: { projectId: String(saved.id) },
            query: {
              view: PROJECT_ROUTES.overview,
              projectId: String(saved.id),
            },
          })
        }
      />
    </ContentContainer>
  );
};

const TeamPanel = ({
  project,
  onChanged,
}: {
  readonly project: IPmoProject;
  readonly onChanged: () => void;
}): React.ReactElement => {
  const { projects } = usePmoServices();
  const [members, setMembers] = React.useState<readonly IPmoProjectMember[]>(
    [],
  );
  const [candidates, setCandidates] = React.useState<readonly IPmoEmployee[]>(
    [],
  );
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<IPmoProjectMember>();
  const interactions = usePmoInteractions();
  const blank = (): IProjectMemberDraft => ({
    projectRole: "Contributor",
    allocationPercent: 0,
    allocationStart: asDateInput(project.plannedStart),
    allocationEnd: asDateInput(project.currentApprovedEnd),
  });
  const [draft, setDraft] = React.useState<IProjectMemberDraft>(blank());
  const load = () => {
    void projects.getTeam(project.id).then((page) => setMembers(page.items));
    void projects
      .getCandidateEmployees()
      .then((page) => setCandidates(page.items));
  };
  React.useEffect(load, [project.id]);
  const open = (member?: IPmoProjectMember) => {
    setEditing(member);
    setDraft(
      member
        ? {
            employee: candidates.find(
              (candidate) => candidate.id === member.employeeId,
            ),
            projectRole: member.projectRole,
            responsibility: member.responsibility,
            allocationPercent: member.allocationPercent,
            allocationStart: asDateInput(member.allocationStart),
            allocationEnd: asDateInput(member.allocationEnd),
          }
        : blank(),
    );
    setPanelOpen(true);
  };
  const save = async () => {
    const errors = validateProjectMemberDraft(draft, project);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      interactions.publishMessage({
        tone: "danger",
        text: errors[firstKey] as string,
      });
      return;
    }
    try {
      const warning = await projects.checkAllocation(draft, editing);
      if (
        warning.message &&
        !(await interactions.requestConfirmation({
          title: "Allocation warning",
          message: warning.message,
          confirmLabel: "Continue",
        }))
      )
        return;
      await projects.saveMember(project, draft, editing);
      setPanelOpen(false);
      load();
      onChanged();
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  const end = async (member: IPmoProjectMember) => {
    const confirmed = await interactions.requestConfirmation({
      title: "End membership",
      message: `End ${member.employeeUser.displayName}'s membership? This preserves the allocation record.`,
      confirmLabel: "End membership",
      destructive: true,
    });
    if (!confirmed) return;
    const reason = window.prompt("Reason for ending membership");
    if (!reason) return;
    try {
      await projects.endMember(member, reason);
      load();
      onChanged();
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  const columns: readonly IDataTableColumn<IPmoProjectMember>[] = [
    {
      key: "employee",
      header: "Member",
      render: (m) => (
        <AvatarName
          name={m.employeeUser.displayName}
          secondaryText={m.employeeUser.email}
        />
      ),
    },
    { key: "role", header: "Role", render: (m) => m.projectRole },
    {
      key: "allocation",
      header: "Allocation",
      render: (m) => <PercentageDisplay value={m.allocationPercent} />,
    },
    {
      key: "dates",
      header: "Dates",
      render: (m) => (
        <>
          {asDateInput(m.allocationStart)} – {asDateInput(m.allocationEnd)}
        </>
      ),
    },
  ];
  return (
    <Stack gap="lg">
      <EntityListPage
        title="Project team"
        subtitle="Active members and planned allocations."
        ariaLabel="Project team"
        items={members}
        columns={columns}
        getRowKey={(m) => String(m.id)}
        paging={{ pageIndex: 0, pageSize: 100, totalItems: members.length }}
        onPageChange={() => undefined}
        onCreate={() => open()}
        createLabel="Add member"
        getRowActions={(member) => [
          {
            key: "edit",
            label: "Edit allocation",
            onClick: () => open(member),
          },
          { key: "end", label: "End membership", onClick: () => end(member) },
        ]}
      />
      <FormPanel
        open={panelOpen}
        title={editing ? "Edit allocation" : "Add project member"}
        onDismiss={() => setPanelOpen(false)}
        onSubmit={save}
        submitLabel={editing ? "Save allocation" : "Add member"}
        width="large"
      >
        <FormRow>
          <SelectInput
            label="Employee"
            required
            value={draft.employee?.id}
            options={[
              { key: "", text: "Select an active employee" },
              ...candidates.map((employee) => ({
                key: employee.id,
                text: `${employee.name} (${employee.capacityPercent}% capacity)`,
              })),
            ]}
            onChange={(value) =>
              setDraft({
                ...draft,
                employee: candidates.find(
                  (employee) => employee.id === Number(value),
                ),
              })
            }
          />
          <SelectInput
            label="Project role"
            value={draft.projectRole}
            options={PMO_CHOICES.projectMembers.projectRole.map((value) => ({
              key: value,
              text: value,
            }))}
            onChange={(value) =>
              setDraft({
                ...draft,
                projectRole: value as IProjectMemberDraft["projectRole"],
              })
            }
          />
          <NumberInput
            label="Allocation percent"
            required
            value={draft.allocationPercent}
            min={0}
            max={100}
            onChange={(value) =>
              setDraft({ ...draft, allocationPercent: value })
            }
          />
        </FormRow>
        <FormRow>
          <DateInput
            label="Allocation start"
            required
            value={draft.allocationStart}
            onChange={(value) => setDraft({ ...draft, allocationStart: value })}
          />
          <DateInput
            label="Allocation end"
            required
            value={draft.allocationEnd}
            onChange={(value) => setDraft({ ...draft, allocationEnd: value })}
          />
        </FormRow>
        <TextArea
          label="Responsibility"
          value={draft.responsibility}
          onChange={(value) => setDraft({ ...draft, responsibility: value })}
        />
      </FormPanel>
    </Stack>
  );
};

export const ProjectWorkspacePage = (): React.ReactElement => {
  const { route, navigate } = usePmoRoute();
  const { projects } = usePmoServices();
  const user = usePmoCurrentUser();
  const interactions = usePmoInteractions();
  const projectId = Number(route.parameters.projectId);
  const [project, setProject] = React.useState<IPmoProject>();
  const [error, setError] = React.useState<string>();
  const [candidates, setCandidates] = React.useState<readonly IPmoEmployee[]>(
    [],
  );
  const [approverId, setApproverId] = React.useState<number>();
  const load = () => {
    if (!projectId) {
      setError("A project ID is required.");
      return;
    }
    void projects
      .get(projectId)
      .then(setProject)
      .catch((caught) => setError(toUserSafeErrorMessage(caught)));
    void projects
      .getCandidateEmployees()
      .then((page) =>
        setCandidates(page.items.filter((employee) => employee.isApprover)),
      );
  };
  React.useEffect(load, [projectId]);
  if (error)
    return (
      <ContentContainer>
        <EmptyState title="Project unavailable" description={error} />
      </ContentContainer>
    );
  if (!project)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading project" />
      </ContentContainer>
    );
  const approver = candidates.find((employee) => employee.id === approverId);
  const workflowActor = approver
    ? {
        ...approver.user,
        isApproverEligible: approver.isApprover,
        hasApproverRole: approver.isApprover,
        isOwner: false,
      }
    : undefined;
  const submitBaseline = async () => {
    if (!workflowActor) {
      interactions.publishMessage({
        tone: "danger",
        text: "Select an active eligible baseline approver.",
      });
      return;
    }
    try {
      const approval = await projects.submitBaseline(project, workflowActor);
      interactions.publishMessage({
        tone: "success",
        text: `Baseline submitted as ${approval.approvalNumber}.`,
      });
      load();
    } catch (caught) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(caught),
      });
    }
  };
  const status = async (target: IPmoProject["status"]) => {
    const reason =
      target === "On Hold" || target === "Cancelled"
        ? (window.prompt(`${target} reason`) ?? "")
        : undefined;
    try {
      await projects.transitionStatus(project, target, reason, workflowActor);
      interactions.publishMessage({
        tone: "success",
        text:
          target === "Pending Closure"
            ? "Closure approval submitted."
            : `Project ${target.toLowerCase()}.`,
      });
      load();
    } catch (caught) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(caught),
      });
    }
  };
  const canManage = user.capabilities.indexOf("projects.manage") >= 0;
  return (
    <ContentContainer>
      <EntityDetailLayout
        actions={
          <PageHeader
            title={project.title}
            subtitle={`${project.projectCode ?? "Project code pending"} · ${project.status}`}
            breadcrumbs={[
              {
                text: "Projects",
                onClick: () =>
                  navigate({
                    view: PROJECT_ROUTES.list,
                    parameters: {},
                    query: { view: PROJECT_ROUTES.list },
                  }),
              },
              { text: project.title },
            ]}
            commands={
              <Stack direction="horizontal" gap="sm" wrap>
                {canManage &&
                (project.status === "Draft" ||
                  project.status === "Active" ||
                  project.status === "On Hold") ? (
                  <SelectInput
                    label="Approver"
                    value={approverId}
                    options={[
                      { key: "", text: "Select approver" },
                      ...candidates.map((employee) => ({
                        key: employee.id,
                        text: employee.name,
                      })),
                    ]}
                    onChange={(value) => setApproverId(Number(value))}
                  />
                ) : null}
                {canManage && project.status === "Draft" ? (
                  <>
                    <AppButton
                      text="Edit draft"
                      onClick={() =>
                        navigate({
                          view: PROJECT_ROUTES.onboarding,
                          parameters: { projectId: String(project.id) },
                          query: {
                            view: PROJECT_ROUTES.onboarding,
                            projectId: String(project.id),
                          },
                        })
                      }
                    />
                    <AppButton
                      variant="primary"
                      text="Submit baseline"
                      onClick={submitBaseline}
                    />
                  </>
                ) : null}
                {canManage && project.status === "Approved" ? (
                  <AppButton
                    variant="primary"
                    text="Activate"
                    onClick={() => status("Active")}
                  />
                ) : null}
                {canManage && project.status === "Active" ? (
                  <>
                    <AppButton
                      text="Place on hold"
                      onClick={() => status("On Hold")}
                    />
                    <AppButton
                      text="Submit closure"
                      onClick={() => status("Pending Closure")}
                    />
                    <AppButton
                      variant="danger"
                      text="Cancel"
                      onClick={() => status("Cancelled")}
                    />
                  </>
                ) : null}
                {canManage && project.status === "On Hold" ? (
                  <>
                    <AppButton
                      variant="primary"
                      text="Resume"
                      onClick={() => status("Active")}
                    />
                    <AppButton
                      text="Submit closure"
                      onClick={() => status("Pending Closure")}
                    />
                    <AppButton
                      variant="danger"
                      text="Cancel"
                      onClick={() => status("Cancelled")}
                    />
                  </>
                ) : null}
              </Stack>
            }
          />
        }
        summary={
          <Stack gap="md">
            <Stack direction="horizontal" gap="lg" wrap>
              <StatusBadge text={project.status} />
              <StatusBadge text={project.overallHealth} />
              <ProgressSummary
                label="Completion"
                value={project.percentComplete}
                detail={`${project.actualEffortHours} actual hours of ${project.approvedEffortHours} approved`}
              />
            </Stack>
            <p>
              Planned {asDateInput(project.plannedStart)} to{" "}
              {asDateInput(project.currentApprovedEnd)} · Data freshness:{" "}
              {project.metricsCalculatedOn
                ? asDateInput(project.metricsCalculatedOn)
                : "Not calculated"}
            </p>
          </Stack>
        }
        tabs={[
          {
            key: "overview",
            label: "Overview",
            content: (
              <Stack gap="md">
                <SummaryCard title="Operational details">
                  <p>{project.description}</p>
                  <p>
                    <strong>Scope:</strong> {project.scopeSummary}
                  </p>
                  <p>
                    <strong>Manager:</strong>{" "}
                    {project.projectManager.displayName} ·{" "}
                    <strong>PMO owner:</strong> {project.pmoOwner.displayName}
                  </p>
                </SummaryCard>
                <SummaryCard title="Current action items">
                  <p>
                    Baseline, status and team actions are shown here. Planning,
                    time, risks, reports and documents are enabled in their
                    dedicated stages.
                  </p>
                </SummaryCard>
              </Stack>
            ),
          },
          {
            key: "team",
            label: "Team",
            content: <TeamPanel project={project} onChanged={load} />,
          },
          {
            key: "plan",
            label: "Plan",
            content: (
              <SummaryCard title="Project plan">
                <p>
                  Manage phases, milestones, tasks, subtasks, dependencies and
                  execution-plan approval in the governed planning workspace.
                </p>
                <Stack direction="horizontal" gap="sm">
                  <AppButton
                    variant="primary"
                    text="Open project plan"
                    onClick={() =>
                      navigate({
                        view: "project-plan",
                        parameters: { projectId: String(project.id) },
                        query: {
                          view: "project-plan",
                          projectId: String(project.id),
                        },
                      })
                    }
                  />
                  <AppButton
                    text="Planning dashboard"
                    onClick={() =>
                      navigate({
                        view: "planning-dashboard",
                        parameters: { projectId: String(project.id) },
                        query: {
                          view: "planning-dashboard",
                          projectId: String(project.id),
                        },
                      })
                    }
                  />
                </Stack>
              </SummaryCard>
            ),
          },
        ]}
      />
    </ContentContainer>
  );
};
