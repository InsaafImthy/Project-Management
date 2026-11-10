import * as React from "react";
import {
  Dialog,
  DialogFooter,
  DialogType,
  Panel,
  PanelType,
} from "@fluentui/react";
import { PMO_BEFORE_NAVIGATE_EVENT } from "../../routing/pmoRoutes";
import { pmoDesignTokens as t } from "../../theme/pmoDesignTokens";
import { AppButton, TextArea } from "../primitives";
import { compositeStyles as styles } from "./compositeStyles";

const phoneMedia = `@media (max-width: ${t.breakpoints.phone}px)`;

const formDialogStyles = {
  main: {
    borderRadius: t.radii.large,
    boxShadow: t.shadows.high,
    maxWidth: 560,
    width: "calc(100% - 32px)",
    selectors: {
      [phoneMedia]: {
        borderRadius: 0,
        height: "100dvh",
        maxWidth: "100vw",
        overflowY: "auto",
        width: "100vw",
      },
    },
  },
};

const formPanelStyles = {
  main: {
    boxShadow: t.shadows.high,
    selectors: {
      [phoneMedia]: { width: "100vw" },
    },
  },
  header: {
    borderBottom: `${t.borders.dividerWidth}px solid ${t.colors.neutral.border}`,
    padding: `${t.spacing.lg}px ${t.spacing.xl}px`,
  },
  headerText: {
    color: t.colors.neutral.strong,
    fontSize: t.typography.sizes.subtitle,
    fontWeight: String(t.typography.weights.semibold),
  },
  content: { padding: t.spacing.xl },
  footer: {
    borderTop: `${t.borders.dividerWidth}px solid ${t.colors.neutral.border}`,
    padding: `${t.spacing.md}px ${t.spacing.xl}px`,
  },
};

export interface IValidationIssue {
  readonly key: string;
  readonly message: string;
  readonly fieldId?: string;
}

/** Accessible form-level error list linking to fields when ids are supplied. */
export const ValidationSummary = React.forwardRef<
  HTMLDivElement,
  { readonly issues: readonly IValidationIssue[]; readonly title?: string }
>(({ issues, title = "Please correct the following errors" }, ref) => {
  const titleId = `pmo-validation-${React.useId()}`;
  return issues.length ? (
    <div
      ref={ref}
      className={styles.validationSummary}
      tabIndex={-1}
      role="alert"
      aria-labelledby={titleId}
    >
      <strong id={titleId}>{title}</strong>
      <ul className={styles.validationList}>
        {issues.map((issue) => (
          <li key={issue.key}>
            {issue.fieldId ? (
              <a href={`#${issue.fieldId}`}>{issue.message}</a>
            ) : (
              issue.message
            )}
          </li>
        ))}
      </ul>
    </div>
  ) : null;
});
ValidationSummary.displayName = "ValidationSummary";

const useFocusReturn = (open: boolean): void => {
  const previous = React.useRef<HTMLElement>();
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      previous.current = document.activeElement as HTMLElement;
    }
    if (!open && wasOpen.current) previous.current?.focus();
    wasOpen.current = open;
  }, [open]);
  React.useEffect(
    () => () => {
      if (wasOpen.current) previous.current?.focus();
    },
    [],
  );
};

export interface IFormDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly onDismiss: () => void;
  readonly onSubmit: () => void;
  readonly validationIssues?: readonly IValidationIssue[];
  readonly submitLabel?: string;
  readonly cancelLabel?: string;
  readonly saving?: boolean;
  readonly submitDisabled?: boolean;
}

/** Short create/edit workflow with validation summary, blocking save, and focus return. */
export const FormDialog = ({
  open,
  title,
  children,
  onDismiss,
  onSubmit,
  validationIssues = [],
  submitLabel = "Save",
  cancelLabel = "Cancel",
  saving,
  submitDisabled,
}: IFormDialogProps): React.ReactElement => {
  useFocusReturn(open);
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const submit = (): void => {
    if (validationIssues.length) {
      summaryRef.current?.focus();
      return;
    }
    onSubmit();
  };
  return (
    <Dialog
      hidden={!open}
      onDismiss={saving ? undefined : onDismiss}
      dialogContentProps={{ type: DialogType.normal, title }}
      modalProps={{ isBlocking: Boolean(saving) }}
      styles={formDialogStyles}
    >
      <div className={styles.formDialogBody}>
        <ValidationSummary ref={summaryRef} issues={validationIssues} />
        {children}
      </div>
      <DialogFooter className={styles.formDialogFooter}>
        <AppButton
          variant="primary"
          text={saving ? "Saving…" : submitLabel}
          disabled={saving || submitDisabled}
          onClick={submit}
        />
        <AppButton text={cancelLabel} disabled={saving} onClick={onDismiss} />
      </DialogFooter>
    </Dialog>
  );
};

export interface IFormPanelProps extends IFormDialogProps {
  readonly width?: "medium" | "large";
}

/** Medium workflow panel with the same validation and action contract as FormDialog. */
export const FormPanel = ({
  open,
  title,
  children,
  onDismiss,
  onSubmit,
  validationIssues = [],
  submitLabel = "Save",
  cancelLabel = "Cancel",
  saving,
  submitDisabled,
  width = "medium",
}: IFormPanelProps): React.ReactElement => {
  useFocusReturn(open);
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const submit = (): void => {
    if (validationIssues.length) summaryRef.current?.focus();
    else onSubmit();
  };
  return (
    <Panel
      isOpen={open}
      headerText={title}
      type={width === "large" ? PanelType.large : PanelType.medium}
      isBlocking={Boolean(saving)}
      onDismiss={saving ? undefined : onDismiss}
      closeButtonAriaLabel="Close"
      styles={formPanelStyles}
      onRenderFooterContent={() => (
        <div className={`${styles.formActions} ${styles.formPanelActions}`}>
          <AppButton
            variant="primary"
            text={saving ? "Saving…" : submitLabel}
            disabled={saving || submitDisabled}
            onClick={submit}
          />
          <AppButton text={cancelLabel} disabled={saving} onClick={onDismiss} />
        </div>
      )}
      isFooterAtBottom
    >
      <div className={styles.formPanelBody}>
        <ValidationSummary ref={summaryRef} issues={validationIssues} />
        {children}
      </div>
    </Panel>
  );
};

/** Full-page frame for complex forms. */
export const FormPageLayout = ({
  header,
  children,
  actions,
  validationIssues = [],
}: {
  readonly header: React.ReactNode;
  readonly children: React.ReactNode;
  readonly actions: React.ReactNode;
  readonly validationIssues?: readonly IValidationIssue[];
}): React.ReactElement => (
  <div className={`${styles.page} ${styles.formPageLayout}`}>
    {header}
    <main className={styles.formPage}>
      <ValidationSummary issues={validationIssues} />
      {children}
      <div className={styles.formActions}>{actions}</div>
    </main>
  </div>
);

/** Semantically grouped form fields. */
export const FormSection = ({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}): React.ReactElement => (
  <fieldset className={styles.formSection}>
    <legend className={styles.formLegend}>
      <span>{title}</span>
    </legend>
    <div className={styles.formSectionBody}>
      {description ? (
        <p className={styles.formSectionDescription}>{description}</p>
      ) : null}
      {children}
    </div>
  </fieldset>
);

/** Responsive form row. */
export const FormRow = ({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement => <div className={styles.formRow}>{children}</div>;

/** Standard right-aligned form action area. */
export const FormActions = ({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement => <div className={styles.formActions}>{children}</div>;

export interface IConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: React.ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onDismiss: () => void;
}

/** Confirmation boundary for submission, approval, cancellation, and closure. */
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onDismiss,
}: IConfirmDialogProps): React.ReactElement => {
  useFocusReturn(open);
  return (
    <Dialog
      hidden={!open}
      onDismiss={onDismiss}
      dialogContentProps={{
        type: DialogType.normal,
        title,
        subText: undefined,
      }}
      modalProps={{ isBlocking: true }}
      styles={formDialogStyles}
    >
      <div className={styles.confirmDialogBody}>{message}</div>
      <DialogFooter className={styles.formDialogFooter}>
        <AppButton
          variant={destructive ? "danger" : "primary"}
          text={confirmLabel}
          onClick={onConfirm}
        />
        <AppButton text={cancelLabel} onClick={onDismiss} />
      </DialogFooter>
    </Dialog>
  );
};

export interface IReasonDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly actionLabel: string;
  readonly onSubmit: (reason: string) => void;
  readonly onDismiss: () => void;
  readonly initialReason?: string;
  readonly minimumLength?: number;
}

/** Required-reason workflow for reject, return, cancel, and reopen actions. */
export const ReasonDialog = ({
  open,
  title,
  actionLabel,
  onSubmit,
  onDismiss,
  initialReason = "",
  minimumLength = 1,
}: IReasonDialogProps): React.ReactElement => {
  const [reason, setReason] = React.useState(initialReason);
  React.useEffect(() => {
    if (open) setReason(initialReason);
  }, [initialReason, open]);
  const valid = reason.trim().length >= minimumLength;
  return (
    <FormDialog
      open={open}
      title={title}
      submitLabel={actionLabel}
      onDismiss={onDismiss}
      onSubmit={() => onSubmit(reason.trim())}
      submitDisabled={!valid}
    >
      <TextArea
        label="Reason"
        value={reason}
        required
        onChange={setReason}
        errorMessage={
          reason.length > 0 && !valid
            ? `Enter at least ${minimumLength} characters.`
            : undefined
        }
      />
    </FormDialog>
  );
};

/** Installs browser and in-app navigation warnings while a form is dirty. */
export const UnsavedChangesGuard = ({
  active,
  message = "You have unsaved changes. Leave this page?",
}: {
  readonly active: boolean;
  readonly message?: string;
}): React.ReactElement => {
  React.useEffect(() => {
    if (!active) return undefined;
    const beforeUnload = (event: BeforeUnloadEvent): string => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    const beforeNavigate = (event: Event): void => {
      if (!window.confirm(message)) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener(PMO_BEFORE_NAVIGATE_EVENT, beforeNavigate);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener(PMO_BEFORE_NAVIGATE_EVENT, beforeNavigate);
    };
  }, [active, message]);
  return <></>;
};
