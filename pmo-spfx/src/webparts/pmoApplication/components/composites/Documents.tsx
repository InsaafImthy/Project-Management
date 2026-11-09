import * as React from "react";
import type { IPmoProjectDocument } from "../../models/domain";
import { AppButton, SelectInput, Stack, StatusBadge } from "../primitives";
import { DataTable, type IDataTableColumn } from "./DataTable";

export const EvidenceLink = ({
  document,
  onOpen,
  download,
}: {
  readonly document: IPmoProjectDocument;
  readonly onOpen: (document: IPmoProjectDocument, download: boolean) => void;
  readonly download?: boolean;
}): React.ReactElement => (
  <AppButton
    variant="subtle"
    text={download ? `Download ${document.fileName}` : document.fileName}
    title={`${document.documentType}; ${document.confidentiality}; version ${document.versionLabel ?? "not available"}`}
    onClick={() => onOpen(document, Boolean(download))}
  />
);

export const DocumentLinkSelector = ({
  documents,
  value,
  onChange,
  label = "Linked project document",
  allowedTypes,
}: {
  readonly documents: readonly IPmoProjectDocument[];
  readonly value?: string;
  readonly onChange: (url: string, document?: IPmoProjectDocument) => void;
  readonly label?: string;
  readonly allowedTypes?: readonly IPmoProjectDocument["documentType"][];
}): React.ReactElement => {
  const available = allowedTypes?.length
    ? documents.filter(
        (document) => allowedTypes.indexOf(document.documentType) >= 0,
      )
    : documents;
  return (
    <SelectInput
      label={label}
      value={value ?? ""}
      options={[
        { key: "", text: "No document selected" },
        ...available.map((document) => ({
          key: document.serverRelativeUrl,
          text: `${document.fileName} — ${document.documentType}`,
        })),
      ]}
      onChange={(url) =>
        onChange(
          String(url ?? ""),
          available.find((document) => document.serverRelativeUrl === url),
        )
      }
    />
  );
};

export const ProjectDocumentTable = ({
  documents,
  onOpen,
}: {
  readonly documents: readonly IPmoProjectDocument[];
  readonly onOpen: (document: IPmoProjectDocument, download: boolean) => void;
}): React.ReactElement => {
  const columns: readonly IDataTableColumn<IPmoProjectDocument>[] = [
    {
      key: "file",
      header: "File",
      render: (document) => (
        <EvidenceLink document={document} onOpen={onOpen} />
      ),
    },
    {
      key: "type",
      header: "Document type",
      render: (document) => document.documentType,
    },
    {
      key: "status",
      header: "Status",
      render: (document) => <StatusBadge text={document.documentStatus} />,
    },
    {
      key: "confidentiality",
      header: "Confidentiality",
      render: (document) => <StatusBadge text={document.confidentiality} />,
    },
    {
      key: "version",
      header: "Version",
      render: (document) => document.versionLabel ?? "Not available",
    },
    {
      key: "modified",
      header: "Modified",
      render: (document) => document.modified?.toLocaleString() ?? "—",
    },
  ];
  return (
    <Stack gap="md">
      <DataTable
        ariaLabel="Project documents"
        items={documents}
        columns={columns}
        getRowKey={(document) => String(document.id)}
        paging={{ pageIndex: 0, pageSize: 50, totalItems: documents.length }}
        onPageChange={() => undefined}
        getRowActions={(document) => [
          {
            key: "open",
            label: "Open",
            onClick: () => onOpen(document, false),
          },
          {
            key: "download",
            label: "Download",
            onClick: () => onOpen(document, true),
          },
        ]}
        emptyTitle="No project documents"
        emptyDescription="Upload a project document with the required metadata."
      />
    </Stack>
  );
};
