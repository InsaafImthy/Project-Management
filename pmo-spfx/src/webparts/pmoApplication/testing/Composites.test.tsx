import * as React from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import {
  DataTable,
  KpiCard,
  type IDataTableColumn,
} from "../components/composites";
import { renderWithPmoTheme } from "./renderWithPmoTheme";

interface ITestRow {
  readonly id: string;
  readonly name: string;
}

const rows: readonly ITestRow[] = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
];
const columns: readonly IDataTableColumn<ITestRow>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (row) => row.name,
  },
];
const baseProps = {
  ariaLabel: "Test records",
  items: rows,
  columns,
  getRowKey: (row: ITestRow): string => row.id,
  paging: { pageIndex: 0, pageSize: 1, totalItems: 2 },
};

describe("shared data and dashboard composites", () => {
  it("renders typed rows and emits sorting, paging, and row actions", () => {
    const sort = jest.fn();
    const page = jest.fn();
    const open = jest.fn();
    renderWithPmoTheme(
      <DataTable
        {...baseProps}
        onPageChange={page}
        onSortChange={sort}
        getRowActions={(row) => [
          { key: "open", label: `Open ${row.name}`, onClick: open },
        ]}
      />,
    );

    expect(screen.getByRole("table").textContent).toContain("Alpha");
    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(sort).toHaveBeenCalledWith({ key: "name", direction: "ascending" });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(page).toHaveBeenCalledWith(1);
    const action = screen.getByRole("button", { name: "Open Alpha" });
    act(() => action.focus());
    expect(document.activeElement).toBe(action);
    fireEvent.click(action);
    expect(open).toHaveBeenCalledWith(rows[0]);
  });

  it("renders loading, empty, and error states without fetching", () => {
    const { rerender } = renderWithPmoTheme(
      <DataTable
        {...baseProps}
        items={[]}
        loading
        onPageChange={() => undefined}
      />,
    );
    expect(
      screen.getByRole("status", { name: "Loading Test records" }),
    ).toBeTruthy();

    rerender(
      <DataTable {...baseProps} items={[]} onPageChange={() => undefined} />,
    );
    expect(screen.getByRole("heading", { name: "No records" })).toBeTruthy();

    rerender(
      <DataTable
        {...baseProps}
        items={[]}
        errorMessage="Records failed."
        onPageChange={() => undefined}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Records failed.");
  });

  it("drills down from KPI cards with mouse or keyboard-native button behavior", () => {
    const drillDown = jest.fn();
    renderWithPmoTheme(
      <KpiCard title="At risk" value="4" onDrillDown={drillDown} />,
    );
    const card = screen.getByRole("button", { name: "At risk: open details" });
    act(() => card.focus());
    expect(document.activeElement).toBe(card);
    fireEvent.click(card);
    expect(drillDown).toHaveBeenCalledTimes(1);
  });
});
