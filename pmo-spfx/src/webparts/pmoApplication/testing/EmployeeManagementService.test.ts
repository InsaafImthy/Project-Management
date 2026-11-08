jest.mock("@microsoft/sp-http", () => ({
  SPHttpClient: { configurations: { v1: {} } },
}));

import type { IPmoEmployee } from "../models/domain";
import { EmployeeManagementService } from "../services/domain";
import type {
  IPmoResolvedUserContext,
  PmoCapability,
  PmoSecurityRole,
} from "../services/domain/UserCapabilityService";
import { SharePointError } from "../services/sharepoint/SharePointError";
import { toUserSafeErrorMessage } from "../utils/toUserSafeErrorMessage";

const employee: IPmoEmployee = {
  id: 7,
  etag: '"3"',
  name: "Aisha Noor",
  employeeNumber: "EMP-100",
  user: { id: 15, displayName: "Aisha Noor", email: "aisha@example.com" },
  email: "aisha@example.com",
  department: "Delivery",
  employmentStatus: "Active",
  standardHoursPerDay: 8,
  capacityPercent: 100,
  isProjectManager: true,
  isQa: false,
  isApprover: false,
  isResourceManager: false,
  isActive: true,
};

const actor: IPmoResolvedUserContext = {
  sharePointUserId: 1,
  displayName: "PMO Owner",
  email: "owner@example.com",
  loginName: "owner@example.com",
  eligibility: {
    isProjectManager: false,
    isQa: false,
    isApprover: false,
    isResourceManager: false,
  },
  securityRoles: new Set<PmoSecurityRole>(["owner"]),
  capabilities: new Set<PmoCapability>(["employees.manage"]),
};

const draft = {
  name: employee.name,
  employeeNumber: employee.employeeNumber,
  user: employee.user,
  email: employee.email,
  department: employee.department,
  employmentStatus: employee.employmentStatus,
  standardHoursPerDay: employee.standardHoursPerDay,
  capacityPercent: 90,
  isProjectManager: employee.isProjectManager,
  isQa: employee.isQa,
  isApprover: employee.isApprover,
  isResourceManager: employee.isResourceManager,
  isActive: true,
};

const createService = (update: jest.Mock): EmployeeManagementService => {
  const employees = {
    getByEmployeeNumber: jest.fn().mockResolvedValue(employee),
    getByEmail: jest.fn().mockResolvedValue(employee),
    update,
  };
  return new EmployeeManagementService(
    employees as never,
    {} as never,
    {} as never,
    { resolveCurrent: jest.fn().mockResolvedValue(actor) } as never,
    async () => 8,
  );
};

describe("Employee edits", () => {
  it("updates with the current ETag and returns the saved employee", async () => {
    const saved = { ...employee, etag: '"4"', capacityPercent: 90 };
    const update = jest.fn().mockResolvedValue(saved);
    const service = createService(update);

    await expect(service.save(draft, employee)).resolves.toEqual(saved);
    expect(update).toHaveBeenCalledWith(
      employee.id,
      expect.objectContaining({ CapacityPercent: 90 }),
      employee.etag,
    );
  });

  it("preserves a conflict as a readable reload message", async () => {
    const update = jest
      .fn()
      .mockRejectedValue(
        new SharePointError("Version conflict", 412, "corr-1", "conflict"),
      );
    const service = createService(update);
    let caught: unknown;
    try {
      await service.save(draft, employee);
    } catch (error) {
      caught = error;
    }
    expect(toUserSafeErrorMessage(caught)).toMatch(/changed.*Reload/i);
  });
});
