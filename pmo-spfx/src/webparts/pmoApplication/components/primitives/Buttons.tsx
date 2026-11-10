import * as React from "react";
import {
  DefaultButton,
  IconButton as FluentIconButton,
  PrimaryButton,
  type IButtonProps,
} from "@fluentui/react";
import { primitiveStyles } from "./primitiveStyles";

export type AppButtonVariant =
  | "primary"
  | "secondary"
  | "subtle"
  | "danger"
  | "icon";

type AppButtonBaseProps = Omit<IButtonProps, "primary">;

export type IAppButtonProps =
  | (AppButtonBaseProps & {
      /** PMO visual/behavioral emphasis. Use danger only for destructive actions. */
      readonly variant?: Exclude<AppButtonVariant, "icon">;
    })
  | (AppButtonBaseProps & {
      /** Icon-only variant; accessible name is mandatory. */
      readonly variant: "icon";
      readonly ariaLabel: string;
    });

/** Standard PMO action button with consistent semantic variants and disabled behavior. */
export const AppButton = ({
  variant = "secondary",
  ...props
}: IAppButtonProps): React.ReactElement => {
  const variantClassName =
    variant === "primary"
      ? primitiveStyles.buttonPrimary
      : variant === "danger"
        ? primitiveStyles.buttonDanger
        : variant === "subtle"
          ? primitiveStyles.buttonSubtle
          : variant === "icon"
            ? primitiveStyles.buttonIcon
            : primitiveStyles.buttonSecondary;
  const baseClassName = variant === "icon" ? "" : primitiveStyles.buttonBase;
  const className = `${props.className ?? ""} ${baseClassName} ${variantClassName}`;
  if (variant === "primary")
    return <PrimaryButton {...props} className={className} />;
  if (variant === "icon")
    return <FluentIconButton {...props} className={className} />;
  return <DefaultButton {...props} className={className} />;
};

export interface IIconButtonProps
  extends Omit<IButtonProps, "ariaLabel" | "text"> {
  /** Required accessible name for the icon-only action. */
  readonly ariaLabel: string;
}

/** Icon-only action which cannot be created without an accessible name. */
export const IconButton = ({
  ariaLabel,
  ...props
}: IIconButtonProps): React.ReactElement => (
  <FluentIconButton
    {...props}
    className={`${props.className ?? ""} ${primitiveStyles.buttonIcon}`}
    ariaLabel={ariaLabel}
    title={props.title ?? ariaLabel}
  />
);
