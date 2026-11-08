import type { IPmoConfig } from "../models/domain";

export type PmoConfigValueType = "number" | "boolean" | "time" | "text";

export interface IPmoTimeValue {
  readonly hours: number;
  readonly minutes: number;
}

export interface IPmoKnownSettingDefinition {
  readonly key: string;
  readonly type: PmoConfigValueType;
  readonly validate: (value: string) => string | undefined;
}

export const parseConfigNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseConfigBoolean = (value: string): boolean | undefined => {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "1"].indexOf(normalized) >= 0) return true;
  if (["false", "no", "0"].indexOf(normalized) >= 0) return false;
  return undefined;
};

export const parseConfigTime = (value: string): IPmoTimeValue | undefined => {
  const match = /^(\d{1,2})(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  return hours >= 0 && hours <= 23 ? { hours, minutes } : undefined;
};

export const parseConfigText = (value: string): string | undefined => {
  const parsed = value.trim();
  return parsed || undefined;
};

const numberRange =
  (
    label: string,
    minimum: number,
    maximum: number,
    integer = false,
  ): ((value: string) => string | undefined) =>
  (value: string): string | undefined => {
    const parsed = parseConfigNumber(value);
    if (parsed === undefined) return `${label} must be a number.`;
    if (integer && !Number.isInteger(parsed))
      return `${label} must be a whole number.`;
    if (parsed < minimum || parsed > maximum) {
      return `${label} must be between ${minimum} and ${maximum}.`;
    }
    return undefined;
  };

const currency = (value: string): string | undefined =>
  /^[A-Za-z]{3}$/.test(value.trim())
    ? undefined
    : "Currency must be a three-letter code.";

const version = (value: string): string | undefined =>
  /^\d+(?:\.\d+){1,2}$/.test(value.trim())
    ? undefined
    : "Import version must use a numeric version such as 1.0 or 1.0.0.";

const reminderTime = (value: string): string | undefined =>
  parseConfigTime(value)
    ? undefined
    : "Reminder time must be an hour or time between 00:00 and 23:59.";

export const PMO_KNOWN_SETTINGS: Readonly<
  Record<string, IPmoKnownSettingDefinition>
> = {
  StandardHoursPerDay: {
    key: "StandardHoursPerDay",
    type: "number",
    validate: numberRange("Standard hours per day", 0.01, 24),
  },
  PersonDayHours: {
    key: "PersonDayHours",
    type: "number",
    validate: numberRange("Person-day hours", 0.01, 24),
  },
  TaskEffortWarningPercent: {
    key: "TaskEffortWarningPercent",
    type: "number",
    validate: numberRange("Task effort warning percentage", 0, 100),
  },
  TaskAcceptanceDueHours: {
    key: "TaskAcceptanceDueHours",
    type: "number",
    validate: numberRange("Task acceptance response hours", 1, 720),
  },
  MissingTimeReminderHour: {
    key: "MissingTimeReminderHour",
    type: "time",
    validate: reminderTime,
  },
  TaskOverdueEscalationDays: {
    key: "TaskOverdueEscalationDays",
    type: "number",
    validate: numberRange("Task overdue escalation days", 0, 30, true),
  },
  ApprovalEscalationDays: {
    key: "ApprovalEscalationDays",
    type: "number",
    validate: numberRange("Approval escalation days", 1, 30, true),
  },
  DefaultCurrencyCode: {
    key: "DefaultCurrencyCode",
    type: "text",
    validate: currency,
  },
  ImportTemplateVersion: {
    key: "ImportTemplateVersion",
    type: "text",
    validate: version,
  },
};

export interface IPmoSettingDraft {
  readonly key: string;
  readonly category: IPmoConfig["category"];
  readonly value: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly sortOrder?: number;
}

export const validateSettingDraft = (
  draft: IPmoSettingDraft,
): Readonly<Record<string, string>> => {
  const errors: Record<string, string> = {};
  if (!draft.key.trim()) errors.key = "Setting key is required.";
  if (!draft.value.trim()) errors.value = "Setting value is required.";
  if (!draft.description.trim())
    errors.description = "Description is required.";
  if (draft.sortOrder !== undefined && !Number.isFinite(draft.sortOrder)) {
    errors.sortOrder = "Sort order must be a number.";
  }
  const definition = PMO_KNOWN_SETTINGS[draft.key.trim()];
  const valueError = definition?.validate(draft.value);
  if (valueError) errors.value = valueError;
  return errors;
};
