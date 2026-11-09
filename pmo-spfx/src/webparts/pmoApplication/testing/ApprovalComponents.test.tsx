import * as React from "react";
import { screen } from "@testing-library/react";
import { ReasonDialog, Timeline } from "../components/composites";
import { PmoApplicationProvider } from "../context/PmoApplicationContext";
import {
  PmoServicesContext,
  type IPmoFeatureServices,
} from "../context/PmoServicesContext";
import { ChangeRequestForm } from "../features/approvals/pages/ApprovalPages";
import { renderWithPmoTheme } from "./renderWithPmoTheme";

describe("Stage 09 approval components", () => {
  it("adapts a new request form to additional-effort source values", async () => {
    const changes = {
      getProjects: async () => ({ items: [] }),
      getWorkItems: async () => ({ items: [] }),
      routingPreview: async () => ({
        route: "Project Manager" as const,
        material: false,
        reason: "Select a source project to preview approval routing.",
      }),
      saveDraft: async () => {
        throw new Error("not called");
      },
    };
    renderWithPmoTheme(
      <PmoApplicationProvider
        currentUser={{
          displayName: "User",
          email: "user@example.com",
          capabilities: [],
        }}
      >
        <PmoServicesContext.Provider
          value={{ changes } as unknown as IPmoFeatureServices}
        >
          <ChangeRequestForm
            open
            onDismiss={() => undefined}
            onSaved={() => undefined}
          />
        </PmoServicesContext.Provider>
      </PmoApplicationProvider>,
    );
    expect(await screen.findByText("Additional hours requested")).toBeTruthy();
    expect(screen.getByText("Read-only source values")).toBeTruthy();
    expect(screen.getByText("Approval routing preview")).toBeTruthy();
  });

  it("renders a required decision dialog and an accessible approval timeline", () => {
    renderWithPmoTheme(
      <>
        <ReasonDialog
          open
          title="Reject approval"
          actionLabel="Reject"
          onDismiss={() => undefined}
          onSubmit={() => undefined}
        />
        <Timeline
          ariaLabel="Approval timeline"
          items={[
            {
              key: "submitted",
              title: "Submitted",
              actor: "Requestor",
              detail: "Original and proposed values recorded.",
            },
          ]}
        />
      </>,
    );
    expect(screen.getByRole("dialog").textContent).toContain("Reject approval");
    expect(screen.getByLabelText("Approval timeline").textContent).toContain(
      "Original and proposed values recorded.",
    );
  });
});
