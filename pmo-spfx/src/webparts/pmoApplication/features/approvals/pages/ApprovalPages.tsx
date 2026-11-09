/* eslint-disable no-void, @typescript-eslint/explicit-function-return-type */
import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import {
  DashboardLayout,
  DashboardSection,
  ConfirmDialog,
  DescriptionList,
  EntityDetailLayout,
  EntityListPage,
  FormPanel,
  FormRow,
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
  DateInput,
  HoursDisplay,
  LoadingSkeleton,
  NumberInput,
  SelectInput,
  StatusBadge,
  TextArea,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import type {
  IPmoApprovalRequest,
  IPmoChangeRequest,
  IPmoProject,
  IPmoWorkItem,
} from "../../../models/domain";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import type { IChangeRequestDraft } from "../../../services/domain/ChangeManagementService";
import type { ApprovalDecision } from "../../../services/domain/DomainRules";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { APPROVAL_ROUTES } from "../routes";

const dateOnly = (date?: Date): string =>
  date?.toISOString().slice(0, 10) ?? "";

const newDraft = (): IChangeRequestDraft => ({
  requestType: "Additional Effort",
  reasonCategory: "Estimation Error",
  reasonDetails: "",
  impactSummary: "",
});

const toDraft = (request: IPmoChangeRequest): IChangeRequestDraft => ({
  requestType: request.requestType,
  projectId: request.projectId,
  workItemId: request.workItemId,
  reasonCategory: request.reasonCategory,
  reasonDetails: request.reasonDetails,
  additionalHoursRequested: request.additionalHoursRequested,
  proposedEffortHours: request.proposedEffortHours,
  proposedDate: dateOnly(request.proposedDate),
  impactSummary: request.impactSummary,
  mitigationPlan: request.mitigationPlan,
});

const toneForStatus = (
  status: string,
): "neutral" | "success" | "warning" | "danger" => {
  if (status === "Approved" || status === "Conditionally Approved")
    return "success";
  if (status === "Rejected" || status === "Failed" || status === "Overdue")
    return "danger";
  if (
    status === "Clarification Requested" ||
    status === "Submitted" ||
    status === "In Progress"
  )
    return "warning";
  return "neutral";
};

export const ChangeRequestForm = ({
  open,
  request,
  onDismiss,
  onSaved,
}: {
  readonly open: boolean;
  readonly request?: IPmoChangeRequest;
  readonly onDismiss: () => void;
  readonly onSaved: (saved: IPmoChangeRequest) => void;
}): React.ReactElement => {
  const { changes } = usePmoServices();
  const interactions = usePmoInteractions();
  const [draft, setDraft] = React.useState<IChangeRequestDraft>(newDraft());
  const [projects, setProjects] = React.useState<readonly IPmoProject[]>([]);
  const [workItems, setWorkItems] = React.useState<readonly IPmoWorkItem[]>([]);
  const [preview, setPreview] =
    React.useState<Awaited<ReturnType<typeof changes.routingPreview>>>();
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setDraft(request ? toDraft(request) : newDraft());
    void changes.getProjects().then((page) => setProjects(page.items));
  }, [changes, open, request]);
  React.useEffect(() => {
    if (!draft.projectId) {
      setWorkItems([]);
      return;
    }
    void changes
      .getWorkItems(draft.projectId)
      .then((page) => setWorkItems(page.items));
  }, [changes, draft.projectId]);
  React.useEffect(() => {
    void changes
      .routingPreview(draft)
      .then(setPreview)
      .catch(() => setPreview(undefined));
  }, [changes, draft]);
  const sourceProject = projects.find(
    (project) => project.id === draft.projectId,
  );
  const sourceItem = workItems.find((item) => item.id === draft.workItemId);
  const set = <K extends keyof IChangeRequestDraft>(
    key: K,
    value: IChangeRequestDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const saved = await changes.saveDraft(draft, request);
      interactions.publishMessage({
        tone: "success",
        text: "Change request saved as a draft.",
      });
      onSaved(saved);
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
  const taskLevel = draft.requestType !== "Project Variation";
  const showEffort =
    draft.requestType === "Additional Effort" ||
    draft.requestType === "Scope Change" ||
    draft.requestType === "Project Variation";
  const showDate =
    draft.requestType === "Due Date Change" ||
    draft.requestType === "Scope Change" ||
    draft.requestType === "Project Variation";
  return (
    <FormPanel
      open={open}
      title={request ? "Edit change request" : "New change request"}
      width="large"
      onDismiss={onDismiss}
      onSubmit={save}
      submitLabel="Save draft"
      saving={saving}
    >
      <FormRow>
        <SelectInput
          label="Request type"
          required
          value={draft.requestType}
          options={PMO_CHOICES.changeRequests.requestType.map((value) => ({
            key: value,
            text: value,
          }))}
          onChange={(value) =>
            set("requestType", value as IChangeRequestDraft["requestType"])
          }
        />
        <SelectInput
          label="Source project"
          required
          value={draft.projectId}
          placeholder="Select a project"
          options={projects.map((project) => ({
            key: project.id,
            text: `${project.projectCode ?? project.id} — ${project.title}`,
          }))}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              projectId: Number(value),
              workItemId: undefined,
            }))
          }
        />
      </FormRow>
      {taskLevel ? (
        <SelectInput
          label="Source work item"
          required
          value={draft.workItemId}
          placeholder="Select a work item"
          options={workItems.map((item) => ({
            key: item.id,
            text: `${item.workItemCode ?? item.id} — ${item.title}`,
          }))}
          onChange={(value) => set("workItemId", Number(value))}
        />
      ) : null}
      <SummaryCard title="Read-only source values">
        <DescriptionList
          items={[
            {
              key: "original-effort",
              label: "Original effort",
              value: (
                <HoursDisplay
                  value={
                    sourceItem?.baselineEffortHours ??
                    sourceProject?.baselineEffortHours
                  }
                />
              ),
            },
            {
              key: "current-effort",
              label: "Current approved effort",
              value: (
                <HoursDisplay
                  value={
                    sourceItem?.approvedEffortHours ??
                    sourceProject?.approvedEffortHours
                  }
                />
              ),
            },
            {
              key: "original-date",
              label: "Original date",
              value: (
                <DateDisplay
                  value={sourceItem?.plannedEnd ?? sourceProject?.baselineEnd}
                />
              ),
            },
            {
              key: "current-date",
              label: "Current approved date",
              value: <DateDisplay value={sourceProject?.currentApprovedEnd} />,
            },
          ]}
        />
      </SummaryCard>
      {showEffort ? (
        <FormRow>
          <NumberInput
            label="Additional hours requested"
            required={draft.requestType === "Additional Effort"}
            min={0}
            precision={1}
            value={draft.additionalHoursRequested}
            onChange={(value) => set("additionalHoursRequested", value)}
          />
          <NumberInput
            label="Proposed effort hours"
            required={draft.requestType === "Additional Effort"}
            min={0}
            precision={1}
            value={draft.proposedEffortHours}
            onChange={(value) => set("proposedEffortHours", value)}
          />
        </FormRow>
      ) : null}
      {showDate ? (
        <DateInput
          label="Proposed date"
          required={draft.requestType === "Due Date Change"}
          value={draft.proposedDate}
          onChange={(value) => set("proposedDate", value)}
        />
      ) : null}
      <SelectInput
        label="Reason category"
        required
        value={draft.reasonCategory}
        options={PMO_CHOICES.changeRequests.reasonCategory.map((value) => ({
          key: value,
          text: value,
        }))}
        onChange={(value) =>
          set("reasonCategory", value as IChangeRequestDraft["reasonCategory"])
        }
      />
      <TextArea
        label="Reason and affected scope"
        required
        value={draft.reasonDetails}
        onChange={(value) => set("reasonDetails", value)}
      />
      <TextArea
        label="Impact summary"
        required
        value={draft.impactSummary}
        onChange={(value) => set("impactSummary", value)}
      />
      <TextArea
        label="Mitigation and recovery plan"
        required={draft.requestType === "Project Variation"}
        value={draft.mitigationPlan}
        onChange={(value) => set("mitigationPlan", value)}
      />
      <SummaryCard title="Approval routing preview">
        <p>{preview?.reason ?? "Select a source to calculate routing."}</p>
        {preview?.approver ? (
          <p>
            <strong>Approver:</strong> {preview.approver} ({preview.route})
          </p>
        ) : null}
        {preview?.blockedReason ? (
          <p role="alert">
            <strong>Submission blocked:</strong> {preview.blockedReason}
          </p>
        ) : null}
      </SummaryCard>
    </FormPanel>
  );
};

const ChangeRequestTable = ({
  items,
  onOpen,
  onEdit,
  onSubmit,
  onWithdraw,
}: {
  readonly items: readonly IPmoChangeRequest[];
  readonly onOpen: (item: IPmoChangeRequest) => void;
  readonly onEdit: (item: IPmoChangeRequest) => void;
  readonly onSubmit: (item: IPmoChangeRequest) => void;
  readonly onWithdraw: (item: IPmoChangeRequest) => void;
}): React.ReactElement => {
  const columns: readonly IDataTableColumn<IPmoChangeRequest>[] = [
    {
      key: "number",
      header: "Request",
      render: (item) => item.requestNumber || `ID-${item.id}`,
    },
    { key: "type", header: "Type", render: (item) => item.requestType },
    { key: "project", header: "Project", render: (item) => item.projectCode },
    {
      key: "requested",
      header: "Requested",
      render: (item) => <DateDisplay value={item.requestedOn} includeTime />,
    },
    {
      key: "approver",
      header: "Approver",
      render: (item) => item.currentApprover?.displayName ?? "Not routed",
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <StatusBadge
          text={item.requestStatus}
          tone={toneForStatus(item.requestStatus)}
        />
      ),
    },
  ];
  return (
    <EntityListPage
      title="Change requests"
      subtitle="Governed effort, date, scope, and project-variation requests."
      ariaLabel="Change requests"
      items={items}
      columns={columns}
      getRowKey={(item) => String(item.id)}
      paging={{ pageIndex: 0, pageSize: 50, totalItems: items.length }}
      onPageChange={() => undefined}
      getRowActions={(item) => [
        { key: "open", label: "Open", onClick: () => onOpen(item) },
        ...(["Draft", "Clarification Requested"].indexOf(item.requestStatus) >=
        0
          ? [{ key: "edit", label: "Edit", onClick: () => onEdit(item) }]
          : []),
        ...(item.requestStatus === "Draft"
          ? [{ key: "submit", label: "Submit", onClick: () => onSubmit(item) }]
          : []),
        ...(["Draft", "Submitted", "Clarification Requested"].indexOf(
          item.requestStatus,
        ) >= 0
          ? [
              {
                key: "withdraw",
                label: "Withdraw",
                onClick: () => onWithdraw(item),
              },
            ]
          : []),
      ]}
    />
  );
};

export const ApprovalDashboardPage = (): React.ReactElement => {
  const { changes } = usePmoServices();
  const { navigate } = usePmoRoute();
  const [dashboard, setDashboard] =
    React.useState<Awaited<ReturnType<typeof changes.dashboard>>>();
  React.useEffect(() => {
    void changes.dashboard().then(setDashboard);
  }, [changes]);
  if (!dashboard)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading change dashboard" />
      </ContentContainer>
    );
  const drill = (filter: string) =>
    navigate({
      view: APPROVAL_ROUTES.requests,
      parameters: {},
      query: { view: APPROVAL_ROUTES.requests, filter },
    });
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="Changes and approvals"
          subtitle={`Governed requests and decision worklist as of ${dashboard.asOf.toLocaleString()}.`}
          breadcrumbs={[
            { text: "Governance" },
            { text: "Changes and approvals" },
          ]}
        />
        <DashboardSection title="My requests">
          <KpiGrid>
            <KpiCard
              title="My draft requests"
              value={dashboard.myDrafts}
              onDrillDown={() => drill("draft")}
            />
            <KpiCard
              title="My submitted requests"
              value={dashboard.mySubmitted}
              onDrillDown={() => drill("submitted")}
            />
            <KpiCard
              title="Clarification requested"
              value={dashboard.clarificationRequested}
              onDrillDown={() => drill("clarification")}
            />
            <KpiCard
              title="Approved or rejected this period"
              value={dashboard.approvedOrRejectedThisPeriod}
              onDrillDown={() => drill("completed")}
            />
          </KpiGrid>
        </DashboardSection>
        <DashboardSection title="Approval work">
          <KpiGrid>
            <KpiCard
              title="Pending my approval"
              value={dashboard.pendingMyApproval}
              onDrillDown={() =>
                navigate({
                  view: APPROVAL_ROUTES.queue,
                  parameters: {},
                  query: { view: APPROVAL_ROUTES.queue },
                })
              }
            />
            <KpiCard
              title="Overdue approvals"
              value={dashboard.overdueApprovals}
              onDrillDown={() =>
                navigate({
                  view: APPROVAL_ROUTES.queue,
                  parameters: {},
                  query: { view: APPROVAL_ROUTES.queue, filter: "overdue" },
                })
              }
            />
            <KpiCard
              title="Project variations requiring PMO"
              value={dashboard.projectVariationsAwaitingPmo}
              onDrillDown={() => drill("variations")}
            />
          </KpiGrid>
        </DashboardSection>
      </DashboardLayout>
    </ContentContainer>
  );
};

export const ChangeRequestsPage = (): React.ReactElement => {
  const { changes } = usePmoServices();
  const { route, navigate } = usePmoRoute();
  const interactions = usePmoInteractions();
  const [items, setItems] = React.useState<readonly IPmoChangeRequest[]>([]);
  const [editing, setEditing] = React.useState<IPmoChangeRequest>();
  const [formOpen, setFormOpen] = React.useState(false);
  const [withdrawn, setWithdrawn] = React.useState<IPmoChangeRequest>();
  const load = () => {
    void changes.listMine().then((page) => setItems(page.items));
  };
  React.useEffect(load, [changes]);
  const filter = route.query.filter;
  const shown = items.filter((item) => {
    if (filter === "draft") return item.requestStatus === "Draft";
    if (filter === "submitted") return item.requestStatus === "Submitted";
    if (filter === "clarification")
      return item.requestStatus === "Clarification Requested";
    if (filter === "completed")
      return (
        item.requestStatus === "Approved" ||
        item.requestStatus === "Rejected" ||
        item.requestStatus === "Conditionally Approved"
      );
    if (filter === "variations")
      return (
        item.requestType === "Project Variation" &&
        item.requestStatus === "Submitted"
      );
    return true;
  });
  const open = (item: IPmoChangeRequest) =>
    navigate({
      view: APPROVAL_ROUTES.request,
      parameters: {},
      query: {
        view: APPROVAL_ROUTES.request,
        requestId: String(item.id),
        returnView: APPROVAL_ROUTES.requests,
      },
    });
  const submit = async (item: IPmoChangeRequest) => {
    try {
      await changes.submit(item);
      interactions.publishMessage({
        tone: "success",
        text: "Change request submitted for approval.",
      });
      load();
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  return (
    <ContentContainer>
      <ChangeRequestTable
        items={shown}
        onOpen={open}
        onEdit={(item) => {
          setEditing(item);
          setFormOpen(true);
        }}
        onSubmit={submit}
        onWithdraw={setWithdrawn}
      />
      <ChangeRequestForm
        open={formOpen}
        request={editing}
        onDismiss={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
        onSaved={() => load()}
      />
      <ReasonDialog
        open={Boolean(withdrawn)}
        title="Withdraw change request"
        actionLabel="Withdraw"
        onDismiss={() => setWithdrawn(undefined)}
        onSubmit={async (reason) => {
          if (!withdrawn) return;
          try {
            await changes.withdraw(withdrawn, reason);
            interactions.publishMessage({
              tone: "success",
              text: "Request withdrawn and retained in history.",
            });
            setWithdrawn(undefined);
            load();
          } catch (error) {
            interactions.publishMessage({
              tone: "danger",
              text: toUserSafeErrorMessage(error),
            });
          }
        }}
      />
      <AppButton
        variant="primary"
        text="New change request"
        onClick={() => {
          setEditing(undefined);
          setFormOpen(true);
        }}
      />
    </ContentContainer>
  );
};

const RequestDetail = ({
  request,
  approval,
}: {
  readonly request: IPmoChangeRequest;
  readonly approval?: IPmoApprovalRequest;
}): React.ReactElement => (
  <EntityDetailLayout
    summary={
      <>
        <PageHeader
          title={request.title}
          subtitle={`${request.requestNumber} · ${request.requestType}`}
          breadcrumbs={[{ text: "Change requests" }]}
        />
        <DescriptionList
          items={[
            {
              key: "status",
              label: "Status",
              value: (
                <StatusBadge
                  text={request.requestStatus}
                  tone={toneForStatus(request.requestStatus)}
                />
              ),
            },
            { key: "project", label: "Project", value: request.projectCode },
            {
              key: "work",
              label: "Work item",
              value: request.workItemId ?? "Project-level variation",
            },
            {
              key: "original-effort",
              label: "Original effort",
              value: <HoursDisplay value={request.originalEffortHours} />,
            },
            {
              key: "current-effort",
              label: "Current approved effort",
              value: <HoursDisplay value={request.currentEffortHours} />,
            },
            {
              key: "proposed-effort",
              label: "Proposed effort",
              value: <HoursDisplay value={request.proposedEffortHours} />,
            },
            {
              key: "original-date",
              label: "Original date",
              value: <DateDisplay value={request.originalDate} />,
            },
            {
              key: "proposed-date",
              label: "Proposed date",
              value: <DateDisplay value={request.proposedDate} />,
            },
            {
              key: "created",
              label: "Created",
              value: <DateDisplay value={request.created} includeTime />,
            },
            {
              key: "modified",
              label: "Modified",
              value: <DateDisplay value={request.modified} includeTime />,
            },
          ]}
        />
      </>
    }
    sections={[
      {
        key: "reason",
        title: "Reason, impact and mitigation",
        content: (
          <DescriptionList
            items={[
              { key: "reason", label: "Reason", value: request.reasonDetails },
              { key: "impact", label: "Impact", value: request.impactSummary },
              {
                key: "mitigation",
                label: "Mitigation",
                value: request.mitigationPlan ?? "Not supplied",
              },
              {
                key: "decision",
                label: "Decision",
                value: request.decisionComment ?? "Pending",
              },
            ]}
          />
        ),
      },
      {
        key: "timeline",
        title: "Request and approval timeline",
        content: (
          <Timeline
            ariaLabel="Request and approval timeline"
            items={[
              {
                key: "created",
                title: "Request created",
                actor: request.requestedBy.displayName,
                timestamp: (
                  <DateDisplay
                    value={request.created ?? request.requestedOn}
                    includeTime
                  />
                ),
              },
              {
                key: "changed",
                title: `Request ${request.requestStatus}`,
                detail: request.decisionComment,
                actor: request.decidedBy?.displayName,
                timestamp: <DateDisplay value={request.modified} includeTime />,
              },
              ...(approval
                ? [
                    {
                      key: "approval",
                      title: `Approval ${approval.approvalStatus}`,
                      detail: approval.decisionComment,
                      actor:
                        approval.decidedBy?.displayName ??
                        approval.approver.displayName,
                      timestamp: (
                        <DateDisplay
                          value={approval.decidedOn ?? approval.modified}
                          includeTime
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ]}
  />
);

export const ChangeRequestDetailPage = (): React.ReactElement => {
  const { changes } = usePmoServices();
  const { route, back, navigate } = usePmoRoute();
  const interactions = usePmoInteractions();
  const [request, setRequest] = React.useState<IPmoChangeRequest>();
  const [approval, setApproval] = React.useState<IPmoApprovalRequest>();
  const id = Number(route.query.requestId);
  const load = () => {
    if (!id) return;
    void changes.getRequest(id).then(async (value) => {
      setRequest(value);
      setApproval(
        value.approvalRequestId
          ? await changes.getApproval(value.approvalRequestId)
          : undefined,
      );
    });
  };
  React.useEffect(load, [changes, id]);
  if (!request)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading change request" />
      </ContentContainer>
    );
  const resubmit = async () => {
    try {
      await changes.resubmit(request);
      interactions.publishMessage({
        tone: "success",
        text: "Clarification response resubmitted.",
      });
      load();
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  return (
    <ContentContainer>
      <RequestDetail request={request} approval={approval} />
      <p>
        <AppButton text="Back" onClick={back} />{" "}
        {request.requestStatus === "Clarification Requested" ? (
          <AppButton variant="primary" text="Resubmit" onClick={resubmit} />
        ) : null}{" "}
        {approval ? (
          <AppButton
            text="Open approval"
            onClick={() =>
              navigate({
                view: APPROVAL_ROUTES.detail,
                parameters: { approvalId: String(approval.id) },
                query: {
                  view: APPROVAL_ROUTES.detail,
                  approvalId: String(approval.id),
                },
              })
            }
          />
        ) : null}
      </p>
    </ContentContainer>
  );
};

export const ApprovalQueuePage = (): React.ReactElement => {
  const { changes } = usePmoServices();
  const { route, navigate } = usePmoRoute();
  const [items, setItems] = React.useState<readonly IPmoApprovalRequest[]>([]);
  React.useEffect(() => {
    void changes.listApprovals().then((page) => setItems(page.items));
  }, [changes]);
  const now = Date.now();
  const shown =
    route.query.filter === "overdue"
      ? items.filter((item) => item.dueOn && item.dueOn.valueOf() < now)
      : items;
  const columns: readonly IDataTableColumn<IPmoApprovalRequest>[] = [
    {
      key: "number",
      header: "Approval",
      render: (item) => item.approvalNumber,
    },
    { key: "type", header: "Type", render: (item) => item.approvalType },
    {
      key: "requestor",
      header: "Requestor",
      render: (item) => item.requestedBy.displayName,
    },
    {
      key: "due",
      header: "Due",
      render: (item) => (
        <>
          {item.dueOn && item.dueOn.valueOf() < now ? (
            <StatusBadge text="Overdue" tone="danger" />
          ) : null}{" "}
          <DateDisplay value={item.dueOn} includeTime />
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <StatusBadge
          text={item.approvalStatus}
          tone={toneForStatus(item.approvalStatus)}
        />
      ),
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        title="My approvals"
        subtitle="Active approval decisions assigned to you."
        ariaLabel="My approvals"
        items={shown}
        columns={columns}
        getRowKey={(item) => String(item.id)}
        paging={{ pageIndex: 0, pageSize: 50, totalItems: shown.length }}
        onPageChange={() => undefined}
        getRowActions={(item) => [
          {
            key: "open",
            label: "Review",
            onClick: () =>
              navigate({
                view: APPROVAL_ROUTES.detail,
                parameters: { approvalId: String(item.id) },
                query: {
                  view: APPROVAL_ROUTES.detail,
                  approvalId: String(item.id),
                  returnView: APPROVAL_ROUTES.queue,
                },
              }),
          },
        ]}
      />
    </ContentContainer>
  );
};

export const ApprovalDetailPage = (): React.ReactElement => {
  const { changes } = usePmoServices();
  const { route, back } = usePmoRoute();
  const interactions = usePmoInteractions();
  const user = usePmoCurrentUser();
  const [approval, setApproval] = React.useState<IPmoApprovalRequest>();
  const [source, setSource] = React.useState<IPmoChangeRequest>();
  const [decision, setDecision] = React.useState<ApprovalDecision>();
  const id = Number(route.parameters.approvalId ?? route.query.approvalId);
  const load = () => {
    if (!id) return;
    void changes.getApproval(id).then(async (item) => {
      setApproval(item);
      setSource(
        item.sourceList === "PMO_ChangeRequests"
          ? await changes.getRequest(item.sourceItemId)
          : undefined,
      );
    });
  };
  React.useEffect(load, [changes, id]);
  if (!approval)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading approval" />
      </ContentContainer>
    );
  const decide = async (chosen: ApprovalDecision, comment?: string) => {
    try {
      await changes.decide(approval.id, chosen, comment);
      interactions.publishMessage({
        tone: "success",
        text: "Approval decision recorded and source processing completed.",
      });
      setDecision(undefined);
      load();
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  const canDecide =
    user.capabilities.indexOf("approvals.decide") >= 0 &&
    (approval.approvalStatus === "Submitted" ||
      approval.approvalStatus === "In Progress");
  return (
    <>
      <ContentContainer>
        <EntityDetailLayout
          actions={
            <PageHeader
              title={approval.title}
              subtitle={`${approval.approvalNumber} · ${approval.approvalType}`}
              breadcrumbs={[{ text: "My approvals" }]}
              commands={<AppButton text="Back" onClick={back} />}
            />
          }
          summary={
            <DescriptionList
              items={[
                {
                  key: "status",
                  label: "Status",
                  value: (
                    <StatusBadge
                      text={approval.approvalStatus}
                      tone={toneForStatus(approval.approvalStatus)}
                    />
                  ),
                },
                {
                  key: "due",
                  label: "Due",
                  value: <DateDisplay value={approval.dueOn} includeTime />,
                },
                {
                  key: "source",
                  label: "Source record",
                  value: `${approval.sourceList} #${approval.sourceItemId}`,
                },
                {
                  key: "requestor",
                  label: "Requestor",
                  value: approval.requestedBy.displayName,
                },
                {
                  key: "created",
                  label: "Created",
                  value: <DateDisplay value={approval.created} includeTime />,
                },
                {
                  key: "modified",
                  label: "Modified",
                  value: <DateDisplay value={approval.modified} includeTime />,
                },
              ]}
            />
          }
          sections={[
            {
              key: "values",
              title: "Baseline, current and proposed values",
              content: source ? (
                <DescriptionList
                  items={[
                    {
                      key: "baseline-effort",
                      label: "Original effort",
                      value: (
                        <HoursDisplay value={source.originalEffortHours} />
                      ),
                    },
                    {
                      key: "current-effort",
                      label: "Current approved effort",
                      value: <HoursDisplay value={source.currentEffortHours} />,
                    },
                    {
                      key: "proposed-effort",
                      label: "Proposed effort",
                      value: (
                        <HoursDisplay value={source.proposedEffortHours} />
                      ),
                    },
                    {
                      key: "baseline-date",
                      label: "Original date",
                      value: <DateDisplay value={source.originalDate} />,
                    },
                    {
                      key: "proposed-date",
                      label: "Proposed date",
                      value: <DateDisplay value={source.proposedDate} />,
                    },
                    {
                      key: "impact",
                      label: "Impact and mitigation",
                      value: `${source.impactSummary}${source.mitigationPlan ? ` — ${source.mitigationPlan}` : ""}`,
                    },
                  ]}
                />
              ) : (
                <p>
                  Open the governed source record for its current and baseline
                  values.
                </p>
              ),
            },
            {
              key: "timeline",
              title: "Decision timeline",
              content: (
                <Timeline
                  items={[
                    {
                      key: "requested",
                      title: "Submitted",
                      actor: approval.requestedBy.displayName,
                      timestamp: (
                        <DateDisplay value={approval.requestedOn} includeTime />
                      ),
                    },
                    {
                      key: "decision",
                      title: approval.decision
                        ? `${approval.decision}: ${approval.approvalStatus}`
                        : "Awaiting decision",
                      actor:
                        approval.decidedBy?.displayName ??
                        approval.approver.displayName,
                      detail: approval.decisionComment,
                      timestamp: (
                        <DateDisplay
                          value={approval.decidedOn ?? approval.modified}
                          includeTime
                        />
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
        {canDecide ? (
          <p>
            <AppButton
              variant="primary"
              text="Approve"
              onClick={() => setDecision("Approve")}
            />{" "}
            <AppButton
              text="Conditionally approve"
              onClick={() => setDecision("Conditionally Approve")}
            />{" "}
            <AppButton
              variant="danger"
              text="Reject"
              onClick={() => setDecision("Reject")}
            />{" "}
            <AppButton
              text="Request clarification"
              onClick={() => setDecision("Request Clarification")}
            />
          </p>
        ) : null}
        {approval.flowProcessingStatus === "Failed" &&
        (user.capabilities.indexOf("support.failed-actions") >= 0 ||
          (user.securityRoles?.indexOf("owner") ?? -1) >= 0) ? (
          <AppButton
            text="Retry failed action"
            onClick={async () => {
              try {
                await changes.retry(approval.id);
                interactions.publishMessage({
                  tone: "success",
                  text: "Failed decision retried.",
                });
                load();
              } catch (error) {
                interactions.publishMessage({
                  tone: "danger",
                  text: toUserSafeErrorMessage(error),
                });
              }
            }}
          />
        ) : null}
      </ContentContainer>
      {decision === "Approve" ? (
        <ConfirmDialog
          open
          title="Approve request"
          message="Approve this governed request and apply its source-specific result?"
          confirmLabel="Approve"
          onDismiss={() => setDecision(undefined)}
          onConfirm={() => void decide("Approve")}
        />
      ) : null}
      {decision && decision !== "Approve" ? (
        <ReasonDialog
          open
          title={
            decision === "Reject"
              ? "Reject approval"
              : decision === "Conditionally Approve"
                ? "Conditionally approve"
                : "Request clarification"
          }
          actionLabel={decision}
          onDismiss={() => setDecision(undefined)}
          onSubmit={(comment) => void decide(decision, comment)}
        />
      ) : null}
    </>
  );
};
