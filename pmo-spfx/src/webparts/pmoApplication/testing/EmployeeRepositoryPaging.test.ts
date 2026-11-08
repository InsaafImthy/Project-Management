jest.mock("@microsoft/sp-http", () => ({
  SPHttpClient: { configurations: { v1: {} } },
}));

import { EmployeesRepository } from "../services/repositories";
import type { ISharePointClient } from "../services/sharepoint/SharePointClient";

describe("Employee list filters and paging integration", () => {
  it("builds an indexed filter and forwards the continuation token", async () => {
    const query = jest.fn().mockResolvedValue({
      items: [
        {
          ID: 1,
          Title: "Aisha Noor",
          EmployeeNumber: "EMP-100",
          EmployeeUser: {
            Id: 15,
            Title: "Aisha Noor",
            EMail: "aisha@example.com",
          },
          Email: "aisha@example.com",
          Department: "Delivery",
          EmploymentStatus: "Active",
          StandardHoursPerDay: 8,
          CapacityPercent: 100,
          IsProjectManager: false,
          IsQA: true,
          IsApprover: false,
          IsResourceManager: false,
          IsActive: true,
          "@odata.etag": '"1"',
        },
      ],
      nextLink: "next-page",
    });
    const client = { query } as unknown as ISharePointClient;
    const repository = new EmployeesRepository(client);

    const page = await repository.getPage(
      {
        employmentStatus: "Active",
        department: "Delivery",
        eligibility: "qa",
      },
      "current-page",
      25,
    );

    expect(page.continuation).toBe("next-page");
    expect(page.items[0]?.name).toBe("Aisha Noor");
    expect(query).toHaveBeenCalledWith(
      "PMO_Employees",
      expect.objectContaining({
        continuation: "current-page",
        top: 25,
        filter: expect.stringMatching(
          /EmploymentStatus eq 'Active'.*Department eq 'Delivery'.*IsQA eq 1/,
        ),
      }),
    );
  });
});
