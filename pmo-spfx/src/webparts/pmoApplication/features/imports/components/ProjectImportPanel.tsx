import * as React from "react";
import {
  DataTable,
  KpiCard,
  KpiGrid,
  SummaryCard,
  type IDataTableColumn,
} from "../../../components/composites";
import { AppButton, Stack, StatusBadge } from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import type { IPmoImportBatch, IPmoProject } from "../../../models/domain";
import type {
  IImportPreview,
  IImportPreviewRow,
} from "../../../services/domain/ExcelImportService";
import {
  buildImportErrorCsv,
  PMO_TASK_TEMPLATE_VERSION,
} from "../../../services/domain/ExcelImportService";
import { downloadTextFile } from "../../../utils/reportExport";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export const ProjectImportPanel = ({
  project,
}: {
  readonly project: IPmoProject;
}): React.ReactElement => {
  const { imports, documents } = usePmoServices();
  const interactions = usePmoInteractions();
  const [file, setFile] = React.useState<File>();
  const [preview, setPreview] = React.useState<IImportPreview>();
  const [batch, setBatch] = React.useState<IPmoImportBatch>();
  const [working, setWorking] = React.useState(false);

  const downloadTemplate = async (): Promise<void> => {
    try {
      const content = await imports.buildTemplate(project);
      downloadTextFile(
        new Blob([content], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${project.projectCode ?? "project"}-PMO-task-import-v${PMO_TASK_TEMPLATE_VERSION}.xlsx`,
      );
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };

  const validate = async (): Promise<void> => {
    if (!file || !project.projectCode) return;
    if (!/\.xlsx$/i.test(file.name)) {
      interactions.publishMessage({
        tone: "danger",
        text: "Choose a supported .xlsx workbook.",
      });
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      interactions.publishMessage({
        tone: "danger",
        text: "The workbook exceeds the 10 MB browser-import limit.",
      });
      return;
    }
    setWorking(true);
    setPreview(undefined);
    setBatch(undefined);
    try {
      const document = await documents.upload({
        projectId: project.id,
        projectCode: project.projectCode,
        file,
        documentType: "Import File",
        documentStatus: "Draft",
        confidentiality: "Internal",
        templateVersion: PMO_TASK_TEMPLATE_VERSION,
      });
      let next: IImportPreview;
      try {
        next = await imports.validate(await file.arrayBuffer(), {
          project,
          expectedTemplateVersion: PMO_TASK_TEMPLATE_VERSION,
        });
      } catch (validationError) {
        next = {
          templateVersion: PMO_TASK_TEMPLATE_VERSION,
          rows: [
            {
              rowNumber: 0,
              importRowKey: "Workbook",
              action: "Create Draft",
              title: file.name,
              warnings: [],
              errors: [toUserSafeErrorMessage(validationError)],
            },
          ],
          totalRows: 0,
          validRows: 0,
          warningRows: 0,
          errorRows: 1,
          canConfirm: false,
        };
      }
      const nextBatch = await imports.recordValidation(
        { project, expectedTemplateVersion: PMO_TASK_TEMPLATE_VERSION },
        file.name,
        document.serverRelativeUrl,
        next,
      );
      setPreview(next);
      setBatch(nextBatch);
      interactions.publishMessage({
        tone: next.canConfirm ? "success" : "warning",
        text: next.canConfirm
          ? "The complete workbook passed validation and is ready for confirmation."
          : "Validation found errors. No work items were created.",
      });
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    } finally {
      setWorking(false);
    }
  };

  const confirm = async (): Promise<void> => {
    if (!preview || !batch) return;
    setWorking(true);
    try {
      const result = await imports.confirm(batch, preview);
      setBatch(result);
      interactions.publishMessage({
        tone: result.importStatus === "Completed" ? "success" : "danger",
        text: result.resultSummary ?? `Import ${result.importStatus}.`,
      });
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    } finally {
      setWorking(false);
    }
  };

  const columns: readonly IDataTableColumn<IImportPreviewRow>[] = [
    { key: "row", header: "Row", render: (row) => row.rowNumber },
    { key: "key", header: "Import Row Key", render: (row) => row.importRowKey },
    { key: "title", header: "Task", render: (row) => row.title },
    { key: "action", header: "Action", render: (row) => row.action },
    {
      key: "result",
      header: "Result",
      render: (row) => (
        <StatusBadge
          text={
            row.errors.length
              ? "Error"
              : row.warnings.length
                ? "Warning"
                : "Valid"
          }
        />
      ),
    },
    {
      key: "messages",
      header: "Validation messages",
      render: (row) => [...row.errors, ...row.warnings].join(" ") || "Ready",
    },
  ];
  return (
    <Stack gap="lg">
      <SummaryCard title="Controlled Excel task import">
        <p>
          The workbook is optional. It creates Draft Work Items only after the
          named PMO_Tasks table and every row pass validation. Actual, approval,
          and completion fields are never imported.
        </p>
        <Stack direction="horizontal" gap="sm" wrap>
          <AppButton
            text="Download controlled template"
            onClick={() => void downloadTemplate()}
          />
          <label>
            <span>Completed workbook</span>
            <input
              aria-label="Completed PMO task import workbook"
              type="file"
              accept=".xlsx"
              onChange={(event) => setFile(event.currentTarget.files?.[0])}
            />
          </label>
          <AppButton
            variant="primary"
            text="Upload and validate"
            disabled={!file || working}
            onClick={() => void validate()}
          />
        </Stack>
      </SummaryCard>
      {preview ? (
        <>
          <KpiGrid>
            <KpiCard title="Rows" value={preview.totalRows} />
            <KpiCard title="Valid" value={preview.validRows} />
            <KpiCard title="Warnings" value={preview.warningRows} />
            <KpiCard title="Errors" value={preview.errorRows} />
          </KpiGrid>
          <DataTable
            ariaLabel="Excel import validation preview"
            items={preview.rows}
            columns={columns}
            getRowKey={(row) => `${row.rowNumber}-${row.importRowKey}`}
            paging={{
              pageIndex: 0,
              pageSize: 100,
              totalItems: preview.rows.length,
            }}
            onPageChange={() => undefined}
            caption={`Template ${preview.templateVersion}; ${preview.validRows} valid; ${preview.warningRows} warnings; ${preview.errorRows} errors.`}
          />
          <Stack direction="horizontal" gap="sm" wrap>
            <AppButton
              text="Download validation CSV"
              disabled={!preview.errorRows && !preview.warningRows}
              onClick={() =>
                downloadTextFile(
                  buildImportErrorCsv(preview),
                  `${project.projectCode ?? "project"}-import-errors.csv`,
                  "text/csv;charset=utf-8",
                )
              }
            />
            <AppButton
              variant="primary"
              text="Confirm Draft Work Item creation"
              disabled={
                !preview.canConfirm ||
                working ||
                batch?.importStatus !== "Ready"
              }
              onClick={() => void confirm()}
            />
            {batch ? <StatusBadge text={batch.importStatus} /> : null}
          </Stack>
        </>
      ) : null}
    </Stack>
  );
};
