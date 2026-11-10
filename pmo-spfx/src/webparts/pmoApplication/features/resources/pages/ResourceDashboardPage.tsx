import * as React from "react";
import {
  DashboardLayout,
  EntityListPage,
  KpiCard,
  KpiGrid,
  SummaryCard,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  DateDisplay,
  LoadingSkeleton,
  StatusBadge,
} from "../../../components/primitives";
import { usePmoServices } from "../../../context/PmoServicesContext";
import type { IResourceRow } from "../../../services/domain/ResourceManagementService";
import { usePmoRoute } from "../../../routing/pmoRoutes";

export const ResourceDashboardPage = (): React.ReactElement => {
  const { resources } = usePmoServices();
  const { navigate } = usePmoRoute();
  const [data, setData] =
    React.useState<Awaited<ReturnType<typeof resources.dashboard>>>();
  const start = new Date();
  const end = new Date(start.valueOf() + 30 * 86400000);
  React.useEffect(() => {
    void resources
      .dashboard(start, end)
      .then(setData)
      .catch(() => undefined);
  }, [resources]);
  if (!data)
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading resource capacity" />
      </ContentContainer>
    );
  const columns: readonly IDataTableColumn<IResourceRow>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => <strong>{row.employee.name}</strong>,
    },
    {
      key: "department",
      header: "Department",
      render: (row) => row.employee.department,
    },
    {
      key: "skills",
      header: "Skills",
      render: (row) => row.employee.skillsSummary ?? "—",
    },
    {
      key: "capacity",
      header: "Capacity",
      render: (row) => `${row.capacityPercent}%`,
    },
    {
      key: "allocated",
      header: "Allocated",
      render: (row) => `${row.allocationPercent}%`,
    },
    {
      key: "availability",
      header: "Availability",
      render: (row) => <StatusBadge text={row.availability} />,
    },
    {
      key: "warnings",
      header: "Warnings",
      render: (row) => row.warnings.join(" ") || "—",
    },
  ];
  return (
    <ContentContainer>
      <DashboardLayout>
        <PageHeader
          title="Resources"
          subtitle="Capacity is assembled from active Project Members for the selected period; it never exposes salary or cost data."
          breadcrumbs={[{ text: "Operations" }, { text: "Resources" }]}
        />
        <KpiGrid>
          <KpiCard title="Capacity" value={`${data.totalCapacityPercent}%`} />
          <KpiCard title="Fully allocated" value={data.fullyAllocated} />
          <KpiCard
            title="Partially allocated"
            value={data.partiallyAllocated}
          />
          <KpiCard title="Available" value={data.available} />
          <KpiCard
            title="Over-allocated"
            value={data.overAllocated}
            status={{
              label: data.overAllocated ? "Review" : "Clear",
              tone: data.overAllocated ? "warning" : "success",
            }}
          />
        </KpiGrid>
        <SummaryCard title="Selected date range">
          <p>
            <DateDisplay value={start} /> to <DateDisplay value={end} />.
            Allocation warnings identify overlapping active memberships and
            capacity exceedance.
          </p>
        </SummaryCard>
        <EntityListPage
          title="Resource capacity"
          subtitle="Employee, department, skill summary and explainable allocation detail."
          ariaLabel="Resource capacity"
          items={data.rows}
          columns={columns}
          getRowKey={(row) => String(row.employee.id)}
          paging={{ pageIndex: 0, pageSize: 100, totalItems: data.rows.length }}
          onPageChange={() => undefined}
          getRowActions={(row) => [
            {
              key: "detail",
              label: "Open employee",
              onClick: () =>
                navigate({
                  view: "employee",
                  parameters: { employeeId: String(row.employee.id) },
                  query: {
                    view: "employee",
                    employeeId: String(row.employee.id),
                    returnView: "resources",
                  },
                }),
            },
          ]}
        />
      </DashboardLayout>
    </ContentContainer>
  );
};
