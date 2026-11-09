import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import { FormRow, FormSection } from "../../../components/composites";
import {
  DateInput,
  NumberInput,
  PersonInput,
  SelectInput,
  TextArea,
  TextInput,
  type IPmoPerson as IPickerPerson,
} from "../../../components/primitives";
import type { IPmoPerson } from "../../../models/domain";
import type { IRiskIssueDraft } from "../../../services/domain/RiskManagementService";

const options = (values: readonly string[]) =>
  values.map((value) => ({ key: value, text: value }));

export const RiskIssueForm = ({
  draft,
  errors = {},
  onChange,
  onResolvePeople,
}: {
  readonly draft: IRiskIssueDraft;
  readonly errors?: Readonly<Record<string, string>>;
  readonly onChange: (draft: IRiskIssueDraft) => void;
  readonly onResolvePeople?: (query: string) => Promise<readonly IPmoPerson[]>;
}): React.ReactElement => {
  const set = <K extends keyof IRiskIssueDraft>(
    key: K,
    value: IRiskIssueDraft[K],
  ): void => onChange({ ...draft, [key]: value });
  const selected: readonly IPickerPerson[] = draft.owner
    ? [
        {
          id: String(draft.owner.id),
          email: draft.owner.email ?? "",
          text: draft.owner.displayName,
        },
      ]
    : [];
  return (
    <>
      <FormSection title="Risk classification">
        <FormRow>
          <SelectInput
            label="Record type"
            value={draft.recordType}
            options={options(PMO_CHOICES.risksIssues.recordType)}
            required
            onChange={(value) =>
              set("recordType", value as IRiskIssueDraft["recordType"])
            }
          />
          <NumberInput
            label="Project ID"
            value={draft.projectId}
            min={1}
            required
            errorMessage={errors.projectId}
            onChange={(value) => set("projectId", value)}
          />
          {draft.recordType === "Blocker" ? (
            <NumberInput
              label="Work item ID"
              value={draft.workItemId}
              min={1}
              required
              errorMessage={errors.workItemId}
              onChange={(value) => set("workItemId", value)}
            />
          ) : null}
        </FormRow>
        <FormRow>
          <SelectInput
            label="Severity"
            value={draft.severity}
            options={options(PMO_CHOICES.risksIssues.severity)}
            required
            onChange={(value) =>
              set("severity", value as IRiskIssueDraft["severity"])
            }
          />
          {draft.recordType === "Risk" ? (
            <SelectInput
              label="Probability"
              value={draft.probability}
              options={options(PMO_CHOICES.risksIssues.probability)}
              required
              errorMessage={errors.probability}
              onChange={(value) =>
                set("probability", value as IRiskIssueDraft["probability"])
              }
            />
          ) : null}
          <DateInput
            label="Target resolution date"
            value={draft.targetResolutionDate}
            onChange={(value) => set("targetResolutionDate", value)}
          />
        </FormRow>
      </FormSection>
      <FormSection title="Ownership and response">
        <TextInput
          label="Summary"
          value={draft.title}
          required
          errorMessage={errors.title}
          onChange={(value) => set("title", value)}
        />
        <PersonInput
          label="Owner"
          selectedPeople={selected}
          required
          errorMessage={errors.owner}
          onResolveSuggestions={async (query) =>
            ((await onResolvePeople?.(query)) ?? []).map((person) => ({
              id: String(person.id),
              email: person.email ?? "",
              text: person.displayName,
            }))
          }
          onChange={(people) => {
            const person = people[0];
            set(
              "owner",
              person
                ? {
                    id: Number(person.id),
                    displayName: person.text ?? person.email,
                    email: person.email,
                  }
                : undefined,
            );
          }}
        />
        <TextArea
          label="Description"
          value={draft.description}
          required
          errorMessage={errors.description}
          onChange={(value) => set("description", value)}
        />
        <TextArea
          label="Business or delivery impact"
          value={draft.impact}
          required
          errorMessage={errors.impact}
          onChange={(value) => set("impact", value)}
        />
        <TextArea
          label="Response plan"
          value={draft.responsePlan ?? ""}
          onChange={(value) => set("responsePlan", value)}
        />
      </FormSection>
    </>
  );
};
