import * as React from "react";
import { Checkbox } from "@fluentui/react";
import {
  AppButton,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../primitives";
import { compositeStyles as styles } from "./compositeStyles";

export type PmoSortDirection = "ascending" | "descending";

export interface IDataTableColumn<T> {
  readonly key: string;
  readonly header: string;
  readonly render: (item: T) => React.ReactNode;
  readonly sortable?: boolean;
  readonly sortKey?: string;
  readonly align?: "left" | "right";
  readonly width?: string | number;
}

export interface IDataTableSort {
  readonly key: string;
  readonly direction: PmoSortDirection;
}

export interface IDataTablePaging {
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly totalItems: number;
}

export interface IDataTableRowAction<T> {
  readonly key: string;
  readonly label: string;
  readonly onClick: (item: T) => void;
  readonly disabled?: boolean;
}

export interface IDataTableSelection<T> {
  readonly selectedKeys: readonly string[];
  readonly onSelectionChange: (
    keys: readonly string[],
    items: readonly T[],
  ) => void;
  readonly isItemSelectable?: (item: T) => boolean;
}

export interface IDataTableProps<T> {
  readonly ariaLabel: string;
  readonly items: readonly T[];
  readonly columns: readonly IDataTableColumn<T>[];
  readonly getRowKey: (item: T) => string;
  readonly paging: IDataTablePaging;
  readonly onPageChange: (pageIndex: number) => void;
  readonly sort?: IDataTableSort;
  readonly onSortChange?: (sort: IDataTableSort) => void;
  readonly filterSlot?: React.ReactNode;
  readonly getRowActions?: (item: T) => readonly IDataTableRowAction<T>[];
  readonly selection?: IDataTableSelection<T>;
  readonly loading?: boolean;
  readonly errorMessage?: string;
  readonly onRetry?: () => void;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly caption?: string;
}

export interface IPaginationControlsProps extends IDataTablePaging {
  readonly onPageChange: (pageIndex: number) => void;
  readonly disabled?: boolean;
  readonly itemLabel?: string;
}

/** Server-paging controls. Page indices are zero-based in component contracts. */
export const PaginationControls = ({
  pageIndex,
  pageSize,
  totalItems,
  onPageChange,
  disabled,
  itemLabel = "items",
}: IPaginationControlsProps): React.ReactElement => {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const firstItem = totalItems === 0 ? 0 : pageIndex * pageSize + 1;
  const lastItem = Math.min(totalItems, (pageIndex + 1) * pageSize);
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span aria-live="polite">
        {firstItem}–{lastItem} of {totalItems} {itemLabel}
      </span>
      <div className={styles.paginationActions}>
        <AppButton
          text="Previous"
          disabled={disabled || pageIndex <= 0}
          onClick={() => onPageChange(pageIndex - 1)}
        />
        <span>
          Page {Math.min(pageIndex + 1, pageCount)} of {pageCount}
        </span>
        <AppButton
          text="Next"
          disabled={disabled || pageIndex >= pageCount - 1}
          onClick={() => onPageChange(pageIndex + 1)}
        />
      </div>
    </nav>
  );
};

/**
 * Typed, presentation-only table for server-backed collections. The feature
 * container owns queries, sorting, filters, selection state, and page loading.
 */
export const DataTable = <T,>({
  ariaLabel,
  items,
  columns,
  getRowKey,
  paging,
  onPageChange,
  sort,
  onSortChange,
  filterSlot,
  getRowActions,
  selection,
  loading,
  errorMessage,
  onRetry,
  emptyTitle = "No records",
  emptyDescription = "No records match the current filters.",
  caption,
}: IDataTableProps<T>): React.ReactElement => {
  const selected = React.useMemo(
    () => new Set(selection?.selectedKeys ?? []),
    [selection?.selectedKeys],
  );
  const selectableItems = selection
    ? items.filter((item) => selection.isItemSelectable?.(item) ?? true)
    : [];
  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selected.has(getRowKey(item)));
  const updateSelection = (item: T, checked: boolean): void => {
    if (!selection) return;
    const next = new Set(selected);
    const key = getRowKey(item);
    if (checked) next.add(key);
    else next.delete(key);
    selection.onSelectionChange(
      Array.from(next),
      items.filter((candidate) => next.has(getRowKey(candidate))),
    );
  };
  const updatePageSelection = (checked: boolean): void => {
    if (!selection) return;
    const next = new Set(selected);
    for (const item of selectableItems) {
      const key = getRowKey(item);
      if (checked) next.add(key);
      else next.delete(key);
    }
    selection.onSelectionChange(
      Array.from(next),
      items.filter((candidate) => next.has(getRowKey(candidate))),
    );
  };
  const changeSort = (column: IDataTableColumn<T>): void => {
    if (!column.sortable || !onSortChange) return;
    const key = column.sortKey ?? column.key;
    onSortChange({
      key,
      direction:
        sort?.key === key && sort.direction === "ascending"
          ? "descending"
          : "ascending",
    });
  };

  return (
    <section className={styles.surface} aria-label={ariaLabel}>
      {filterSlot}
      {loading ? (
        <LoadingSkeleton label={`Loading ${ariaLabel}`} lines={5} />
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div
            className={styles.tableRegion}
            role="region"
            aria-label={`${ariaLabel} table. Scroll horizontally when needed.`}
            tabIndex={0}
          >
            <table className={styles.table}>
              {caption ? (
                <caption className={styles.tableCaption}>{caption}</caption>
              ) : null}
              <thead>
                <tr>
                  {selection ? (
                    <th className={styles.tableHeader} scope="col">
                      <Checkbox
                        ariaLabel="Select all rows on this page"
                        checked={allSelected}
                        onChange={(_event, checked) =>
                          updatePageSelection(Boolean(checked))
                        }
                      />
                    </th>
                  ) : null}
                  {columns.map((column) => {
                    const sortKey = column.sortKey ?? column.key;
                    const activeSort =
                      sort?.key === sortKey ? sort.direction : undefined;
                    return (
                      <th
                        className={`${styles.tableHeader} ${column.align === "right" ? styles.numericCell : ""}`}
                        key={column.key}
                        scope="col"
                        style={{ width: column.width }}
                        aria-sort={activeSort ?? "none"}
                      >
                        {column.sortable && onSortChange ? (
                          <button
                            className={styles.tableHeaderButton}
                            type="button"
                            onClick={() => changeSort(column)}
                          >
                            {column.header}
                            <span aria-hidden="true">
                              {activeSort === "ascending"
                                ? "▲"
                                : activeSort === "descending"
                                  ? "▼"
                                  : "↕"}
                            </span>
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    );
                  })}
                  {getRowActions ? (
                    <th className={styles.tableHeader} scope="col">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const key = getRowKey(item);
                  const isSelectable =
                    selection?.isItemSelectable?.(item) ?? true;
                  return (
                    <tr key={key}>
                      {selection ? (
                        <td className={styles.tableCell}>
                          <Checkbox
                            ariaLabel={`Select row ${key}`}
                            checked={selected.has(key)}
                            disabled={!isSelectable}
                            onChange={(_event, checked) =>
                              updateSelection(item, Boolean(checked))
                            }
                          />
                        </td>
                      ) : null}
                      {columns.map((column) => (
                        <td
                          className={`${styles.tableCell} ${column.align === "right" ? styles.numericCell : ""}`}
                          key={column.key}
                        >
                          {column.render(item)}
                        </td>
                      ))}
                      {getRowActions ? (
                        <td
                          className={`${styles.tableCell} ${styles.rowActions}`}
                        >
                          {getRowActions(item).map((action) => (
                            <AppButton
                              key={action.key}
                              variant="subtle"
                              text={action.label}
                              disabled={action.disabled}
                              onClick={() => action.onClick(item)}
                            />
                          ))}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls {...paging} onPageChange={onPageChange} />
        </>
      )}
    </section>
  );
};
