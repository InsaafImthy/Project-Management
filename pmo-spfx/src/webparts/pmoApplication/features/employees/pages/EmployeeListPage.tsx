import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import type { IPmoEmployee } from "../../../models/domain";
import type { IEmployeeListFilters } from "../../../services/domain";
import type { IPmoEmployeeDraft } from "../../../validation/employees";
import {
  EntityListPage,
  FilterBar,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer } from "../../../components/layout";
import {
  AppButton,
  PercentageDisplay,
  SelectInput,
  StatusBadge,
  TextInput,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import { parseConfigNumber } from "../../../validation/configuration";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { getEmployeeActionVisibility } from "../../../validation/employees";
import { EmployeeFormPanel } from "../components/EmployeeFormPanel";
import { useEmployeePage } from "../hooks/useEmployees";
import { EMPLOYEE_ROUTES } from "../routes";

const initialFilters = (
  query: Readonly<Record<string, string>>,
): IEmployeeListFilters => ({
  employmentStatus:
    PMO_CHOICES.employees.employmentStatus.indexOf(
      query.status as IPmoEmployee["employmentStatus"],
    ) >= 0
      ? (query.status as IPmoEmployee["employmentStatus"])
      : undefined,
  department: query.department || undefined,
  eligibility:
    ["projectManager", "qa", "approver", "resourceManager"].indexOf(
      query.eligibility ?? "",
    ) >= 0
      ? (query.eligibility as IEmployeeListFilters["eligibility"])
      : undefined,
  isActive:
    query.active === "true"
      ? true
      : query.active === "false"
        ? false
        : undefined,
  search: query.search || undefined,
});

export const EmployeeListPage = (): React.ReactElement => {
  const services = usePmoServices();
  const user = usePmoCurrentUser();
  const interactions = usePmoInteractions();
  const { route, navigate } = usePmoRoute();
  const actions = getEmployeeActionVisibility(user.capabilities);
  const canManage = actions.canEdit;
  const [filters, setFilters] = React.useState<IEmployeeListFilters>(() =>
    initialFilters(route.query),
  );
  const [searchValue, setSearchValue] = React.useState(filters.search ?? "");
  const [departmentValue, setDepartmentValue] = React.useState(
    filters.department ?? "",
  );
  const page = useEmployeePage(services.employees, filters);
  const [editing, setEditing] = React.useState<IPmoEmployee>();
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string>();
  const [maximumDailyHours, setMaximumDailyHours] = React.useState(24);
  React.useEffect(() => {
    services.settings.cache
      .getActive()
      .then((settings) => {
        const configured = settings.find(
          (setting) => setting.key === "StandardHoursPerDay",
        );
        setMaximumDailyHours(parseConfigNumber(configured?.value ?? "") ?? 24);
      })
      .catch(() => setMaximumDailyHours(24));
  }, [services.settings]);
  const updateFilters = (next: IEmployeeListFilters): void => {
    setFilters(next);
  };
  const openDetail = (employee: IPmoEmployee): void => {
    const query: Record<string, string> = {
      view: EMPLOYEE_ROUTES.detail,
      employeeId: String(employee.id),
      returnView: EMPLOYEE_ROUTES.list,
    };
    if (filters.employmentStatus) query.status = filters.employmentStatus;
    if (filters.department) query.department = filters.department;
    if (filters.eligibility) query.eligibility = filters.eligibility;
    if (filters.isActive !== undefined) query.active = String(filters.isActive);
    if (filters.search) query.search = filters.search;
    navigate({
      view: EMPLOYEE_ROUTES.detail,
      parameters: {
        employeeId: String(employee.id),
        returnView: EMPLOYEE_ROUTES.list,
      },
      query,
    });
  };
  const openForm = (employee?: IPmoEmployee): void => {
    setEditing(employee);
    setFormError(undefined);
    setFormOpen(true);
  };
  const save = async (draft: IPmoEmployeeDraft): Promise<void> => {
    setSaving(true);
    setFormError(undefined);
    try {
      await services.employees.save(draft, editing);
      setFormOpen(false);
      page.reload();
      interactions.publishMessage({
        tone: "success",
        text: editing ? "Employee updated." : "Employee created.",
      });
    } catch (error) {
      setFormError(toUserSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const toggleActive = async (employee: IPmoEmployee): Promise<void> => {
    const next = !employee.isActive;
    const confirmed = await interactions.requestConfirmation({
      title: next ? "Activate employee" : "Deactivate employee",
      message: next
        ? `Activate ${employee.name}?`
        : `Deactivate ${employee.name}? Active memberships and assignments will be checked first.`,
      confirmLabel: next ? "Activate" : "Deactivate",
      destructive: !next,
    });
    if (!confirmed) return;
    try {
      await services.employees.setActive(employee, next);
      page.reload();
      interactions.publishMessage({
        tone: "success",
        text: `${employee.name} was ${next ? "activated" : "deactivated"}.`,
      });
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  const columns: readonly IDataTableColumn<IPmoEmployee>[] = [
    {
      key: "name",
      header: "Employee",
      render: (employee) => <strong>{employee.name}</strong>,
    },
    {
      key: "number",
      header: "Number",
      render: (employee) => employee.employeeNumber,
    },
    {
      key: "department",
      header: "Department",
      render: (employee) => employee.department,
    },
    {
      key: "status",
      header: "Status",
      render: (employee) => (
        <StatusBadge
          text={employee.employmentStatus}
          tone={employee.isActive ? "success" : "disabled"}
        />
      ),
    },
    {
      key: "capacity",
      header: "Capacity",
      align: "right",
      render: (employee) => (
        <PercentageDisplay value={employee.capacityPercent} />
      ),
    },
    {
      key: "eligibility",
      header: "Eligibility",
      render: (employee) =>
        [
          employee.isProjectManager ? "PM" : "",
          employee.isQa ? "QA" : "",
          employee.isApprover ? "Approver" : "",
          employee.isResourceManager ? "Resource" : "",
        ]
          .filter(Boolean)
          .join(", ") || "None",
    },
  ];
  return (
    <ContentContainer>
      <EntityListPage
        title="Employees"
        subtitle="Filter indexed profile, status, department, and eligibility fields."
        breadcrumbs={[{ text: "Employees" }, { text: "Employee list" }]}
        ariaLabel="Employees"
        items={page.items}
        columns={columns}
        getRowKey={(employee) => String(employee.id)}
        paging={{
          pageIndex: page.pageIndex,
          pageSize: page.pageSize,
          totalItems: page.totalItems,
        }}
        onPageChange={page.setPageIndex}
        loading={page.loading}
        errorMessage={page.error}
        onRetry={page.reload}
        onCreate={canManage ? () => openForm() : undefined}
        createLabel="Create employee"
        getRowActions={(employee) => [
          { key: "open", label: "Open", onClick: openDetail },
          ...(canManage
            ? [
                { key: "edit", label: "Edit", onClick: openForm },
                {
                  key: "active",
                  label: employee.isActive ? "Deactivate" : "Activate",
                  onClick: toggleActive,
                },
              ]
            : []),
        ]}
        filterSlot={
          <FilterBar
            searchLabel="Search employees"
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            onSearch={(search) => updateFilters({ ...filters, search })}
            controls={
              <>
                <SelectInput
                  label="Status"
                  value={filters.employmentStatus ?? "all"}
                  options={[
                    { key: "all", text: "All statuses" },
                    ...PMO_CHOICES.employees.employmentStatus.map((status) => ({
                      key: status,
                      text: status,
                    })),
                  ]}
                  onChange={(status) =>
                    updateFilters({
                      ...filters,
                      employmentStatus:
                        status === "all"
                          ? undefined
                          : (status as IPmoEmployee["employmentStatus"]),
                    })
                  }
                />
                <TextInput
                  label="Department"
                  value={departmentValue}
                  onChange={setDepartmentValue}
                />
                <AppButton
                  text="Apply department"
                  onClick={() =>
                    updateFilters({
                      ...filters,
                      department: departmentValue.trim() || undefined,
                    })
                  }
                />
                <SelectInput
                  label="Eligibility"
                  value={filters.eligibility ?? "all"}
                  options={[
                    { key: "all", text: "All roles" },
                    { key: "projectManager", text: "Project Manager" },
                    { key: "qa", text: "QA" },
                    { key: "approver", text: "Approver" },
                    { key: "resourceManager", text: "Resource Manager" },
                  ]}
                  onChange={(eligibility) =>
                    updateFilters({
                      ...filters,
                      eligibility:
                        eligibility === "all"
                          ? undefined
                          : (eligibility as IEmployeeListFilters["eligibility"]),
                    })
                  }
                />
                <SelectInput
                  label="Active"
                  value={
                    filters.isActive === undefined
                      ? "all"
                      : String(filters.isActive)
                  }
                  options={[
                    { key: "true", text: "Active" },
                    { key: "false", text: "Inactive" },
                    { key: "all", text: "All" },
                  ]}
                  onChange={(active) =>
                    updateFilters({
                      ...filters,
                      isActive:
                        active === "all" ? undefined : active === "true",
                    })
                  }
                />
              </>
            }
            activeFilterCount={
              Object.keys(filters).filter((key) => {
                const value = filters[key as keyof IEmployeeListFilters];
                return value !== undefined && value !== "";
              }).length
            }
            onClearAll={() => {
              setSearchValue("");
              setDepartmentValue("");
              updateFilters({});
            }}
          />
        }
      />
      <EmployeeFormPanel
        open={formOpen}
        employee={editing}
        people={services.people}
        maximumDailyHours={maximumDailyHours}
        saving={saving}
        serverError={formError}
        onDismiss={() => setFormOpen(false)}
        onSave={(draft) => {
          save(draft).catch(() => undefined);
        }}
      />
    </ContentContainer>
  );
};
