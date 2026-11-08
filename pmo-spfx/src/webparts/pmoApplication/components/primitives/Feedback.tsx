import * as React from "react";
import {
  MessageBar,
  MessageBarType,
  Shimmer,
  Spinner,
  SpinnerSize,
} from "@fluentui/react";
import { AppButton } from "./Buttons";
import { Stack } from "./Layout";
import { primitiveStyles } from "./primitiveStyles";

/** Busy state with an announced label; use skeletons for known content layouts. */
export const LoadingSpinner = ({
  label = "Loading",
}: {
  readonly label?: string;
}): React.ReactElement => (
  <Spinner size={SpinnerSize.medium} label={label} ariaLive="polite" />
);

/** Content-shaped loading placeholder announced to assistive technology. */
export const LoadingSkeleton = ({
  lines = 3,
  label = "Loading content",
}: {
  readonly lines?: number;
  readonly label?: string;
}): React.ReactElement => (
  <div aria-label={label} aria-busy="true" role="status">
    <Stack gap="sm">
      {Array.from({ length: lines }, (_value, index) => (
        <Shimmer key={index} />
      ))}
    </Stack>
  </div>
);

export interface IEmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

/** Empty collection state with one optional, valid next action. */
export const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
}: IEmptyStateProps): React.ReactElement => {
  const titleId = `pmo-empty-${React.useId()}`;
  return (
    <section className={primitiveStyles.feedback} aria-labelledby={titleId}>
      <h2 className={primitiveStyles.feedbackTitle} id={titleId}>
        {title}
      </h2>
      <p className={primitiveStyles.feedbackText}>{description}</p>
      {actionLabel && onAction ? (
        <AppButton variant="primary" text={actionLabel} onClick={onAction} />
      ) : null}
    </section>
  );
};

export type InlineMessageTone =
  | "information"
  | "success"
  | "warning"
  | "danger";
const messageTypes: Record<InlineMessageTone, MessageBarType> = {
  information: MessageBarType.info,
  success: MessageBarType.success,
  warning: MessageBarType.warning,
  danger: MessageBarType.error,
};

/** Inline, semantic feedback with Fluent UI live-region behavior. */
export const InlineMessage = ({
  children,
  tone = "information",
}: {
  readonly children: React.ReactNode;
  readonly tone?: InlineMessageTone;
}): React.ReactElement => (
  <MessageBar messageBarType={messageTypes[tone]}>{children}</MessageBar>
);

export interface IErrorStateProps {
  readonly title?: string;
  readonly message: string;
  readonly retryLabel?: string;
  readonly onRetry?: () => void;
}

/** User-safe failure state. Retry is rendered only when the caller can perform it. */
export const ErrorState = ({
  title = "Something went wrong",
  message,
  retryLabel = "Try again",
  onRetry,
}: IErrorStateProps): React.ReactElement => (
  <section className={primitiveStyles.feedback} role="alert">
    <h2 className={primitiveStyles.feedbackTitle}>{title}</h2>
    <p className={primitiveStyles.feedbackText}>{message}</p>
    {onRetry ? <AppButton text={retryLabel} onClick={onRetry} /> : null}
  </section>
);
