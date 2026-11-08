import * as React from "react";
import { Persona, PersonaSize } from "@fluentui/react";
import type { PmoSemanticTone } from "../../theme/pmoDesignTokens";
import { formatPmoDate } from "../../utils/formatters";
import { primitiveStyles } from "./primitiveStyles";

const toneClasses: Record<PmoSemanticTone, string> = {
  neutral: primitiveStyles.toneNeutral,
  success: primitiveStyles.toneSuccess,
  warning: primitiveStyles.toneWarning,
  danger: primitiveStyles.toneDanger,
  information: primitiveStyles.toneInformation,
  disabled: primitiveStyles.toneDisabled,
};

export interface IStatusBadgeProps {
  /** Status text is always rendered; color is supplemental. */
  readonly text: string;
  readonly tone?: PmoSemanticTone;
}

/** Text-first semantic status treatment used across tables, cards, and forms. */
export const StatusBadge = ({
  text,
  tone = "neutral",
}: IStatusBadgeProps): React.ReactElement => (
  <span className={`${primitiveStyles.badge} ${toneClasses[tone]}`}>
    {text}
  </span>
);

export type PmoHealth = "Not Set" | "Green" | "Amber" | "Red";

const healthTone: Record<PmoHealth, PmoSemanticTone> = {
  "Not Set": "neutral",
  Green: "success",
  Amber: "warning",
  Red: "danger",
};
const healthDotClass: Record<PmoHealth, string> = {
  "Not Set": primitiveStyles.healthNotSet,
  Green: primitiveStyles.healthGreen,
  Amber: primitiveStyles.healthAmber,
  Red: primitiveStyles.healthRed,
};

/** PMO health signal that always pairs the traffic-light color with explicit text. */
export const HealthIndicator = ({
  value,
}: {
  readonly value: PmoHealth;
}): React.ReactElement => (
  <span
    className={`${primitiveStyles.badge} ${toneClasses[healthTone[value]]}`}
  >
    <span
      aria-hidden="true"
      className={`${primitiveStyles.healthDot} ${healthDotClass[value]}`}
    />
    {value}
  </span>
);

export type PmoPriority = "Low" | "Normal" | "High" | "Critical";
const priorityTone: Record<PmoPriority, PmoSemanticTone> = {
  Low: "neutral",
  Normal: "information",
  High: "warning",
  Critical: "danger",
};

/** Consistent, text-first priority label. */
export const PriorityBadge = ({
  value,
}: {
  readonly value: PmoPriority;
}): React.ReactElement => (
  <StatusBadge text={value} tone={priorityTone[value]} />
);

export interface IAvatarNameProps {
  readonly name: string;
  readonly secondaryText?: string;
  readonly imageUrl?: string;
  readonly size?: "small" | "medium";
}

/** Shared person display for assignees and owners; never assumes an image exists. */
export const AvatarName = ({
  name,
  secondaryText,
  imageUrl,
  size = "small",
}: IAvatarNameProps): React.ReactElement => (
  <Persona
    text={name}
    secondaryText={secondaryText}
    imageUrl={imageUrl}
    size={size === "small" ? PersonaSize.size24 : PersonaSize.size32}
  />
);

export interface IMoneyDisplayProps {
  readonly value?: number;
  readonly currency: string;
  readonly locale?: string;
  readonly emptyText?: string;
}

/** Locale-aware currency value with a non-zero-looking empty state. */
export const MoneyDisplay = ({
  value,
  currency,
  locale,
  emptyText = "Not set",
}: IMoneyDisplayProps): React.ReactElement => (
  <span className={primitiveStyles.valueDisplay}>
    {value === undefined || value === null
      ? emptyText
      : new Intl.NumberFormat(locale, { style: "currency", currency }).format(
          value,
        )}
  </span>
);

/** Hours value with stable precision and an explicit unit. */
export const HoursDisplay = ({
  value,
  precision = 1,
  emptyText = "Not set",
}: {
  readonly value?: number;
  readonly precision?: number;
  readonly emptyText?: string;
}): React.ReactElement => (
  <span className={primitiveStyles.valueDisplay}>
    {value === undefined || value === null
      ? emptyText
      : `${value.toFixed(precision)} h`}
  </span>
);

/** Percentage value where 100 means 100%, not a 1.0 ratio. */
export const PercentageDisplay = ({
  value,
  precision = 0,
  emptyText = "Not set",
  locale,
}: {
  readonly value?: number;
  readonly precision?: number;
  readonly emptyText?: string;
  readonly locale?: string;
}): React.ReactElement => (
  <span className={primitiveStyles.valueDisplay}>
    {value === undefined || value === null
      ? emptyText
      : new Intl.NumberFormat(locale, {
          style: "percent",
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value / 100)}
  </span>
);

export interface IDateDisplayProps {
  readonly value?: Date | string | number;
  readonly locale?: string;
  readonly includeTime?: boolean;
  readonly emptyText?: string;
}

/** Locale-aware display which preserves ISO date-only calendar days. */
export const DateDisplay = ({
  value,
  locale,
  includeTime = false,
  emptyText = "Not set",
}: IDateDisplayProps): React.ReactElement => (
  <time>
    {value === undefined || value === null
      ? emptyText
      : formatPmoDate(
          value,
          locale,
          includeTime
            ? {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }
            : undefined,
        )}
  </time>
);
