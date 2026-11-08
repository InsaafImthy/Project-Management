import * as React from "react";
import { primitiveStyles } from "./primitiveStyles";

export interface IFieldLabelProps {
  readonly children: React.ReactNode;
  readonly htmlFor?: string;
  readonly required?: boolean;
}

/** Visible field label with a consistent required indicator. */
export const FieldLabel = ({
  children,
  htmlFor,
  required,
}: IFieldLabelProps): React.ReactElement => (
  <label className={primitiveStyles.fieldLabel} htmlFor={htmlFor}>
    {children}
    {required ? (
      <span className={primitiveStyles.required} aria-hidden="true">
        *
      </span>
    ) : null}
  </label>
);

/** Supporting field guidance. Pass its id through aria-describedby on the control. */
export const FieldHint = ({
  children,
  id,
}: {
  readonly children: React.ReactNode;
  readonly id?: string;
}): React.ReactElement => (
  <span className={primitiveStyles.fieldHint} id={id}>
    {children}
  </span>
);

/** Validation text announced by assistive technology. */
export const FieldError = ({
  children,
  id,
}: {
  readonly children: React.ReactNode;
  readonly id?: string;
}): React.ReactElement => (
  <span className={primitiveStyles.fieldError} id={id} role="alert">
    {children}
  </span>
);
