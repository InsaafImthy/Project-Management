import { Workbook } from "exceljs";
import { PMO_FIELDS as F, PMO_LISTS } from "../../config/sharePointSchema";
import type {
  IPmoImportBatch,
  IPmoProject,
  IPmoWorkItem,
} from "../../models/domain";
import type { ISharePointClient } from "../sharepoint/SharePointClient";
import type {
  EmployeesRepository,
  ImportBatchesRepository,
  ProjectMembersRepository,
  WorkItemsRepository,
} from "../repositories/repositories";
import { PmoBusinessError } from "./ConfigurationManagementService";
import type { UserCapabilityService } from "./UserCapabilityService";

export const PMO_TASK_IMPORT_TABLE = "PMO_Tasks";
export const PMO_TASK_TEMPLATE_VERSION = "1.0";
export const PMO_TASK_IMPORT_COLUMNS = [
  "Import Key",
  "Phase",
  "Milestone",
  "Task Title",
  "Task Description",
  "Work Type",
  "Assignee Employee ID",
  "Planned Start",
  "Planned End",
  "Effort Value",
  "Effort Unit",
  "Priority",
  "Dependency Keys",
  "Acceptance Criteria",
  "Reviewer Employee ID",
  "QA Required",
  "QA Owner Employee ID",
  "Notes",
] as const;

export interface IImportPreviewRow {
  readonly rowNumber: number;
  readonly importRowKey: string;
  readonly action: "Create Draft";
  readonly title: string;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly dependencyKeys?: readonly string[];
  readonly values?: Readonly<Record<string, unknown>>;
}

export interface IImportPreview {
  readonly templateVersion: string;
  readonly rows: readonly IImportPreviewRow[];
  readonly validRows: number;
  readonly warningRows: number;
  readonly errorRows: number;
  readonly totalRows: number;
  readonly canConfirm: boolean;
}

export interface IImportValidationContext {
  readonly project: IPmoProject;
  readonly expectedTemplateVersion?: string;
}

const cellText = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value) {
    return String((value as { readonly text?: unknown }).text ?? "").trim();
  }
  return String(value).trim();
};

const parseDate = (value: unknown): Date | undefined => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const result = new Date(epoch.valueOf() + value * 86400000);
    return Number.isNaN(result.valueOf()) ? undefined : result;
  }
  const text = cellText(value);
  if (!text) return undefined;
  const result = new Date(text.length === 10 ? `${text}T00:00:00` : text);
  return Number.isNaN(result.valueOf()) ? undefined : result;
};

const iso = (value: Date): string => value.toISOString();
const personField = (field: string): string => `${field}Id`;

const all = async <T>(
  page: (continuation?: string) => Promise<{
    readonly items: readonly T[];
    readonly continuation?: string;
  }>,
): Promise<T[]> => {
  const values: T[] = [];
  let continuation: string | undefined;
  do {
    const result = await page(continuation);
    values.push(...result.items);
    continuation = result.continuation;
  } while (continuation);
  return values;
};

export const hasImportValidationErrors = (
  preview: Pick<IImportPreview, "rows">,
): boolean => preview.rows.some((row) => row.errors.length > 0);

export const assertAllOrNothingImport = (
  preview: Pick<IImportPreview, "rows">,
): void => {
  if (hasImportValidationErrors(preview)) {
    throw new PmoBusinessError(
      "validation",
      "The workbook contains validation errors. No work items were created.",
    );
  }
};

export const buildImportErrorCsv = (preview: IImportPreview): string =>
  [
    ["Row", "Import Row Key", "Title", "Warnings", "Errors"],
    ...preview.rows
      .filter((row) => row.errors.length || row.warnings.length)
      .map((row) => [
        String(row.rowNumber),
        row.importRowKey,
        row.title,
        row.warnings.join(" | "),
        row.errors.join(" | "),
      ]),
  ]
    .map((row) =>
      row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");

/** Controlled-template parsing and audited Draft Work Item creation. */
export class ExcelImportService {
  public constructor(
    private readonly client: ISharePointClient,
    private readonly batches: ImportBatchesRepository,
    private readonly workItems: WorkItemsRepository,
    private readonly members: ProjectMembersRepository,
    private readonly employees: EmployeesRepository,
    private readonly capabilities: UserCapabilityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async buildTemplate(project: IPmoProject): Promise<ArrayBuffer> {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.capabilities.has("projects.manage")) {
      throw new PmoBusinessError(
        "authorization",
        "Project management access is required to download the import template.",
      );
    }
    const workbook = new Workbook();
    workbook.creator = "PMO Workspace";
    workbook.subject = `PMO Task Import ${PMO_TASK_TEMPLATE_VERSION}`;
    const instructions = workbook.addWorksheet("Instructions");
    instructions.addRows([
      ["PMO Task Import Template"],
      ["Template Version", PMO_TASK_TEMPLATE_VERSION],
      ["Project Code", project.projectCode ?? ""],
      ["Project ID", project.id],
      [
        "Instructions",
        "Complete the PMO_Tasks table. Do not rename columns or the table.",
      ],
    ]);
    instructions.getColumn(1).width = 24;
    instructions.getColumn(2).width = 80;
    const memberships = await all((continuation) =>
      this.members.getActiveByProject(project.id, continuation),
    );
    const team = await Promise.all(
      Array.from(new Set(memberships.map((member) => member.employeeId))).map(
        (id) => this.employees.getById(id),
      ),
    );
    const reference = workbook.addWorksheet("Reference Data");
    reference.addRow(["Employee Number", "Employee Name", "Project Role"]);
    team.forEach((employee) => {
      const member = memberships.find(
        (membership) => membership.employeeId === employee.id,
      );
      reference.addRow([
        employee.employeeNumber,
        employee.name,
        member?.projectRole ?? "Contributor",
      ]);
    });
    reference.addRow([]);
    reference.addRow(["Priority", "Effort Unit", "QA Required"]);
    [
      ["Low", "Hours", "Yes"],
      ["Normal", "Person-Days", "No"],
      ["High", "", ""],
      ["Critical", "", ""],
    ].forEach((row) => reference.addRow(row));
    reference.columns = [{ width: 24 }, { width: 32 }, { width: 20 }];
    const sheet = workbook.addWorksheet("Tasks");
    sheet.addTable({
      name: PMO_TASK_IMPORT_TABLE,
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: PMO_TASK_IMPORT_COLUMNS.map((name) => ({ name })),
      rows: [PMO_TASK_IMPORT_COLUMNS.map(() => "")],
    });
    sheet.columns = PMO_TASK_IMPORT_COLUMNS.map((name) => ({
      width: Math.max(15, Math.min(34, name.length + 4)),
    }));
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as ArrayBuffer;
  }

  public async validate(
    content: ArrayBuffer,
    context: IImportValidationContext,
  ): Promise<IImportPreview> {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.capabilities.has("projects.manage")) {
      throw new PmoBusinessError(
        "authorization",
        "Project management access is required to import tasks.",
      );
    }
    const workbook = new Workbook();
    await workbook.xlsx.load(content as never);
    const instructions = workbook.getWorksheet("Instructions");
    const templateVersion = cellText(instructions?.getCell("B2").value);
    const expected =
      context.expectedTemplateVersion ?? PMO_TASK_TEMPLATE_VERSION;
    if (templateVersion !== expected) {
      throw new PmoBusinessError(
        "validation",
        `Template version ${templateVersion || "missing"} is not supported. Expected ${expected}.`,
      );
    }
    const worksheet = workbook.getWorksheet("Tasks");
    if (!worksheet) {
      throw new PmoBusinessError(
        "validation",
        "The Tasks worksheet is missing.",
      );
    }
    let table;
    try {
      table = worksheet.getTable(PMO_TASK_IMPORT_TABLE);
    } catch {
      throw new PmoBusinessError(
        "validation",
        `The named ${PMO_TASK_IMPORT_TABLE} table is missing.`,
      );
    }
    const names = table.columns.map((column) => column.name);
    const missing = PMO_TASK_IMPORT_COLUMNS.filter(
      (column) => names.indexOf(column) < 0,
    );
    if (missing.length) {
      throw new PmoBusinessError(
        "validation",
        `The task table is missing columns: ${missing.join(", ")}.`,
      );
    }
    const [existing, memberships] = await Promise.all([
      all<IPmoWorkItem>((continuation) =>
        this.workItems.getByProject(context.project.id, continuation),
      ),
      all((continuation) =>
        this.members.getActiveByProject(context.project.id, continuation),
      ),
    ]);
    const employees = await Promise.all(
      Array.from(new Set(memberships.map((member) => member.employeeId))).map(
        (id) => this.employees.getById(id),
      ),
    );
    const employeeByNumber = new Map(
      employees
        .filter((employee) => employee.isActive)
        .map((employee) => [employee.employeeNumber.toLowerCase(), employee]),
    );
    const columnIndex = new Map(names.map((name, index) => [name, index]));
    const rawRows = table.rows.filter((row) =>
      row.some((item) => cellText(item).length > 0),
    );
    const importKeys = rawRows.map((row) =>
      cellText(row[columnIndex.get("Import Key") as number]),
    );
    const duplicateKeys = new Set(
      importKeys.filter(
        (key, index) => key && importKeys.indexOf(key) !== index,
      ),
    );
    const existingKeys = new Set(
      existing
        .map((item) => item.importRowKey?.toLowerCase())
        .filter((key): key is string => Boolean(key)),
    );
    const phases = existing.filter((item) => item.itemType === "Phase");
    const milestones = existing.filter((item) => item.itemType === "Milestone");
    const rows = rawRows.map((row, index) => {
      const get = (name: (typeof PMO_TASK_IMPORT_COLUMNS)[number]) =>
        row[columnIndex.get(name) as number];
      const key = cellText(get("Import Key"));
      const title = cellText(get("Task Title"));
      const description = cellText(get("Task Description"));
      const workType = cellText(get("Work Type"));
      const phaseName = cellText(get("Phase"));
      const milestoneName = cellText(get("Milestone"));
      const assigneeNumber = cellText(
        get("Assignee Employee ID"),
      ).toLowerCase();
      const reviewerNumber = cellText(
        get("Reviewer Employee ID"),
      ).toLowerCase();
      const qaOwnerNumber = cellText(get("QA Owner Employee ID")).toLowerCase();
      const start = parseDate(get("Planned Start"));
      const end = parseDate(get("Planned End"));
      const effort = Number(cellText(get("Effort Value")));
      const effortUnit = cellText(get("Effort Unit")).toLowerCase();
      const priority = cellText(get("Priority"));
      const acceptance = cellText(get("Acceptance Criteria"));
      const qaRequired = cellText(get("QA Required")).toLowerCase();
      const dependencyKeys = cellText(get("Dependency Keys"))
        .split(/[,;]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const errors: string[] = [];
      const warnings: string[] = [];
      if (!key) errors.push("Import Key is required.");
      if (duplicateKeys.has(key))
        errors.push("Import Key is duplicated in the workbook.");
      if (existingKeys.has(key.toLowerCase()))
        errors.push("Import Key already exists in this project.");
      if (!title) errors.push("Task Title is required.");
      if (!description || description === title)
        errors.push("A meaningful Task Description is required.");
      if (!workType) errors.push("Work Type is required.");
      if (!phaseName) errors.push("Phase is required.");
      const phase = phases.find(
        (item) => item.title.toLowerCase() === phaseName.toLowerCase(),
      );
      if (!phase) errors.push("Phase must match an existing project phase.");
      const milestone = milestoneName
        ? milestones.find(
            (item) => item.title.toLowerCase() === milestoneName.toLowerCase(),
          )
        : undefined;
      if (milestoneName && !milestone)
        errors.push("Milestone was not found in this project.");
      const assignee = employeeByNumber.get(assigneeNumber);
      if (!assignee)
        errors.push(
          "Assignee must be an active project member employee number.",
        );
      if (!start) errors.push("Planned Start is invalid.");
      if (!end) errors.push("Planned End is invalid.");
      if (start && end && end < start)
        errors.push("Planned End precedes Planned Start.");
      if (start && start < context.project.plannedStart)
        errors.push("Planned Start is before the project start.");
      if (end && end > context.project.currentApprovedEnd)
        errors.push("Planned End is after the approved project end.");
      if (!Number.isFinite(effort) || effort <= 0)
        errors.push("Effort Value must be greater than zero.");
      if (["hours", "person-days"].indexOf(effortUnit) < 0)
        errors.push("Effort Unit must be Hours or Person-Days.");
      if (["Low", "Normal", "High", "Critical"].indexOf(priority) < 0)
        errors.push("Priority is not a controlled value.");
      if (!acceptance) errors.push("Acceptance Criteria is required.");
      if (["yes", "no"].indexOf(qaRequired) < 0)
        errors.push("QA Required must be Yes or No.");
      const reviewer = reviewerNumber
        ? employeeByNumber.get(reviewerNumber)
        : undefined;
      if (reviewerNumber && !reviewer)
        errors.push(
          "Reviewer must be an active project member employee number.",
        );
      const qaOwner = qaOwnerNumber
        ? employeeByNumber.get(qaOwnerNumber)
        : undefined;
      if (qaRequired === "yes" && !qaOwner)
        errors.push(
          "QA Owner is required and must be an active project member.",
        );
      dependencyKeys.forEach((dependency) => {
        if (
          importKeys.indexOf(dependency) < 0 &&
          !existingKeys.has(dependency.toLowerCase())
        ) {
          errors.push(`Dependency key ${dependency} was not found.`);
        }
        if (dependency === key) errors.push("A task cannot depend on itself.");
      });
      const effortHours = effortUnit === "person-days" ? effort * 8 : effort;
      if (effortHours > context.project.approvedEffortHours)
        warnings.push("Task effort exceeds the project's approved effort.");
      return {
        rowNumber: index + 2,
        importRowKey: key,
        action: "Create Draft" as const,
        title,
        warnings,
        errors,
        dependencyKeys,
        values:
          errors.length || !assignee || !start || !end
            ? undefined
            : {
                [F.workItems.Title]: title,
                [F.workItems.ProjectId]: context.project.id,
                [F.workItems.ProjectCode]: context.project.projectCode ?? "",
                [F.workItems.ItemType]: "Task",
                [F.workItems.ParentWorkItemId]:
                  milestone?.id ?? phase?.id ?? null,
                [F.workItems.PhaseWorkItemId]: phase?.id ?? null,
                [F.workItems.Description]: description,
                [F.workItems.AssignedEmployeeId]: assignee.id,
                [personField(F.workItems.AssignedTo)]: assignee.user.id,
                [personField(F.workItems.Reviewer)]: reviewer?.user.id ?? null,
                [F.workItems.QARequired]: qaRequired === "yes",
                [personField(F.workItems.QAOwner)]: qaOwner?.user.id ?? null,
                [F.workItems.Status]: "Draft",
                [F.workItems.Priority]: priority,
                [F.workItems.PlannedStart]: iso(start),
                [F.workItems.PlannedEnd]: iso(end),
                [F.workItems.BaselineEffortHours]: effortHours,
                [F.workItems.ApprovedEffortHours]: effortHours,
                [F.workItems.ActualEffortHours]: 0,
                [F.workItems.PercentComplete]: 0,
                [F.workItems.AcceptanceCriteria]: acceptance,
                [F.workItems.DependencyIds]: "",
                [F.workItems.IsCritical]: priority === "Critical",
                [F.workItems.PlanVersion]: context.project.currentPlanVersion,
                [F.workItems.ImportRowKey]: key,
                [F.workItems.IsActive]: true,
              },
      };
    });
    const importedKeys = new Set(rows.map((row) => row.importRowKey));
    const graph = new Map(
      rows.map((row) => [
        row.importRowKey,
        (row.dependencyKeys ?? []).filter((key) => importedKeys.has(key)),
      ]),
    );
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const circular = new Set<string>();
    const visit = (key: string, path: readonly string[]): void => {
      if (visiting.has(key)) {
        path.slice(path.indexOf(key)).forEach((item) => circular.add(item));
        circular.add(key);
        return;
      }
      if (visited.has(key)) return;
      visiting.add(key);
      for (const dependency of graph.get(key) ?? []) {
        visit(dependency, [...path, key]);
      }
      visiting.delete(key);
      visited.add(key);
    };
    rows.forEach((row) => visit(row.importRowKey, []));
    rows.forEach((row) => {
      if (circular.has(row.importRowKey)) {
        (row.errors as string[]).push(
          "Dependency Keys contain a circular dependency.",
        );
      }
    });
    const totalEffort = rows.reduce(
      (sum, row) =>
        sum + Number(row.values?.[F.workItems.ApprovedEffortHours] ?? 0),
      0,
    );
    const remaining = Math.max(
      0,
      context.project.approvedEffortHours -
        existing.reduce(
          (sum, item) => sum + (item.approvedEffortHours ?? 0),
          0,
        ),
    );
    if (totalEffort > remaining) {
      rows.forEach((row) =>
        (row.warnings as string[]).push(
          `Workbook effort ${totalEffort}h exceeds remaining unplanned effort ${remaining}h.`,
        ),
      );
    }
    const errorRows = rows.filter((row) => row.errors.length > 0).length;
    const warningRows = rows.filter((row) => row.warnings.length > 0).length;
    return {
      templateVersion,
      rows,
      totalRows: rows.length,
      validRows: rows.length - errorRows,
      warningRows,
      errorRows,
      canConfirm: rows.length > 0 && errorRows === 0,
    };
  }

  public async recordValidation(
    context: IImportValidationContext,
    fileName: string,
    fileLink: string,
    preview: IImportPreview,
  ): Promise<IPmoImportBatch> {
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.capabilities.has("projects.manage")) {
      throw new PmoBusinessError(
        "authorization",
        "Project management access is required.",
      );
    }
    return this.batches.create({
      [F.importBatches.Title]: fileName,
      [F.importBatches.BatchNumber]:
        `IMP-${this.now().getUTCFullYear()}-${String(this.now().valueOf())}`,
      [F.importBatches.ProjectId]: context.project.id,
      [F.importBatches.ProjectCode]: context.project.projectCode ?? "",
      [F.importBatches.FileLink]: { Url: fileLink, Description: fileName },
      [personField(F.importBatches.UploadedBy)]: actor.sharePointUserId,
      [F.importBatches.UploadedOn]: this.now().toISOString(),
      [F.importBatches.TemplateVersion]: preview.templateVersion,
      [F.importBatches.ImportStatus]: preview.canConfirm
        ? "Ready"
        : "Validation Failed",
      [F.importBatches.TotalRows]: preview.totalRows,
      [F.importBatches.ValidRows]: preview.validRows,
      [F.importBatches.ErrorRows]: preview.errorRows,
      [F.importBatches.ResultSummary]: preview.canConfirm
        ? `${preview.validRows} rows ready; ${preview.warningRows} rows have warnings.`
        : `${preview.errorRows} rows require correction. No work items were created.`,
    });
  }

  public async confirm(
    batch: IPmoImportBatch,
    preview: IImportPreview,
  ): Promise<IPmoImportBatch> {
    assertAllOrNothingImport(preview);
    const actor = await this.capabilities.resolveCurrent();
    if (!actor.capabilities.has("projects.manage")) {
      throw new PmoBusinessError(
        "authorization",
        "Project management access is required.",
      );
    }
    if (batch.importStatus === "Completed") return batch;
    if (batch.importStatus !== "Ready") {
      throw new PmoBusinessError(
        "validation",
        "Only a Ready import batch can be confirmed.",
      );
    }
    const existing = await all<IPmoWorkItem>((continuation) =>
      this.workItems.getByProject(batch.projectId, continuation),
    );
    const existingKeys = new Set(
      existing
        .map((item) => item.importRowKey?.toLowerCase())
        .filter((key): key is string => Boolean(key)),
    );
    const duplicate = preview.rows.find((row) =>
      existingKeys.has(row.importRowKey.toLowerCase()),
    );
    if (duplicate) {
      throw new PmoBusinessError(
        "validation",
        `Import Row Key ${duplicate.importRowKey} already exists. No new work items were created.`,
      );
    }
    let processing = await this.batches.update(
      batch.id,
      { [F.importBatches.ImportStatus]: "Processing" },
      batch.etag,
    );
    try {
      await this.client.executeBatch(
        preview.rows.map((row) => ({
          kind: "create" as const,
          listName: PMO_LISTS.workItems,
          values: row.values ?? {},
        })),
      );
      const created = await all<IPmoWorkItem>((continuation) =>
        this.workItems.getByProject(batch.projectId, continuation),
      );
      const byKey = new Map(
        created
          .filter((item) => item.importRowKey)
          .map((item) => [item.importRowKey as string, item]),
      );
      const dependencyUpdates = preview.rows
        .filter((row) => row.dependencyKeys?.length)
        .map((row) => {
          const createdItem = byKey.get(row.importRowKey);
          if (!createdItem) {
            throw new Error(
              `Created work item ${row.importRowKey} could not be resolved for dependency linking.`,
            );
          }
          const dependencyIds = (row.dependencyKeys ?? []).map((key) => {
            const dependency = byKey.get(key);
            if (!dependency) {
              throw new Error(
                `Dependency ${key} could not be resolved after creation.`,
              );
            }
            return dependency.id;
          });
          return {
            kind: "update" as const,
            listName: PMO_LISTS.workItems,
            itemId: createdItem.id,
            etag: createdItem.etag,
            values: { [F.workItems.DependencyIds]: dependencyIds.join(";") },
          };
        });
      if (dependencyUpdates.length) {
        await this.client.executeBatch(dependencyUpdates);
      }
      processing = await this.batches.update(
        processing.id,
        {
          [F.importBatches.ImportStatus]: "Completed",
          [F.importBatches.ProcessedOn]: this.now().toISOString(),
          [F.importBatches.ResultSummary]:
            `${preview.rows.length} Draft Work Items created. Plan review and submission are still required.`,
        },
        processing.etag,
      );
      return processing;
    } catch (error) {
      return this.batches.update(
        processing.id,
        {
          [F.importBatches.ImportStatus]: "Failed",
          [F.importBatches.ProcessedOn]: this.now().toISOString(),
          [F.importBatches.ResultSummary]:
            `Import failed during SharePoint creation. Review the project plan for any created Draft rows before retrying. ${error instanceof Error ? error.message : "Unknown failure."}`,
        },
        processing.etag,
      );
    }
  }
}
