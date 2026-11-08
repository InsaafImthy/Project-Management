import * as React from "react";
import { Separator } from "@fluentui/react";
import { gapClassNames, primitiveStyles } from "./primitiveStyles";

export type PmoGap = keyof typeof gapClassNames;

/** Semantic content divider; optional text is announced as its label. */
export const Divider = ({
  label,
}: {
  readonly label?: string;
}): React.ReactElement => <Separator>{label}</Separator>;

export interface IStackProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly direction?: "horizontal" | "vertical";
  readonly gap?: PmoGap;
  readonly wrap?: boolean;
}

/** Small layout primitive for places where Fluent Stack typing/styling varies between hosts. */
export const Stack = ({
  direction = "vertical",
  gap = "md",
  wrap = false,
  className = "",
  ...props
}: IStackProps): React.ReactElement => (
  <div
    {...props}
    className={`${primitiveStyles.stack} ${direction === "horizontal" ? primitiveStyles.stackHorizontal : primitiveStyles.stackVertical} ${wrap ? primitiveStyles.stackWrap : ""} ${gapClassNames[gap]} ${className}`}
  />
);

export interface IGridProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly gap?: PmoGap;
}

/** Responsive auto-fit grid for repeated dashboard/form regions. */
export const Grid = ({
  gap = "lg",
  className = "",
  ...props
}: IGridProps): React.ReactElement => (
  <div
    {...props}
    className={`${primitiveStyles.grid} ${gapClassNames[gap]} ${className}`}
  />
);
