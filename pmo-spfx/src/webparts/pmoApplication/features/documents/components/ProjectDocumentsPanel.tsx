import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import {
  FormPanel,
  ProjectDocumentTable,
  SummaryCard,
} from "../../../components/composites";
import {
  AppButton,
  LoadingSkeleton,
  SelectInput,
  Stack,
  TextInput,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import type { IPmoProject, IPmoProjectDocument } from "../../../models/domain";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";

const options = (items: readonly string[]) =>
  items.map((item) => ({ key: item, text: item }));

export const ProjectDocumentsPanel = ({
  project,
}: {
  readonly project: IPmoProject;
}): React.ReactElement => {
  const { documents } = usePmoServices();
  const interactions = usePmoInteractions();
  const [items, setItems] = React.useState<readonly IPmoProjectDocument[]>();
  const [typeFilter, setTypeFilter] = React.useState("");
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [file, setFile] = React.useState<File>();
  const [documentType, setDocumentType] =
    React.useState<IPmoProjectDocument["documentType"]>("Deliverable");
  const [documentStatus, setDocumentStatus] =
    React.useState<IPmoProjectDocument["documentStatus"]>("Draft");
  const [confidentiality, setConfidentiality] =
    React.useState<IPmoProjectDocument["confidentiality"]>("Internal");
  const [templateVersion, setTemplateVersion] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const load = React.useCallback(() => {
    if (!project.projectCode) return;
    void documents
      .list(
        project.id,
        project.projectCode,
        (typeFilter || undefined) as
          | IPmoProjectDocument["documentType"]
          | undefined,
      )
      .then(setItems)
      .catch((error) =>
        interactions.publishMessage({
          tone: "danger",
          text: toUserSafeErrorMessage(error),
        }),
      );
  }, [documents, interactions, project.id, project.projectCode, typeFilter]);
  React.useEffect(load, [load]);

  const upload = async (): Promise<void> => {
    if (!file || !project.projectCode) return;
    setSaving(true);
    try {
      await documents.upload({
        projectId: project.id,
        projectCode: project.projectCode,
        file,
        documentType,
        documentStatus,
        confidentiality,
        templateVersion: templateVersion || undefined,
      });
      interactions.publishMessage({
        tone: "success",
        text: `${file.name} was uploaded to PMO Project Documents.`,
      });
      setUploadOpen(false);
      setFile(undefined);
      setTemplateVersion("");
      load();
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const open = async (
    document: IPmoProjectDocument,
    download: boolean,
  ): Promise<void> => {
    try {
      const url = await documents.assertCanOpen(project.id, document);
      window.open(
        `${url}${url.indexOf("?") >= 0 ? "&" : "?"}${download ? "download=1" : "web=1"}`,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };

  if (!project.projectCode) {
    return (
      <SummaryCard title="Project documents">
        <p>The project code must be generated before documents can be added.</p>
      </SummaryCard>
    );
  }
  if (!items) return <LoadingSkeleton label="Loading project documents" />;
  return (
    <Stack gap="md">
      <Stack direction="horizontal" gap="md" wrap>
        <SelectInput
          label="Document type"
          value={typeFilter}
          options={[
            { key: "", text: "All document types" },
            ...options(PMO_CHOICES.projectDocuments.documentType),
          ]}
          onChange={(value) => setTypeFilter(String(value ?? ""))}
        />
        <AppButton
          variant="primary"
          text="Upload document"
          onClick={() => setUploadOpen(true)}
        />
      </Stack>
      <ProjectDocumentTable
        documents={items}
        onOpen={(document, download) => void open(document, download)}
      />
      <FormPanel
        open={uploadOpen}
        title="Upload project document"
        submitLabel="Upload"
        saving={saving}
        onDismiss={() => setUploadOpen(false)}
        onSubmit={() => void upload()}
        validationIssues={
          file ? [] : [{ key: "file", message: "Choose a file to upload." }]
        }
      >
        <Stack gap="md">
          <label>
            <span>File</span>
            <input
              aria-label="Project document file"
              type="file"
              onChange={(event) => setFile(event.currentTarget.files?.[0])}
            />
          </label>
          <SelectInput
            label="Document type"
            value={documentType}
            options={options(PMO_CHOICES.projectDocuments.documentType)}
            onChange={(value) =>
              setDocumentType(value as IPmoProjectDocument["documentType"])
            }
          />
          <SelectInput
            label="Document status"
            value={documentStatus}
            options={options(PMO_CHOICES.projectDocuments.documentStatus)}
            onChange={(value) =>
              setDocumentStatus(value as IPmoProjectDocument["documentStatus"])
            }
          />
          <SelectInput
            label="Confidentiality"
            value={confidentiality}
            options={options(PMO_CHOICES.projectDocuments.confidentiality)}
            onChange={(value) =>
              setConfidentiality(
                value as IPmoProjectDocument["confidentiality"],
              )
            }
          />
          <TextInput
            label="Template version"
            value={templateVersion}
            onChange={setTemplateVersion}
            hint="Required for controlled templates and import files."
          />
        </Stack>
      </FormPanel>
    </Stack>
  );
};
