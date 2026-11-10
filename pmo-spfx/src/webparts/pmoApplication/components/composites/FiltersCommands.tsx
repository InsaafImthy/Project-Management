import * as React from "react";
import { DefaultButton, type IContextualMenuItem } from "@fluentui/react";
import { AppButton, IconButton, SearchInput } from "../primitives";
import { compositeStyles as styles } from "./compositeStyles";

export interface IFilterBarProps {
  readonly searchLabel: string;
  readonly searchValue?: string;
  readonly searchPlaceholder?: string;
  readonly onSearch: (value: string) => void;
  readonly onSearchValueChange?: (value: string) => void;
  readonly controls?: React.ReactNode;
  readonly activeFilterCount?: number;
  readonly onClearAll?: () => void;
}

/** Search and feature-supplied filters with a standardized clear/count contract. */
export const FilterBar = ({
  searchLabel,
  searchValue,
  searchPlaceholder,
  onSearch,
  onSearchValueChange,
  controls,
  activeFilterCount = 0,
  onClearAll,
}: IFilterBarProps): React.ReactElement => (
  <div className={styles.filterBar} role="search" aria-label="Filter records">
    <div className={styles.filterSearch}>
      <SearchInput
        label={searchLabel}
        value={searchValue}
        placeholder={searchPlaceholder}
        onChange={onSearchValueChange}
        onSearch={onSearch}
      />
    </div>
    {controls ? <div className={styles.filterControls}>{controls}</div> : null}
    {activeFilterCount > 0 && onClearAll ? (
      <div className={styles.filterActions}>
        <AppButton
          variant="subtle"
          text={`Clear all (${activeFilterCount})`}
          onClick={onClearAll}
        />
      </div>
    ) : null}
  </div>
);

export interface IFilterChip {
  readonly key: string;
  readonly label: string;
  readonly onRemove: () => void;
}

/** Removable text representation of active filters. */
export const FilterChipList = ({
  chips,
}: {
  readonly chips: readonly IFilterChip[];
}): React.ReactElement => (
  <div className={styles.chipList} aria-label="Active filters">
    {chips.map((chip) => (
      <span className={styles.chip} key={chip.key}>
        {chip.label}
        <IconButton
          ariaLabel={`Remove filter ${chip.label}`}
          iconProps={{ iconName: "Cancel" }}
          onClick={chip.onRemove}
        />
      </span>
    ))}
  </div>
);

/** Page-level actions; action components are supplied by the caller. */
export const CommandBar = ({
  children,
  ariaLabel = "Page actions",
}: {
  readonly children: React.ReactNode;
  readonly ariaLabel?: string;
}): React.ReactElement => (
  <div className={styles.commandBar} role="toolbar" aria-label={ariaLabel}>
    {children}
  </div>
);

export type PmoExportFormat = "csv" | "excel";

export interface IExportMenuProps {
  readonly formats?: readonly PmoExportFormat[];
  readonly disabled?: boolean;
  readonly onExport: (format: PmoExportFormat) => void;
}

/** Export intent contract only; feature services implement file generation later. */
export const ExportMenu = ({
  formats = ["csv", "excel"],
  disabled,
  onExport,
}: IExportMenuProps): React.ReactElement => {
  const labels: Record<PmoExportFormat, string> = {
    csv: "Export CSV",
    excel: "Export Excel",
  };
  const items: IContextualMenuItem[] = formats.map((format) => ({
    key: format,
    text: labels[format],
    onClick: () => onExport(format),
  }));
  return (
    <DefaultButton
      text="Export"
      disabled={disabled}
      menuProps={{ items }}
      ariaLabel="Export options"
    />
  );
};
