import { PMO_LISTS } from "../config/sharePointSchema";
import {
  PMO_NAVIGATION,
  PMO_ROUTE_AUTHORIZATION,
  canOpenPmoRoute,
  isKnownPmoRoute,
} from "../routing/pmoRoutes";
import { SupportDiagnosticsService } from "../services/domain/SupportDiagnosticsService";
import type {
  IPmoResolvedUserContext,
  PmoCapability,
  PmoSecurityRole,
} from "../services/domain/UserCapabilityService";
import { SharePointError } from "../services/sharepoint/SharePointError";
import type { ISharePointClient } from "../services/sharepoint/SharePointClient";
import { toUserSafeErrorMessage } from "../utils/toUserSafeErrorMessage";

const actor = (
  capabilities: readonly PmoCapability[],
  securityRoles: readonly PmoSecurityRole[] = ["support"],
): IPmoResolvedUserContext => ({
  sharePointUserId: 10,
  displayName: "Support User",
  email: "support@example.test",
  loginName: "i:0#.f|membership|support@example.test",
  eligibility: {
    isProjectManager: false,
    isQa: false,
    isApprover: false,
    isResourceManager: false,
  },
  securityRoles: new Set(securityRoles),
  capabilities: new Set(capabilities),
});

describe("Stage 13 production hardening", () => {
  it("registers every navigation route and enforces direct-link capabilities", () => {
    for (const item of PMO_NAVIGATION) {
      expect(isKnownPmoRoute(item.route)).toBe(true);
    }
    expect(Object.keys(PMO_ROUTE_AUTHORIZATION).length).toBeGreaterThan(30);
    expect(canOpenPmoRoute([], "home")).toBe(true);
    expect(canOpenPmoRoute([], "project-costs")).toBe(false);
    expect(canOpenPmoRoute(["finance.view"], "project-costs")).toBe(true);
    expect(
      canOpenPmoRoute(["support.failed-actions"], "support-diagnostics"),
    ).toBe(true);
    expect(canOpenPmoRoute(["projects.view"], "unknown-route")).toBe(false);
  });

  it("preserves SharePoint correlation IDs in safe user messages", () => {
    const message = toUserSafeErrorMessage(
      new SharePointError(
        "Internal server details",
        503,
        "11111111-2222-3333-4444-555555555555",
        "temporary",
      ),
    );
    expect(message).toContain("temporarily unavailable");
    expect(message).toContain("11111111-2222-3333-4444-555555555555");
    expect(message).not.toContain("Internal server details");
  });

  it("shows sanitized SharePoint validation details and HTTP context", () => {
    const message = toUserSafeErrorMessage(
      new SharePointError(
        "The query to field <b>'Author'</b> is not valid. See https://example.test/private",
        400,
        "corr-400",
        "validation",
        "-1, Microsoft.SharePoint.SPException",
        "GET",
        "https://tenant.sharepoint.com/sites/pmo/_api/web/lists/getbytitle('PMO_Employees')/items?$filter=Email",
      ),
    );
    expect(message).toContain("HTTP 400");
    expect(message).toContain("query to field 'Author'");
    expect(message).toContain("SharePoint GET /sites/pmo/_api/web/lists");
    expect(message).not.toContain("<b>");
    expect(message).not.toContain("example.test/private");
    expect(message).not.toContain("$filter");
  });

  it("keeps restricted containers out of support diagnostics", async () => {
    const getJson = jest.fn().mockResolvedValue({
      EffectiveBasePermissions: { High: "0", Low: "7" },
    });
    const query = jest.fn().mockResolvedValue({ items: [] });
    const client = { getJson, query } as unknown as ISharePointClient;
    const capabilities = {
      resolveCurrent: jest
        .fn()
        .mockResolvedValue(actor(["support.failed-actions"])),
    };
    const service = new SupportDiagnosticsService(
      client,
      capabilities as never,
      () => new Date("2026-11-10T08:00:00Z"),
    );

    const result = await service.run();

    const requestedUrls = getJson.mock.calls.map((call) => String(call[0]));
    expect(
      requestedUrls.some((url) => url.includes(PMO_LISTS.employeeRates)),
    ).toBe(false);
    expect(
      requestedUrls.some((url) => url.includes(PMO_LISTS.projectFinancials)),
    ).toBe(false);
    expect(
      requestedUrls.some((url) => url.includes(PMO_LISTS.projectCosts)),
    ).toBe(false);
    expect(result.permissions.every((permission) => permission.ready)).toBe(
      true,
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
});
