import * as React from "react";
import {
  DashboardLayout,
  DocumentLinkSelector,
  EntityListPage,
  FormDialog,
  FormRow,
  KpiCard,
  KpiGrid,
  ReasonDialog,
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
  StatusBadge,
  TextArea,
  TextInput,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import type {
  IPmoLearningAssignment,
  IPmoProjectDocument,
} from "../../../models/domain";
import type { ILearningDraft } from "../../../services/domain/LearningManagementService";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";

const initial: ILearningDraft = {
  employeeId: 0,
  title: "",
  skillName: "",
  objective: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  plannedHours: 0,
  deliverable: "",
};
const columns: readonly IDataTableColumn<IPmoLearningAssignment>[] = [
  {
    key: "learning",
    header: "Learning",
    render: (item) => <strong>{item.title}</strong>,
  },
  { key: "skill", header: "Skill", render: (item) => item.skillName },
  {
    key: "period",
    header: "Period",
    render: (item) => (
      <>
        <DateDisplay value={item.startDate} /> –{" "}
        <DateDisplay value={item.endDate} />
      </>
    ),
  },
  {
    key: "hours",
    header: "Actual / planned",
    render: (item) => (
      <>
        {item.actualHours} / {item.plannedHours}
      </>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (item) => <StatusBadge text={item.status} />,
  },
];
const LearningForm = ({
  open,
  onDismiss,
  onSaved,
}: {
  readonly open: boolean;
  readonly onDismiss: () => void;
  readonly onSaved: () => void;
}): React.ReactElement => {
  const { learning } = usePmoServices();
  const interactions = usePmoInteractions();
  const [draft, setDraft] = React.useState<ILearningDraft>(initial);
  const [saving, setSaving] = React.useState(false);
  const update = <K extends keyof ILearningDraft>(
    key: K,
    value: ILearningDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      await learning.save(draft);
      interactions.publishMessage({
        tone: "success",
        text: "Learning assignment saved.",
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
  return (
    <FormDialog
      open={open}
      title="Create learning assignment"
      onDismiss={onDismiss}
      onSubmit={save}
      saving={saving}
    >
      <NumberInput
        label="Employee ID"
        value={draft.employeeId}
        required
        onChange={(value) => update("employeeId", value ?? 0)}
      />
      <TextInput
        label="Learning topic"
        value={draft.title}
        required
        onChange={(value) => update("title", value)}
      />
      <TextInput
        label="Skill name"
        value={draft.skillName}
        required
        onChange={(value) => update("skillName", value)}
      />
      <TextArea
        label="Objective"
        value={draft.objective}
        required
        onChange={(value) => update("objective", value)}
      />
      <FormRow>
        <DateInput
          label="Start"
          value={draft.startDate}
          required
          onChange={(value) => update("startDate", value)}
        />
        <DateInput
          label="End"
          value={draft.endDate}
          required
          onChange={(value) => update("endDate", value)}
        />
        <NumberInput
          label="Planned hours"
          value={draft.plannedHours}
          required
          onChange={(value) => update("plannedHours", value ?? 0)}
        />
      </FormRow>
      <TextArea
        label="Deliverable"
        value={draft.deliverable}
        required
        onChange={(value) => update("deliverable", value)}
      />
      <TextInput
        label="Evidence link"
        value={draft.evidenceLink}
        onChange={(value) => update("evidenceLink", value)}
      />
    </FormDialog>
  );
};
export const MyLearningPage = (): React.ReactElement => {
  const { learning, documents } = usePmoServices();
  const interactions = usePmoInteractions();
  const [items, setItems] = React.useState<readonly IPmoLearningAssignment[]>();
  const [evidenceAssignment, setEvidenceAssignment] =
    React.useState<IPmoLearningAssignment>();
  const [evidenceProjectId, setEvidenceProjectId] = React.useState("");
  const [evidenceProjectCode, setEvidenceProjectCode] = React.useState("");
  const [evidenceDocuments, setEvidenceDocuments] = React.useState<
    readonly IPmoProjectDocument[]
  >([]);
  const [evidenceUrl, setEvidenceUrl] = React.useState("");
  const load = () =>
    void learning
      .mine()
      .then(setItems)
      .catch((error) =>
        interactions.publishMessage({
          tone: "danger",
          text: toUserSafeErrorMessage(error),
        }),
      );
  React.useEffect(load, [learning]);
  if (!items)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading learning" />
      </ContentContainer>
    );
  const actual = items.reduce((sum, item) => sum + item.actualHours, 0);
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="My Learning"
          subtitle="Approved learning is measured separately from project utilization and idle capacity."
          breadcrumbs={[{ text: "My work" }, { text: "Learning" }]}
        />
        <KpiGrid>
          <KpiCard title="Assignments" value={items.length} />
          <KpiCard
            title="Actual learning hours"
            value={<HoursDisplay value={actual} />}
          />
          <KpiCard
            title="Awaiting validation"
            value={items.filter((item) => item.status === "Submitted").length}
          />
          <KpiCard
            title="Validated skills"
            value={items.filter((item) => item.status === "Validated").length}
          />
        </KpiGrid>
        <EntityListPage
          title="Learning assignments"
          subtitle="Use an evidence link to submit an assignment for validation."
          ariaLabel="My learning assignments"
          items={items}
          columns={columns}
          getRowKey={(item) => String(item.id)}
          paging={{ pageIndex: 0, pageSize: 50, totalItems: items.length }}
          onPageChange={() => undefined}
          getRowActions={(item) => [
            {
              key: "submit",
              label: "Submit evidence",
              onClick: () => {
                setEvidenceAssignment(item);
                setEvidenceUrl(item.evidenceLink?.url ?? "");
              },
            },
            {
              key: "refresh",
              label: "Refresh hours",
              onClick: () => void learning.refreshActualHours(item).then(load),
            },
          ]}
        />
        <FormDialog
          open={Boolean(evidenceAssignment)}
          title="Link learning evidence"
          submitLabel="Submit evidence"
          onDismiss={() => setEvidenceAssignment(undefined)}
          onSubmit={() => {
            if (!evidenceAssignment || !evidenceUrl) return;
            void learning
              .submitEvidence(evidenceAssignment, evidenceUrl)
              .then(() => {
                setEvidenceAssignment(undefined);
                load();
              });
          }}
        >
          <FormRow>
            <TextInput
              label="Project ID"
              value={evidenceProjectId}
              onChange={setEvidenceProjectId}
            />
            <TextInput
              label="Project code"
              value={evidenceProjectCode}
              onChange={setEvidenceProjectCode}
            />
          </FormRow>
          <AppButton
            text="Load accessible project documents"
            disabled={!evidenceProjectId || !evidenceProjectCode}
            onClick={() =>
              void documents
                .list(Number(evidenceProjectId), evidenceProjectCode)
                .then(setEvidenceDocuments)
            }
          />
          <DocumentLinkSelector
            documents={evidenceDocuments}
            value={evidenceUrl}
            allowedTypes={["Task Evidence", "Deliverable", "Other"]}
            onChange={setEvidenceUrl}
          />
        </FormDialog>
      </DashboardLayout>
    </ContentContainer>
  );
};
export const LearningManagerPage = (): React.ReactElement => {
  const { learning } = usePmoServices();
  const interactions = usePmoInteractions();
  const [items, setItems] = React.useState<readonly IPmoLearningAssignment[]>();
  const [create, setCreate] = React.useState(false);
  const [target, setTarget] = React.useState<{
    assignment: IPmoLearningAssignment;
    result: "Passed" | "Partially Met" | "Not Met";
    updateSkill: boolean;
  }>();
  const load = () =>
    void learning
      .awaitingValidation()
      .then(setItems)
      .catch((error) =>
        interactions.publishMessage({
          tone: "danger",
          text: toUserSafeErrorMessage(error),
        }),
      );
  React.useEffect(load, [learning]);
  return (
    <ContentContainer>
      <PageHeader
        title="Learning validation"
        subtitle="Resource managers validate demonstrated skills; the existing employee skill summary is appended only when deliberately selected."
        breadcrumbs={[{ text: "Resources" }, { text: "Learning" }]}
        commands={
          <AppButton
            text="Create assignment"
            variant="primary"
            onClick={() => setCreate(true)}
          />
        }
      />
      {items ? (
        <EntityListPage
          title="Awaiting validation"
          subtitle="Validation requires an evidence-based comment."
          ariaLabel="Learning validation queue"
          items={items}
          columns={columns}
          getRowKey={(item) => String(item.id)}
          paging={{ pageIndex: 0, pageSize: 100, totalItems: items.length }}
          onPageChange={() => undefined}
          getRowActions={(item) => [
            {
              key: "passed",
              label: "Passed",
              onClick: () =>
                setTarget({
                  assignment: item,
                  result: "Passed",
                  updateSkill: false,
                }),
            },
            {
              key: "passed-add",
              label: "Passed and add skill",
              onClick: () =>
                setTarget({
                  assignment: item,
                  result: "Passed",
                  updateSkill: true,
                }),
            },
            {
              key: "partial",
              label: "Partially Met",
              onClick: () =>
                setTarget({
                  assignment: item,
                  result: "Partially Met",
                  updateSkill: false,
                }),
            },
            {
              key: "not-met",
              label: "Not Met",
              onClick: () =>
                setTarget({
                  assignment: item,
                  result: "Not Met",
                  updateSkill: false,
                }),
            },
          ]}
        />
      ) : (
        <LoadingSkeleton label="Loading validation queue" />
      )}
      <LearningForm
        open={create}
        onDismiss={() => setCreate(false)}
        onSaved={load}
      />
      <ReasonDialog
        open={Boolean(target)}
        title="Validate learning"
        actionLabel={target?.result ?? "Validate"}
        onDismiss={() => setTarget(undefined)}
        onSubmit={(comment) => {
          if (target)
            void learning
              .validate(
                target.assignment,
                target.result,
                comment,
                target.updateSkill,
              )
              .then(load);
          setTarget(undefined);
        }}
      />
    </ContentContainer>
  );
};
