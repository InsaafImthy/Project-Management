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
  if (variant === "primary") return <PrimaryButton {...props} />;
  if (variant === "icon") return <FluentIconButton {...props} />;
  const variantClassName = props.disabled
    ? ""
    : variant === "danger"
      ? primitiveStyles.buttonDanger
      : variant === "subtle"
        ? primitiveStyles.buttonSubtle
        : "";
  return (
    <DefaultButton
      {...props}
      className={`${props.className ?? ""} ${variantClassName}`}
    />
  );
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
    ariaLabel={ariaLabel}
    title={props.title ?? ariaLabel}
  />
);
