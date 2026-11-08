import * as React from "react";
import { PMO_CHOICES } from "../../../config/sharePointSchema";
import type { IPmoConfig } from "../../../models/domain";
import type { IPmoSettingDraft } from "../../../validation/configuration";
import {
  PMO_KNOWN_SETTINGS,
  validateSettingDraft,
} from "../../../validation/configuration";
import {
  FormDialog,
  FormRow,
  FormSection,
  type IValidationIssue,
} from "../../../components/composites";
import {
  CheckboxInput,
  NumberInput,
  SelectInput,
  Stack,
  TextArea,
  TextInput,
} from "../../../components/primitives";

const emptyDraft = (): IPmoSettingDraft => ({
  key: "",
  category: "General",
  value: "",
  description: "",
  isActive: true,
  sortOrder: 100,
});

const fromSetting = (setting: IPmoConfig): IPmoSettingDraft => ({
  key: setting.key,
  category: setting.category,
  value: setting.value,
  description: setting.description,
  isActive: setting.isActive,
  sortOrder: setting.sortOrder,
});

export interface ISettingFormDialogProps {
  readonly open: boolean;
  readonly setting?: IPmoConfig;
  readonly saving?: boolean;
  readonly serverError?: string;
  readonly onDismiss: () => void;
  readonly onSave: (draft: IPmoSettingDraft) => void;
}

export const SettingFormDialog = ({
  open,
  setting,
  saving,
  serverError,
  onDismiss,
  onSave,
}: ISettingFormDialogProps): React.ReactElement => {
  const [draft, setDraft] = React.useState<IPmoSettingDraft>(emptyDraft);
  const [submitted, setSubmitted] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setDraft(setting ? fromSetting(setting) : emptyDraft());
      setSubmitted(false);
    }
  }, [open, setting]);
  const errors = submitted ? validateSettingDraft(draft) : {};
  const issues: IValidationIssue[] = Object.keys(errors).map((field) => ({
    key: field,
    fieldId: `setting-${field}`,
    message: errors[field] ?? "Invalid value.",
  }));
  if (serverError) {
    issues.unshift({ key: "server", message: serverError });
  }
  const definition = PMO_KNOWN_SETTINGS[draft.key.trim()];
  const patch = (values: Partial<IPmoSettingDraft>): void =>
    setDraft((current) => ({ ...current, ...values }));
  const submit = (): void => {
    setSubmitted(true);
    if (!Object.keys(validateSettingDraft(draft)).length) onSave(draft);
  };
  return (
    <FormDialog
      open={open}
      title={setting ? "Edit setting" : "Create setting"}
      saving={saving}
      validationIssues={issues}
      onDismiss={onDismiss}
      onSubmit={submit}
    >
      <Stack gap="lg">
        <FormSection
          title="Configuration"
          description="Known keys use type-aware validation. New keys should be stable and documented."
        >
          <FormRow>
            <TextInput
              id="setting-key"
              label="Setting key"
              value={draft.key}
              required
              readOnly={Boolean(setting)}
              hint={
                definition
                  ? `Known ${definition.type} setting`
                  : "Unknown keys are owner-managed."
              }
              errorMessage={errors.key}
              onChange={(key) => patch({ key })}
            />
            <SelectInput
              id="setting-category"
              label="Category"
              value={draft.category}
              required
              options={PMO_CHOICES.config.category.map((category) => ({
                key: category,
                text: category,
              }))}
              onChange={(category) =>
                patch({ category: category as IPmoSettingDraft["category"] })
              }
            />
          </FormRow>
          <TextInput
            id="setting-value"
            label="Setting value"
            value={draft.value}
            required
            errorMessage={errors.value}
            onChange={(value) => patch({ value })}
          />
          <TextArea
            id="setting-description"
            label="Description"
            value={draft.description}
            required
            errorMessage={errors.description}
            onChange={(description) => patch({ description })}
          />
          <FormRow>
            <NumberInput
              id="setting-sortOrder"
              label="Sort order"
              value={draft.sortOrder}
              min={0}
              precision={0}
              errorMessage={errors.sortOrder}
              onChange={(sortOrder) => patch({ sortOrder })}
            />
            <CheckboxInput
              label="Active"
              checked={draft.isActive}
              onChange={(isActive) => patch({ isActive })}
            />
          </FormRow>
        </FormSection>
      </Stack>
    </FormDialog>
  );
};
