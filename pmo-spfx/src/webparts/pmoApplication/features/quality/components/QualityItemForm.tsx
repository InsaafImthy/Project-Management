import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import { FormRow, FormSection } from "../../../components/composites";
import {
  CheckboxInput,
  DateInput,
  NumberInput,
  PersonInput,
  SelectInput,
  TextArea,
  TextInput,
  type IPmoPerson as IPickerPerson,
} from "../../../components/primitives";
import type { IPmoPerson } from "../../../models/domain";
import type {
  IQualityItemDraft,
  QualityValidationErrors,
} from "../../../services/domain/QualityGovernanceService";

const options = (values: readonly string[]) =>
  values.map((value) => ({ key: value, text: value }));
const selectedPerson = (person?: IPmoPerson): readonly IPickerPerson[] =>
  person
    ? [
        {
          id: String(person.id),
          email: person.email ?? "",
          text: person.displayName,
        },
      ]
    : [];

export interface IQualityItemFormProps {
  readonly draft: IQualityItemDraft;
  readonly errors?: QualityValidationErrors;
  readonly readOnly?: boolean;
  readonly onChange: (draft: IQualityItemDraft) => void;
  readonly onResolvePeople?: (query: string) => Promise<readonly IPmoPerson[]>;
}

/** One adaptive form for all records persisted in PMO_QualityItems. */
export const QualityItemForm = ({
  draft,
  errors = {},
  readOnly,
  onChange,
  onResolvePeople,
}: IQualityItemFormProps): React.ReactElement => {
  const set = <K extends keyof IQualityItemDraft>(
    key: K,
    value: IQualityItemDraft[K],
  ): void => onChange({ ...draft, [key]: value });
  const resolvePeople = async (query: string): Promise<IPickerPerson[]> =>
    ((await onResolvePeople?.(query)) ?? []).map((person) => ({
      id: String(person.id),
      email: person.email ?? "",
      text: person.displayName,
    }));
  const choosePerson = (people: readonly IPickerPerson[]): void => {
    const person = people[0];
    set(
      "assignedTo",
      person
        ? {
            id: Number(person.id),
            displayName: person.text ?? person.email,
            email: person.email,
          }
        : undefined,
    );
  };
  const defect =
    draft.qualityType === "Defect" || draft.qualityType === "Production Defect";
  return (
    <>
      <FormSection title="Classification">
        <FormRow>
          <SelectInput
            label="Quality type"
            value={draft.qualityType}
            options={options(PMO_CHOICES.qualityItems.qualityType)}
            disabled={readOnly}
            required
            onChange={(value) =>
              set("qualityType", value as IQualityItemDraft["qualityType"])
            }
          />
          <NumberInput
            label="Project ID"
            value={draft.projectId}
            min={1}
            disabled={readOnly}
            required
            errorMessage={errors.projectId}
            onChange={(value) => set("projectId", value)}
          />
          <NumberInput
            label="Work item ID"
            value={draft.workItemId}
            min={1}
            disabled={readOnly}
            required={
              draft.qualityType === "Test Result" ||
              draft.qualityType === "Production Defect"
            }
            errorMessage={errors.workItemId}
            onChange={(value) => set("workItemId", value)}
          />
        </FormRow>
        <FormRow>
          <TextInput
            label="Summary"
            value={draft.title}
            disabled={readOnly}
            required
            errorMessage={errors.title}
            onChange={(value) => set("title", value)}
          />
          <TextInput
            label="Release"
            value={draft.releaseName ?? ""}
            disabled={readOnly}
            onChange={(value) => set("releaseName", value)}
          />
        </FormRow>
        <TextArea
          label="Description and explanation"
          value={draft.description}
          disabled={readOnly}
          required
          errorMessage={errors.description}
          onChange={(value) => set("description", value)}
        />
      </FormSection>

      {draft.qualityType === "Test Result" ? (
        <FormSection
          title="Test result"
          description="Failed and blocked results require both an explanation and evidence."
        >
          <FormRow>
            <SelectInput
              label="Result"
              value={draft.testResult}
              options={options(PMO_CHOICES.qualityItems.testResult)}
              disabled={readOnly}
              required
              errorMessage={errors.testResult}
              onChange={(value) =>
                set("testResult", value as IQualityItemDraft["testResult"])
              }
            />
            <TextInput
              label="Evidence link"
              value={draft.evidenceLink ?? ""}
              disabled={readOnly}
              required={
                draft.testResult === "Fail" || draft.testResult === "Blocked"
              }
              errorMessage={errors.evidenceLink}
              onChange={(value) => set("evidenceLink", value)}
            />
          </FormRow>
        </FormSection>
      ) : null}

      {defect ? (
        <FormSection title="Defect ownership and impact">
          <FormRow>
            <SelectInput
              label="Severity"
              value={draft.severity}
              options={options(PMO_CHOICES.qualityItems.severity)}
              disabled={readOnly}
              required
              errorMessage={errors.severity}
              onChange={(value) =>
                set("severity", value as IQualityItemDraft["severity"])
              }
            />
            <SelectInput
              label="Priority"
              value={draft.priority}
              options={options(PMO_CHOICES.qualityItems.priority)}
              disabled={readOnly}
              onChange={(value) =>
                set("priority", value as IQualityItemDraft["priority"])
              }
            />
            <DateInput
              label="Target fix date"
              value={draft.targetFixDate}
              disabled={readOnly}
              onChange={(value) => set("targetFixDate", value)}
            />
          </FormRow>
          <PersonInput
            label="Assigned to"
            selectedPeople={selectedPerson(draft.assignedTo)}
            disabled={readOnly}
            errorMessage={errors.assignedTo}
            onResolveSuggestions={resolvePeople}
            onChange={choosePerson}
          />
          {draft.qualityType === "Production Defect" ? (
            <TextArea
              label="Customer impact and service effect"
              value={draft.customerImpact ?? ""}
              disabled={readOnly}
              required
              errorMessage={errors.customerImpact}
              onChange={(value) => set("customerImpact", value)}
            />
          ) : null}
        </FormSection>
      ) : null}

      {defect ? (
        <FormSection title="Root cause">
          <SelectInput
            label="Root cause category"
            value={draft.rootCauseCategory}
            options={options(PMO_CHOICES.qualityItems.rootCauseCategory)}
            disabled={readOnly}
            onChange={(value) =>
              set(
                "rootCauseCategory",
                value as IQualityItemDraft["rootCauseCategory"],
              )
            }
          />
          <TextArea
            label="Root cause, escaped control, corrective and preventive action"
            value={draft.rootCauseDetails ?? ""}
            disabled={readOnly}
            onChange={(value) => set("rootCauseDetails", value)}
          />
        </FormSection>
      ) : null}

      <FormSection title="Release control">
        <CheckboxInput
          label="This item blocks release"
          checked={draft.isReleaseBlocking}
          disabled={readOnly}
          errorMessage={errors.isReleaseBlocking}
          onChange={(value) => set("isReleaseBlocking", value)}
        />
        {draft.qualityType === "Release Exception" ? (
          <p>
            Saving creates the exception record. Submission routes a QA
            Exception through the shared Approval Workflow; approval never
            changes a failed result to Pass.
          </p>
        ) : null}
      </FormSection>
    </>
  );
};
