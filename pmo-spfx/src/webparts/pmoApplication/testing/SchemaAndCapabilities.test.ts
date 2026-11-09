import { PMO_CONTAINERS, PMO_FIELDS } from "../config/sharePointSchema";
import type { IPmoEmployee } from "../models/domain";
import {
  UserCapabilityService,
  canOpenRoute,
  hasCapability,
} from "../services/domain/UserCapabilityService";
import type { ISharePointClient } from "../services/sharepoint/SharePointClient";

describe("SharePoint schema registry", () => {
  it("covers 17 lists, the document library, and all 327 documented fields", () => {
    expect(
      new Set(
        Object.keys(PMO_CONTAINERS).map(
          (key) => PMO_CONTAINERS[key as keyof typeof PMO_CONTAINERS],
        ),
      ).size,
    ).toBe(18);
    const systemFields = new Set([
      "ID",
      "Created",
      "Modified",
      "Author",
      "Editor",
      "FileLeafRef",
      "FileRef",
    ]);
    const documentedCount = Object.keys(PMO_FIELDS).reduce((total, listKey) => {
      const fields = PMO_FIELDS[listKey as keyof typeof PMO_FIELDS];
      return (
        total +
        Object.keys(fields).filter(
          (fieldKey) =>
            !systemFields.has(fields[fieldKey as keyof typeof fields]),
        ).length
      );
    }, 0);
    expect(documentedCount).toBe(327);
  });
});

const employee: IPmoEmployee = {
  id: 5,
  etag: '"1"',
  name: "Employee",
  employeeNumber: "E-5",
  user: { id: 10, displayName: "Employee", email: "employee@example.com" },
  email: "employee@example.com",
  department: "Delivery",
  employmentStatus: "Active",
  standardHoursPerDay: 8,
  capacityPercent: 100,
  isProjectManager: false,
  isQa: true,
  isApprover: false,
  isResourceManager: false,
  isActive: true,
};

describe("UserCapabilityService", () => {
  it("keeps eligibility separate from SharePoint security roles", async () => {
    const client = {
      getJson: async (url: string): Promise<unknown> =>
        url.indexOf("groups") >= 0
          ? { value: [{ Title: "PMO Employees" }] }
          : {
              Id: 10,
              Title: "Employee",
              Email: "Employee@Example.com",
              LoginName: "i:0#.f|membership|employee@example.com",
            },
    } as unknown as ISharePointClient;
    const service = new UserCapabilityService(
      client,
      { getActiveByEmail: async () => employee },
      { getActiveForEmployee: async () => ({ items: [] }) },
    );
    const user = await service.resolveCurrent();
    expect(user.eligibility.isQa).toBe(true);
    expect(user.securityRoles.has("qa")).toBe(false);
    expect(hasCapability(user, "quality.manage")).toBe(false);
    expect(hasCapability(user, "work.act-own")).toBe(true);
  });

  it("does not grant an identity-based administrator override", async () => {
    const client = {
      getJson: async (url: string): Promise<unknown> =>
        url.indexOf("groups") >= 0
          ? { value: [] }
          : {
              Id: 42,
              Title: "Insaaf Imthiyas",
              Email: "INsaaf.Imthiyas@AufaitTechnologies.com ",
              LoginName:
                "i:0#.f|membership|insaaf.imthiyas@aufaittechnologies.com",
            },
    } as unknown as ISharePointClient;
    const getActiveByEmail = jest.fn(async () => employee);
    const service = new UserCapabilityService(
      client,
      { getActiveByEmail },
      { getActiveForEmployee: async () => ({ items: [] }) },
    );

    const user = await service.resolveCurrent();

    expect(getActiveByEmail).toHaveBeenCalledWith(
      "insaaf.imthiyas@aufaittechnologies.com",
    );
    expect(user.employee).toBe(employee);
    expect(user.email).toBe("insaaf.imthiyas@aufaittechnologies.com");
    expect(user.securityRoles.size).toBe(0);
    expect(user.eligibility.isQa).toBe(true);
    expect(user.capabilities.size).toBe(0);
    expect(hasCapability(user, "configuration.manage")).toBe(false);
    expect(hasCapability(user, "finance.manage")).toBe(false);
    expect(hasCapability(user, "work.act-own")).toBe(false);
    expect(canOpenRoute(user, "settings")).toBe(false);
    expect(canOpenRoute(user, "employee-rates")).toBe(false);
  });
});
