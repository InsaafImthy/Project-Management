import * as React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { FormDialog, UnsavedChangesGuard } from "../components/composites";
import { AppButton, TextInput } from "../components/primitives";
import { renderWithPmoTheme } from "./renderWithPmoTheme";

const DialogHarness = ({
  invalid = false,
}: {
  readonly invalid?: boolean;
}): React.ReactElement => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <AppButton text="Edit record" onClick={() => setOpen(true)} />
      <FormDialog
        open={open}
        title="Edit record"
        onDismiss={() => setOpen(false)}
        onSubmit={() => setOpen(false)}
        validationIssues={
          invalid
            ? [
                {
                  key: "name",
                  fieldId: "dialog-name",
                  message: "Name is required.",
                },
              ]
            : []
        }
      >
        <TextInput id="dialog-name" label="Name" />
      </FormDialog>
    </>
  );
};

describe("shared form workflows", () => {
  it("blocks invalid dialog submission and exposes its validation summary", () => {
    renderWithPmoTheme(<DialogHarness invalid />);
    fireEvent.click(screen.getByRole("button", { name: "Edit record" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Name is required.")).toBeTruthy();
  });

  it("returns focus to the trigger after dialog dismissal and supports Escape", async () => {
    renderWithPmoTheme(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Edit record" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      which: 27,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("warns for browser and in-app navigation while changes are unsaved", () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    renderWithPmoTheme(<UnsavedChangesGuard active />);
    const unload = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(unload)).toBe(false);
    const navigate = new Event("pmo:before-navigate", { cancelable: true });
    expect(window.dispatchEvent(navigate)).toBe(false);
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });
});
