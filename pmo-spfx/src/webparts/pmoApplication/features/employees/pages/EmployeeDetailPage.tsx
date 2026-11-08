import * as React from "react";
import type { IPmoEmployee, IPmoProjectMember } from "../../../models/domain";
import type { IPmoEmployeeDraft } from "../../../validation/employees";
import {
  DataTable,
  DescriptionList,
  EntityDetailLayout,
  SummaryCard,
  type IDataTableColumn,
} from "../../../components/composites";
import { ContentContainer, PageHeader } from "../../../components/layout";
import {
  AppButton,
  AvatarName,
  DateDisplay,
  ErrorState,
  HoursDisplay,
  LoadingSkeleton,
  PercentageDisplay,
  Stack,
  StatusBadge,
} from "../../../components/primitives";
import { usePmoInteractions } from "../../../context/PmoApplicationContext";
import { usePmoServices } from "../../../context/PmoServicesContext";
import { usePmoCurrentUser } from "../../../hooks/usePmoCurrentUser";
import { usePmoRoute } from "../../../routing/pmoRoutes";
import { parseConfigNumber } from "../../../validation/configuration";
import { toUserSafeErrorMessage } from "../../../utils/toUserSafeErrorMessage";
import { getEmployeeActionVisibility } from "../../../validation/employees";
import { EmployeeFormPanel } from "../components/EmployeeFormPanel";
import { useEmployeeDetail } from "../hooks/useEmployees";
import { EMPLOYEE_ROUTES } from "../routes";

export const EmployeeDetailPage = ({
  myProfile = false,
}: {
  readonly myProfile?: boolean;
}): React.ReactElement => {
  const services = usePmoServices();
  const currentUser = usePmoCurrentUser();
  const interactions = usePmoInteractions();
  const { route, navigate, back } = usePmoRoute();
  const employeeId = Number(
    route.parameters.employeeId ?? route.query.employeeId,
  );
  const detail = useEmployeeDetail(
    services.employees,
    Number.isInteger(employeeId) && employeeId > 0 ? employeeId : undefined,
    myProfile,
  );
  const canManage = getEmployeeActionVisibility(
    currentUser.capabilities,
    myProfile,
  ).canEdit;
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
  const returnToList = (): void => {
    if (myProfile) return back();
    const query: Record<string, string> = { ...route.query };
    delete query.employeeId;
    delete query.returnView;
    query.view = EMPLOYEE_ROUTES.list;
    navigate({ view: EMPLOYEE_ROUTES.list, parameters: {}, query });
  };
  const save = async (draft: IPmoEmployeeDraft): Promise<void> => {
    if (!detail.employee) return;
    setSaving(true);
    setFormError(undefined);
    try {
      await services.employees.save(draft, detail.employee);
      setFormOpen(false);
      detail.reload();
      interactions.publishMessage({
        tone: "success",
        text: "Employee updated.",
      });
    } catch (error) {
      setFormError(toUserSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const toggleActive = async (): Promise<void> => {
    if (!detail.employee) return;
    const next = !detail.employee.isActive;
    const confirmed = await interactions.requestConfirmation({
      title: next ? "Activate employee" : "Deactivate employee",
      message: next
        ? `Activate ${detail.employee.name}?`
        : "Active project memberships and work assignments must be ended first.",
      confirmLabel: next ? "Activate" : "Deactivate",
      destructive: !next,
    });
    if (!confirmed) return;
    try {
      await services.employees.setActive(detail.employee, next);
      detail.reload();
      interactions.publishMessage({
        tone: "success",
        text: `${detail.employee.name} was ${next ? "activated" : "deactivated"}.`,
      });
    } catch (error) {
      interactions.publishMessage({
        tone: "danger",
        text: toUserSafeErrorMessage(error),
      });
    }
  };
  if (detail.loading) {
    return (
      <ContentContainer>
        <LoadingSkeleton label="Loading employee profile" />
      </ContentContainer>
    );
  }
  if (detail.error || !detail.employee) {
    return (
      <ContentContainer>
        <ErrorState
          message={detail.error ?? "Employee profile was not found."}
          onRetry={detail.reload}
        />
      </ContentContainer>
    );
  }
  const employee: IPmoEmployee = detail.employee;
  const membershipColumns: readonly IDataTableColumn<IPmoProjectMember>[] = [
    {
      key: "project",
      header: "Project",
      render: (member) => member.projectCode,
    },
    { key: "role", header: "Role", render: (member) => member.projectRole },
    {
      key: "allocation",
      header: "Allocation",
      render: (member) => (
        <PercentageDisplay value={member.allocationPercent} />
      ),
    },
    {
      key: "period",
      header: "Period",
      render: (member) => (
        <>
          <DateDisplay value={member.allocationStart} /> –{" "}
          <DateDisplay value={member.allocationEnd} />
        </>
      ),
    },
  ];
  const eligibility = [
    employee.isProjectManager ? "Project Manager" : "",
    employee.isQa ? "QA" : "",
    employee.isApprover ? "Approver" : "",
    employee.isResourceManager ? "Resource Manager" : "",
  ].filter(Boolean);
  return (
    <ContentContainer>
      <Stack gap="lg">
        <PageHeader
          title={myProfile ? "My Profile" : employee.name}
          subtitle={employee.jobTitle ?? employee.department}
          breadcrumbs={[
            ...(myProfile
              ? []
              : [{ text: "Employees", onClick: returnToList }]),
            { text: myProfile ? "My Profile" : employee.name },
          ]}
          commands={
            <Stack direction="horizontal" gap="sm" wrap>
              {!myProfile ? (
                <AppButton text="Back to employees" onClick={returnToList} />
              ) : null}
              {canManage ? (
                <>
                  <AppButton text="Edit" onClick={() => setFormOpen(true)} />
                  <AppButton
                    variant={employee.isActive ? "danger" : "primary"}
                    text={employee.isActive ? "Deactivate" : "Activate"}
                    onClick={() => {
                      toggleActive().catch(() => undefined);
                    }}
                  />
                </>
              ) : null}
            </Stack>
          }
        />
        <EntityDetailLayout
          summary={
            <DescriptionList
              items={[
                {
                  key: "person",
                  label: "Employee",
                  value: (
                    <AvatarName
                      name={employee.name}
                      secondaryText={employee.email}
                      size="medium"
                    />
                  ),
                },
                {
                  key: "number",
                  label: "Employee number",
                  value: employee.employeeNumber,
                },
                {
                  key: "department",
                  label: "Department",
                  value: employee.department,
                },
                {
                  key: "status",
                  label: "Status",
                  value: (
                    <StatusBadge
                      text={employee.employmentStatus}
                      tone={employee.isActive ? "success" : "disabled"}
                    />
                  ),
                },
                {
                  key: "manager",
                  label: "Manager",
                  value: employee.manager?.displayName ?? "Not set",
                },
                {
                  key: "location",
                  label: "Location",
                  value: employee.location ?? "Not set",
                },
              ]}
            />
          }
          sections={[
            {
              key: "capacity",
              title: "Capacity",
              content: (
                <SummaryCard title="Working capacity">
                  <DescriptionList
                    items={[
                      {
                        key: "hours",
                        label: "Standard hours per day",
                        value: (
                          <HoursDisplay
                            value={employee.standardHoursPerDay}
                            precision={2}
                          />
                        ),
                      },
                      {
                        key: "capacity",
                        label: "Project capacity",
                        value: (
                          <PercentageDisplay value={employee.capacityPercent} />
                        ),
                      },
                      {
                        key: "start",
                        label: "Employment start",
                        value: (
                          <DateDisplay value={employee.employmentStartDate} />
                        ),
                      },
                      {
                        key: "end",
                        label: "Employment end",
                        value: (
                          <DateDisplay value={employee.employmentEndDate} />
                        ),
                      },
                    ]}
                  />
                </SummaryCard>
              ),
            },
            {
              key: "eligibility",
              title: "Eligibility",
              content: (
                <SummaryCard title="Eligible roles">
                  {eligibility.length
                    ? eligibility.join(", ")
                    : "No special role eligibility"}
                </SummaryCard>
              ),
            },
            {
              key: "skills",
              title: "Skills summary",
              content: (
                <SummaryCard title="Skills">
                  {employee.skillsSummary ??
                    "No skills summary has been recorded."}
                </SummaryCard>
              ),
            },
            {
              key: "memberships",
              title: "Project memberships",
              content: (
                <DataTable
                  ariaLabel="Project memberships"
                  items={detail.memberships}
                  columns={membershipColumns}
                  getRowKey={(member) => String(member.id)}
                  paging={{
                    pageIndex: 0,
                    pageSize: Math.max(1, detail.memberships.length),
                    totalItems: detail.memberships.length,
                  }}
                  onPageChange={() => undefined}
                  emptyTitle="No active project memberships"
                  emptyDescription="This employee has no active project memberships."
                />
              ),
            },
          ]}
        />
      </Stack>
      {canManage ? (
        <EmployeeFormPanel
          open={formOpen}
          employee={employee}
          people={services.people}
          maximumDailyHours={maximumDailyHours}
          saving={saving}
          serverError={formError}
          onDismiss={() => setFormOpen(false)}
          onSave={(draft) => {
            save(draft).catch(() => undefined);
          }}
        />
      ) : null}
    </ContentContainer>
  );
};
