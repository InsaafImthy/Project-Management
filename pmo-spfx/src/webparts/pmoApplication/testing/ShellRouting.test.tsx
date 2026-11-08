import * as React from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { Sidebar } from "../components/layout";
import {
  PMO_NAVIGATION,
  PmoRouteProvider,
  parsePmoRoute,
  requestPmoNavigation,
  usePmoRoute,
} from "../routing/pmoRoutes";
import { renderWithPmoTheme } from "./renderWithPmoTheme";

describe("application shell and query-string routing", () => {
  it("marks the active route and filters navigation by capability", () => {
    renderWithPmoTheme(
      <Sidebar
        items={PMO_NAVIGATION}
        capabilities={["projects.view"]}
        activeRoute="projects"
        collapsed={false}
        onCollapsedChange={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    const projects = screen.getByRole("button", { name: "Projects" });
    expect(projects.getAttribute("aria-current")).toBe("page");
    expect(
      screen.queryByRole("button", { name: "Financial Summary" }),
    ).toBeNull();
    act(() => projects.focus());
    expect(document.activeElement).toBe(projects);
  });

  it("parses standard route parameters and preserves feature filters", () => {
    const route = parsePmoRoute(
      "?view=project-overview&projectId=120&status=active",
    );
    expect(route.view).toBe("project-overview");
    expect(route.parameters.projectId).toBe("120");
    expect(route.query.status).toBe("active");
  });

  it("pushes query-string navigation and delegates Back to browser history", () => {
    const pushState = jest.spyOn(window.history, "pushState");
    expect(
      requestPmoNavigation({
        view: "task",
        parameters: { workItemId: "845" },
        query: {},
      }),
    ).toBe(true);
    expect(pushState).toHaveBeenCalledWith({}, "", "?view=task&workItemId=845");
    pushState.mockRestore();

    const back = jest
      .spyOn(window.history, "back")
      .mockImplementation(() => undefined);
    const BackHarness = (): React.ReactElement => {
      const route = usePmoRoute();
      return <button onClick={route.back}>Back</button>;
    };
    renderWithPmoTheme(
      <PmoRouteProvider>
        <BackHarness />
      </PmoRouteProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });
});
