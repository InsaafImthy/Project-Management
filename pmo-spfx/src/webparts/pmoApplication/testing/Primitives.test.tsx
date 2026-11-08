import * as React from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import {
  AppButton,
  CheckboxInput,
  DateDisplay,
  DateInput,
  DateTimeInput,
  EmptyState,
  ErrorState,
  HealthIndicator,
  IconButton,
  LoadingSkeleton,
  LoadingSpinner,
  NumberInput,
  PersonInput,
  SearchInput,
  SelectInput,
  StatusBadge,
  TextArea,
  TextInput,
} from "../components/primitives";
import { formatPmoDate } from "../utils/formatters";
import { renderWithPmoTheme } from "./renderWithPmoTheme";

describe("PMO primitive components", () => {
  it("renders button variants and preserves the disabled state", () => {
    renderWithPmoTheme(
      <>
        <AppButton variant="primary" text="Save" />
        <AppButton variant="secondary" text="Cancel" />
        <AppButton variant="subtle" text="Details" />
        <AppButton variant="danger" text="Delete" />
        <AppButton variant="icon" ariaLabel="Pin item" />
        <AppButton text="Unavailable" disabled />
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" }).className).toContain(
      "ms-Button--primary",
    );
    expect(screen.getByRole("button", { name: "Details" }).className).not.toBe(
      screen.getByRole("button", { name: "Cancel" }).className,
    );
    expect(screen.getByRole("button", { name: "Delete" }).className).not.toBe(
      screen.getByRole("button", { name: "Cancel" }).className,
    );
    expect(screen.getByRole("button", { name: "Pin item" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Unavailable" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("requires and exposes accessible labels for icon buttons and inputs", () => {
    renderWithPmoTheme(
      <>
        <IconButton ariaLabel="Open actions" />
        <TextInput label="Project name" value="" />
        <TextArea label="Project description" value="" />
        <DateInput label="Start date" value="2026-11-08" />
        <DateTimeInput label="Review time" value="2026-11-08T09:00" />
        <SelectInput
          label="Project status"
          options={[{ key: "active", text: "Active" }]}
        />
        <CheckboxInput label="Active project" />
        <SearchInput label="Search projects" onSearch={() => undefined} />
        <PersonInput label="Project manager" onResolveSuggestions={() => []} />
      </>,
    );

    expect(screen.getByRole("button", { name: "Open actions" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Project name" })).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: "Project description" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Start date")).toBeTruthy();
    expect(screen.getByLabelText("Review time")).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "Project status" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Active project" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("searchbox", { name: "Search projects" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "Project manager" }),
    ).toBeTruthy();
  });

  it("associates field errors with their input", () => {
    renderWithPmoTheme(
      <TextInput
        label="Project code"
        value=""
        errorMessage="Project code is required."
      />,
    );
    const input = screen.getByRole("textbox", { name: "Project code" });
    const error = screen.getByRole("alert");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(error.id);
    expect(error.textContent).toBe("Project code is required.");
  });

  it("renders status and every health state as text, not color alone", () => {
    renderWithPmoTheme(
      <>
        <StatusBadge text="Pending approval" tone="warning" />
        <HealthIndicator value="Not Set" />
        <HealthIndicator value="Green" />
        <HealthIndicator value="Amber" />
        <HealthIndicator value="Red" />
      </>,
    );

    for (const text of [
      "Pending approval",
      "Not Set",
      "Green",
      "Amber",
      "Red",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it("clamps number boundaries and applies precision", () => {
    const onChange = jest.fn<void, [number | undefined]>();
    renderWithPmoTheme(
      <NumberInput
        label="Percent complete"
        value={50}
        min={0}
        max={100}
        precision={1}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "Percent complete" });

    fireEvent.change(input, { target: { value: "120.49" } });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.change(input, { target: { value: "-8" } });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.change(input, { target: { value: "42.26" } });
    expect(onChange).toHaveBeenLastCalledWith(42.3);
  });

  it("formats ISO date-only values without changing the calendar day", () => {
    expect(formatPmoDate("2026-11-08", "en-GB")).toBe("8 Nov 2026");
    renderWithPmoTheme(<DateDisplay value="2026-11-08" locale="en-GB" />);
    expect(screen.getByText("8 Nov 2026")).toBeTruthy();
  });

  it("renders empty, loading, and retryable error states", () => {
    const retry = jest.fn();
    renderWithPmoTheme(
      <>
        <LoadingSpinner label="Loading projects" />
        <LoadingSkeleton label="Loading project rows" />
        <EmptyState
          title="No projects"
          description="No projects match the current filters."
        />
        <ErrorState message="Projects could not be loaded." onRetry={retry} />
      </>,
    );

    expect(screen.getByText("Loading projects")).toBeTruthy();
    expect(
      screen.getByRole("status", { name: "Loading project rows" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No projects" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("allows keyboard focus on interactive controls", () => {
    renderWithPmoTheme(
      <>
        <AppButton text="Focusable action" />
        <TextInput label="Focusable field" value="" />
      </>,
    );
    const button = screen.getByRole("button", { name: "Focusable action" });
    const input = screen.getByRole("textbox", { name: "Focusable field" });

    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    act(() => input.focus());
    expect(document.activeElement).toBe(input);
  });
});
