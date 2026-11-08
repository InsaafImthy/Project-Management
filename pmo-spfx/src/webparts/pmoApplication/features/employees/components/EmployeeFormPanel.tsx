import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import type { IPmoEmployee, IPmoPerson } from "../../../models/domain";
import type { IPmoEmployeeDraft } from "../../../validation/employees";
import { validateEmployeeDraft } from "../../../validation/employees";
import {
  FormPanel,
  FormRow,
  FormSection,
  type IValidationIssue,
} from "../../../components/composites";
import {
  CheckboxInput,
  DateInput,
  NumberInput,
  PersonInput,
  SelectInput,
  Stack,
  TextArea,
  TextInput,
  type IPmoPerson as IPmoPickerPerson,
} from "../../../components/primitives";
import type { PeopleDirectoryService } from "../../../services/domain";

const isoDate = (date?: Date): string | undefined =>
  date ? date.toISOString().slice(0, 10) : undefined;

const emptyDraft = (): IPmoEmployeeDraft => ({
  name: "",
  employeeNumber: "",
  email: "",
  department: "",
  employmentStatus: "Active",
  standardHoursPerDay: 8,
  capacityPercent: 100,
  isProjectManager: false,
  isQa: false,
  isApprover: false,
  isResourceManager: false,
  isActive: true,
});

const fromEmployee = (employee: IPmoEmployee): IPmoEmployeeDraft => ({
  name: employee.name,
  employeeNumber: employee.employeeNumber,
  user: employee.user,
  email: employee.email,
  department: employee.department,
  jobTitle: employee.jobTitle,
  manager: employee.manager,
  location: employee.location,
  employmentStatus: employee.employmentStatus,
  employmentStartDate: isoDate(employee.employmentStartDate),
  employmentEndDate: isoDate(employee.employmentEndDate),
  standardHoursPerDay: employee.standardHoursPerDay,
  capacityPercent: employee.capacityPercent,
  skillsSummary: employee.skillsSummary,
  isProjectManager: employee.isProjectManager,
  isQa: employee.isQa,
  isApprover: employee.isApprover,
  isResourceManager: employee.isResourceManager,
  isActive: employee.isActive,
});

const pickerPerson = (person?: IPmoPerson): IPmoPickerPerson[] =>
  person
    ? [
        {
          id: String(person.id),
          email: person.email ?? "",
          text: person.displayName,
          secondaryText: person.email,
        },
      ]
    : [];

const domainPerson = (person?: IPmoPickerPerson): IPmoPerson | undefined =>
  person
    ? {
        id: Number(person.id),
        displayName: person.text ?? person.email,
        email: person.email,
      }
    : undefined;

export interface IEmployeeFormPanelProps {
  readonly open: boolean;
  readonly employee?: IPmoEmployee;
  readonly people: PeopleDirectoryService;
  readonly maximumDailyHours: number;
  readonly saving?: boolean;
  readonly serverError?: string;
  readonly onDismiss: () => void;
  readonly onSave: (draft: IPmoEmployeeDraft) => void;
}

export const EmployeeFormPanel = ({
  open,
  employee,
  people,
  maximumDailyHours,
  saving,
  serverError,
  onDismiss,
  onSave,
}: IEmployeeFormPanelProps): React.ReactElement => {
  const [draft, setDraft] = React.useState<IPmoEmployeeDraft>(emptyDraft);
  const [submitted, setSubmitted] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setDraft(employee ? fromEmployee(employee) : emptyDraft());
      setSubmitted(false);
    }
  }, [employee, open]);
  const errors = submitted
    ? validateEmployeeDraft(draft, maximumDailyHours)
    : {};
  const issues: IValidationIssue[] = Object.keys(errors).map((field) => ({
    key: field,
    fieldId: `employee-${field}`,
    message: errors[field] ?? "Invalid value.",
  }));
  if (serverError) issues.unshift({ key: "server", message: serverError });
  const patch = (values: Partial<IPmoEmployeeDraft>): void =>
    setDraft((current) => ({ ...current, ...values }));
  const resolvePeople = async (query: string): Promise<IPmoPickerPerson[]> =>
    (await people.search(query))
      .map((person) => pickerPerson(person)[0])
      .filter((person): person is IPmoPickerPerson => Boolean(person));
  const submit = (): void => {
    setSubmitted(true);
    if (!Object.keys(validateEmployeeDraft(draft, maximumDailyHours)).length) {
      onSave(draft);
    }
  };
  return (
    <FormPanel
      open={open}
      width="large"
      title={employee ? "Edit employee" : "Create employee"}
      saving={saving}
      validationIssues={issues}
      onDismiss={onDismiss}
      onSubmit={submit}
    >
      <Stack gap="xl">
        <FormSection title="Identity">
          <FormRow>
            <TextInput
              id="employee-name"
              label="Employee name"
              value={draft.name}
              required
              errorMessage={errors.name}
              onChange={(name) => patch({ name })}
            />
            <TextInput
              id="employee-employeeNumber"
              label="Employee number"
              value={draft.employeeNumber}
              required
              errorMessage={errors.employeeNumber}
              onChange={(employeeNumber) => patch({ employeeNumber })}
            />
          </FormRow>
          <FormRow>
            <PersonInput
              label="Microsoft 365 user"
              required
              selectedPeople={pickerPerson(draft.user)}
              errorMessage={errors.user}
              onResolveSuggestions={resolvePeople}
              onChange={(selected) => {
                const user = domainPerson(selected[0]);
                patch({ user, email: user?.email ?? draft.email });
              }}
            />
            <TextInput
              id="employee-email"
              label="Email"
              value={draft.email}
              required
              errorMessage={errors.email}
              onChange={(email) => patch({ email })}
            />
          </FormRow>
          <PersonInput
            label="Manager"
            selectedPeople={pickerPerson(draft.manager)}
            onResolveSuggestions={resolvePeople}
            onChange={(selected) =>
              patch({ manager: domainPerson(selected[0]) })
            }
          />
        </FormSection>
        <FormSection title="Employment">
          <FormRow>
            <TextInput
              id="employee-department"
              label="Department"
              value={draft.department}
              required
              errorMessage={errors.department}
              onChange={(department) => patch({ department })}
            />
            <TextInput
              label="Job title"
              value={draft.jobTitle}
              onChange={(jobTitle) => patch({ jobTitle })}
            />
            <TextInput
              label="Location"
              value={draft.location}
              onChange={(location) => patch({ location })}
            />
          </FormRow>
          <FormRow>
            <SelectInput
              id="employee-employmentStatus"
              label="Employment status"
              value={draft.employmentStatus}
              required
              errorMessage={errors.employmentStatus}
              options={PMO_CHOICES.employees.employmentStatus.map((status) => ({
                key: status,
                text: status,
              }))}
              onChange={(status) =>
                patch({
                  employmentStatus:
                    status as IPmoEmployeeDraft["employmentStatus"],
                })
              }
            />
            <DateInput
              label="Start date"
              value={draft.employmentStartDate}
              onChange={(employmentStartDate) => patch({ employmentStartDate })}
            />
            <DateInput
              id="employee-employmentEndDate"
              label="End date"
              value={draft.employmentEndDate}
              errorMessage={errors.employmentEndDate}
              onChange={(employmentEndDate) => patch({ employmentEndDate })}
            />
          </FormRow>
        </FormSection>
        <FormSection title="Capacity and eligibility">
          <FormRow>
            <NumberInput
              id="employee-standardHoursPerDay"
              label="Standard hours per day"
              value={draft.standardHoursPerDay}
              min={0.01}
              max={maximumDailyHours}
              precision={2}
              required
              errorMessage={errors.standardHoursPerDay}
              onChange={(standardHoursPerDay) => patch({ standardHoursPerDay })}
            />
            <NumberInput
              id="employee-capacityPercent"
              label="Capacity percent"
              value={draft.capacityPercent}
              min={0}
              max={100}
              precision={0}
              required
              errorMessage={errors.capacityPercent}
              onChange={(capacityPercent) => patch({ capacityPercent })}
            />
          </FormRow>
          <FormRow>
            <CheckboxInput
              label="Project Manager eligible"
              checked={draft.isProjectManager}
              onChange={(isProjectManager) => patch({ isProjectManager })}
            />
            <CheckboxInput
              label="QA eligible"
              checked={draft.isQa}
              onChange={(isQa) => patch({ isQa })}
            />
            <CheckboxInput
              label="Approver eligible"
              checked={draft.isApprover}
              onChange={(isApprover) => patch({ isApprover })}
            />
            <CheckboxInput
              label="Resource Manager eligible"
              checked={draft.isResourceManager}
              onChange={(isResourceManager) => patch({ isResourceManager })}
            />
          </FormRow>
          <TextArea
            label="Skills summary"
            value={draft.skillsSummary}
            hint="Use semicolons to separate skills."
            onChange={(skillsSummary) => patch({ skillsSummary })}
          />
          <CheckboxInput
            label="Active"
            checked={draft.isActive}
            onChange={(isActive) =>
              patch({
                isActive,
                employmentStatus: isActive
                  ? draft.employmentStatus
                  : "Inactive",
              })
            }
          />
        </FormSection>
      </Stack>
    </FormPanel>
  );
};
