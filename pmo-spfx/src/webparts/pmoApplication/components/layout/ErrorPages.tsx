import * as React from "react";
import { AppButton } from "../primitives";
import { layoutStyles as styles } from "./layoutStyles";

const StatePage = ({
  title,
  message,
  actionLabel,
  onAction,
}: {
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}): React.ReactElement => (
  <section className={styles.errorPage}>
    <h1>{title}</h1>
    <p>{message}</p>
    {actionLabel && onAction ? (
      <AppButton variant="primary" text={actionLabel} onClick={onAction} />
    ) : null}
  </section>
);

export const AccessDeniedPage = ({
  onBack,
}: {
  readonly onBack?: () => void;
}): React.ReactElement => (
  <StatePage
    title="Access denied"
    message="You do not have permission to view this content. Contact a PMO owner if you believe this is incorrect."
    actionLabel={onBack ? "Go back" : undefined}
    onAction={onBack}
  />
);

export const NotFoundPage = ({
  onHome,
}: {
  readonly onHome?: () => void;
}): React.ReactElement => (
  <StatePage
    title="Page not found"
    message="The requested PMO view does not exist or is no longer available."
    actionLabel={onHome ? "Go to home" : undefined}
    onAction={onHome}
  />
);

export const FatalErrorPage = ({
  onRetry,
  message = "Refresh the page and contact support if the problem continues.",
}: {
  readonly onRetry?: () => void;
  readonly message?: string;
}): React.ReactElement => (
  <StatePage
    title="The application could not be displayed"
    message={message}
    actionLabel={onRetry ? "Try again" : undefined}
    onAction={onRetry}
  />
);
