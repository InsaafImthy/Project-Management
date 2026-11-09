export interface IReportExportMetadata {
  readonly reportName: string;
  readonly asOf: Date;
  readonly filters: Readonly<Record<string, string | number | undefined>>;
  readonly confidentiality: "Internal" | "Restricted";
}

export interface IReportExportColumn<T> {
  readonly header: string;
  readonly value: (item: T) => string | number | boolean | Date | undefined;
}

const csvCell = (value: unknown): string => {
  const text =
    value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

export const reportExportHeaderRows = (
  metadata: IReportExportMetadata,
): readonly (readonly string[])[] => {
  const filters = Object.keys(metadata.filters)
    .filter((key) => metadata.filters[key] !== undefined)
    .map((key) => `${key}=${String(metadata.filters[key])}`)
    .join("; ");
  return [
    ["Report", metadata.reportName],
    ["As of", metadata.asOf.toISOString()],
    ["Filters", filters || "None"],
    ["Confidentiality", metadata.confidentiality],
  ];
};

export const buildReportCsv = <T>(
  metadata: IReportExportMetadata,
  columns: readonly IReportExportColumn<T>[],
  rows: readonly T[],
): string =>
  [
    ...reportExportHeaderRows(metadata),
    [],
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => column.value(row))),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

const safeFileName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const downloadTextFile = (
  content: string | Blob,
  fileName: string,
  mimeType = "text/plain;charset=utf-8",
): void => {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadReportCsv = <T>(
  metadata: IReportExportMetadata,
  columns: readonly IReportExportColumn<T>[],
  rows: readonly T[],
): void =>
  downloadTextFile(
    buildReportCsv(metadata, columns, rows),
    `${safeFileName(metadata.reportName) || "report"}.csv`,
    "text/csv;charset=utf-8",
  );

export const openPrintView = <T>(
  metadata: IReportExportMetadata,
  columns: readonly IReportExportColumn<T>[],
  rows: readonly T[],
): void => {
  const target = window.open("", "_blank", "noopener,noreferrer");
  if (!target) throw new Error("The print view was blocked by the browser.");
  const filters = reportExportHeaderRows(metadata)[2]?.[1] ?? "None";
  const escape = (value: unknown): string =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  target.document
    .write(`<!doctype html><html><head><title>${escape(metadata.reportName)}</title><style>
    body{font-family:Segoe UI,Arial,sans-serif;margin:32px;color:#242424}h1{font-size:24px}
    .meta{margin:0 0 20px}.meta div{margin:4px 0}table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #d1d1d1;padding:8px;text-align:left;vertical-align:top}th{background:#f3f2f1}
    @media print{button{display:none}body{margin:12mm}}
  </style></head><body><h1>${escape(metadata.reportName)}</h1><div class="meta">
    <div><strong>As of:</strong> ${escape(metadata.asOf.toLocaleString())}</div>
    <div><strong>Filters:</strong> ${escape(filters)}</div>
    <div><strong>Confidentiality:</strong> ${escape(metadata.confidentiality)}</div>
  </div><button onclick="window.print()">Print</button><table><thead><tr>${columns
    .map((column) => `<th>${escape(column.header)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escape(column.value(row))}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></body></html>`);
  target.document.close();
};
