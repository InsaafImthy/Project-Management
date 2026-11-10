import {
  mergeStyleSets,
  type IBasePickerStyleProps,
  type IBasePickerStyles,
  type ICheckboxStyleProps,
  type ICheckboxStyles,
  type IDropdownStyleProps,
  type IDropdownStyles,
  type ISearchBoxStyles,
  type ITextFieldStyleProps,
  type ITextFieldStyles,
} from "@fluentui/react";
import { pmoDesignTokens as t } from "../../theme/pmoDesignTokens";

const focusRing = {
  outline: `${t.borders.strongWidth}px solid ${t.colors.brand.primary}`,
  outlineOffset: t.spacing.xxs,
};

const controlTransition = `border-color ${t.motion.durations.fast}ms ${t.motion.easing}, box-shadow ${t.motion.durations.fast}ms ${t.motion.easing}, background-color ${t.motion.durations.fast}ms ${t.motion.easing}`;

const controlFocusShadow = `0 0 0 ${t.spacing.xs}px ${t.colors.brand.subtle}`;

const controlFieldGroup = (
  invalid = false,
  disabled = false,
  focused = false,
) => ({
  background: disabled
    ? t.colors.semantic.disabled.background
    : t.colors.neutral.surface,
  border: `${t.borders.width}px solid ${invalid ? t.colors.semantic.danger.border : focused ? t.colors.brand.primary : t.colors.neutral.border}`,
  borderRadius: t.radii.medium,
  boxShadow: focused && !invalid ? controlFocusShadow : "none",
  minHeight: t.controlHeights.large,
  transition: controlTransition,
  selectors: {
    ":hover": disabled
      ? {}
      : {
          borderColor: invalid
            ? t.colors.semantic.danger.foreground
            : t.colors.neutral.muted,
        },
    ":focus-within": {
      borderColor: invalid
        ? t.colors.semantic.danger.foreground
        : t.colors.brand.primary,
      boxShadow: invalid ? "none" : controlFocusShadow,
    },
  },
});

/** Fluent slot styles shared by all text and date-like field wrappers. */
export const pmoTextFieldStyles = (
  props: ITextFieldStyleProps,
): Partial<ITextFieldStyles> => ({
  fieldGroup: controlFieldGroup(
    props.hasErrorMessage,
    props.disabled,
    props.focused,
  ),
  field: {
    color: t.colors.neutral.text,
    fontSize: t.typography.sizes.body,
    lineHeight: t.typography.lineHeights.body,
    padding: `0 ${t.spacing.md}px`,
    selectors: {
      "::placeholder": { color: t.colors.neutral.muted, opacity: 1 },
    },
  },
});

/** Fluent slot styles shared by selection fields. */
export const pmoDropdownStyles = (
  props: IDropdownStyleProps,
): Partial<IDropdownStyles> => ({
  label: {
    color: t.colors.neutral.strong,
    fontSize: t.typography.sizes.body,
    fontWeight: "600",
    marginBottom: t.spacing.sm,
  },
  dropdown: controlFieldGroup(props.hasError, props.disabled, props.isOpen),
  title: {
    color: t.colors.neutral.text,
    fontSize: t.typography.sizes.body,
    lineHeight: `${t.controlHeights.large - t.borders.strongWidth}px`,
    padding: `0 ${t.spacing.xl} ${0} ${t.spacing.md}px`,
  },
  caretDown: { color: t.colors.neutral.muted },
  errorMessage: {
    color: t.colors.semantic.danger.foreground,
    fontSize: t.typography.sizes.caption,
    marginTop: t.spacing.xs,
  },
});

/** Fluent slot styles shared by search controls. */
export const pmoSearchBoxStyles: Partial<ISearchBoxStyles> = {
  root: controlFieldGroup(),
  field: {
    color: t.colors.neutral.text,
    fontSize: t.typography.sizes.body,
    padding: `0 ${t.spacing.md}px`,
  },
  icon: { color: t.colors.neutral.muted },
};

/** Fluent slot styles shared by checkboxes. */
export const pmoCheckboxStyles = (
  props: ICheckboxStyleProps,
): Partial<ICheckboxStyles> => {
  const selected = Boolean(props.checked || props.indeterminate);
  return {
    root: { minHeight: t.controlHeights.large },
    label: { alignItems: "center", gap: t.spacing.sm },
    checkbox: {
      background: selected ? t.colors.brand.primary : t.colors.neutral.surface,
      border: `${t.borders.width}px solid ${selected ? t.colors.brand.primary : t.colors.neutral.border}`,
      borderRadius: t.radii.small,
      height: t.spacing.lg,
      transition: controlTransition,
      width: t.spacing.lg,
      selectors: {
        ":hover": {
          borderColor: selected ? t.colors.brand.hover : t.colors.neutral.muted,
        },
      },
    },
    checkmark: { color: t.colors.neutral.surface },
    text: {
      color: t.colors.neutral.text,
      fontSize: t.typography.sizes.body,
      lineHeight: t.typography.lineHeights.body,
    },
  };
};

/** Fluent slot styles shared by people-picker inputs. */
export const pmoPeoplePickerStyles = (
  props: IBasePickerStyleProps,
): Partial<IBasePickerStyles> => ({
  text: controlFieldGroup(false, props.disabled, props.isFocused),
  input: {
    color: t.colors.neutral.text,
    fontSize: t.typography.sizes.body,
    padding: `0 ${t.spacing.xs}px`,
  },
});

export const primitiveStyles = mergeStyleSets({
  buttonBase: {
    borderRadius: t.radii.medium,
    fontWeight: t.typography.weights.semibold,
    minHeight: t.controlHeights.large,
    padding: `0 ${t.spacing.lg}px`,
    transition: controlTransition,
    selectors: {
      ":focus-visible": focusRing,
      ":disabled, &[aria-disabled='true']": {
        background: t.colors.semantic.disabled.background,
        borderColor: t.colors.semantic.disabled.border,
        color: t.colors.semantic.disabled.foreground,
      },
      "&[aria-busy='true']": { cursor: "wait", opacity: 0.72 },
    },
  },
  buttonPrimary: {
    background: t.colors.brand.primary,
    borderColor: t.colors.brand.primary,
    color: t.colors.neutral.surface,
    selectors: {
      ":hover:not(:disabled)": {
        background: t.colors.brand.hover,
        borderColor: t.colors.brand.hover,
        color: t.colors.neutral.surface,
      },
      ":active:not(:disabled)": {
        background: t.colors.brand.pressed,
        borderColor: t.colors.brand.pressed,
      },
    },
  },
  buttonSecondary: {
    background: t.colors.neutral.surface,
    borderColor: t.colors.neutral.border,
    color: t.colors.neutral.text,
    selectors: {
      ":hover:not(:disabled)": {
        background: t.colors.neutral.subtle,
        borderColor: t.colors.neutral.muted,
      },
      ":active:not(:disabled)": { background: t.colors.neutral.background },
    },
  },
  buttonDanger: {
    background: t.colors.semantic.danger.foreground,
    borderColor: t.colors.semantic.danger.foreground,
    color: t.colors.neutral.surface,
    selectors: {
      ":hover:not(:disabled)": {
        background: t.colors.semantic.danger.border,
        borderColor: t.colors.semantic.danger.border,
        color: t.colors.neutral.surface,
      },
      ":active:not(:disabled)": {
        background: t.colors.semantic.danger.foreground,
      },
    },
  },
  buttonSubtle: {
    background: "transparent",
    borderColor: "transparent",
    color: t.colors.brand.primary,
    selectors: {
      ":hover:not(:disabled)": { background: t.colors.brand.subtle },
      ":active:not(:disabled)": { background: t.colors.neutral.background },
    },
  },
  buttonIcon: {
    alignItems: "center",
    borderRadius: t.radii.medium,
    display: "inline-flex",
    height: t.controlHeights.large,
    justifyContent: "center",
    minHeight: t.controlHeights.large,
    minWidth: t.controlHeights.large,
    padding: 0,
    transition: controlTransition,
    selectors: {
      ":hover:not(:disabled)": { background: t.colors.neutral.subtle },
      ":focus-visible": focusRing,
      "&[aria-busy='true']": { cursor: "wait", opacity: 0.72 },
    },
  },
  field: { marginBottom: t.spacing.lg },
  fieldLabel: {
    color: t.colors.neutral.strong,
    display: "block",
    fontSize: t.typography.sizes.body,
    fontWeight: t.typography.weights.semibold,
    lineHeight: t.typography.lineHeights.body,
    marginBottom: t.spacing.sm,
  },
  required: {
    color: t.colors.semantic.danger.foreground,
    marginLeft: t.spacing.xs,
  },
  fieldHint: {
    color: t.colors.neutral.muted,
    display: "block",
    fontSize: t.typography.sizes.caption,
    lineHeight: t.typography.lineHeights.body,
    marginTop: t.spacing.xs,
  },
  fieldError: {
    color: t.colors.semantic.danger.foreground,
    display: "block",
    fontSize: t.typography.sizes.caption,
    lineHeight: t.typography.lineHeights.body,
    marginTop: t.spacing.xs,
  },
  badge: {
    alignItems: "center",
    borderRadius: t.radii.pill,
    borderStyle: "solid",
    borderWidth: t.borders.width,
    display: "inline-flex",
    fontSize: t.typography.sizes.caption,
    fontWeight: t.typography.weights.semibold,
    lineHeight: t.typography.lineHeights.compact,
    minHeight: 22,
    padding: `0 ${t.spacing.sm}px`,
  },
  toneNeutral: {
    background: t.colors.semantic.neutral.background,
    borderColor: t.colors.semantic.neutral.border,
    color: t.colors.semantic.neutral.foreground,
  },
  toneSuccess: {
    background: t.colors.semantic.success.background,
    borderColor: t.colors.semantic.success.background,
    color: t.colors.semantic.success.foreground,
  },
  toneWarning: {
    background: t.colors.semantic.warning.background,
    borderColor: t.colors.semantic.warning.background,
    color: t.colors.semantic.warning.foreground,
  },
  toneDanger: {
    background: t.colors.semantic.danger.background,
    borderColor: t.colors.semantic.danger.background,
    color: t.colors.semantic.danger.foreground,
  },
  toneInformation: {
    background: t.colors.semantic.information.background,
    borderColor: t.colors.semantic.information.background,
    color: t.colors.semantic.information.foreground,
  },
  toneDisabled: {
    background: t.colors.semantic.disabled.background,
    borderColor: t.colors.semantic.disabled.border,
    color: t.colors.semantic.disabled.foreground,
  },
  healthDot: {
    borderRadius: t.radii.pill,
    height: t.spacing.sm,
    marginRight: t.spacing.sm,
    width: t.spacing.sm,
  },
  healthNotSet: { background: t.colors.neutral.muted },
  healthGreen: { background: t.colors.semantic.success.border },
  healthAmber: { background: t.colors.semantic.warning.border },
  healthRed: { background: t.colors.semantic.danger.border },
  avatarName: {
    alignItems: "center",
    display: "inline-flex",
    gap: t.spacing.sm,
  },
  valueDisplay: { fontVariantNumeric: "tabular-nums" },
  stack: { display: "flex" },
  stackHorizontal: { flexDirection: "row" },
  stackVertical: { flexDirection: "column" },
  stackWrap: { flexWrap: "wrap" },
  grid: {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${t.contentWidths.form / 2}px), 1fr))`,
  },
  feedback: {
    background: t.colors.neutral.surface,
    border: `${t.borders.width}px solid ${t.colors.neutral.border}`,
    borderRadius: t.radii.large,
    boxShadow: t.shadows.low,
    maxWidth: t.contentWidths.reading,
    padding: t.spacing.lg,
  },
  feedbackTitle: {
    fontSize: t.typography.sizes.subtitle,
    fontWeight: t.typography.weights.semibold,
    margin: `0 0 ${t.spacing.sm}px`,
  },
  feedbackText: {
    color: t.colors.neutral.muted,
    margin: `0 0 ${t.spacing.md}px`,
  },
  gallery: {
    color: t.colors.neutral.text,
    margin: "0 auto",
    maxWidth: t.contentWidths.page,
    padding: t.spacing.xl,
  },
  gallerySection: {
    borderTop: `${t.borders.dividerWidth}px solid ${t.colors.neutral.border}`,
    marginTop: t.spacing.xl,
    paddingTop: t.spacing.lg,
  },
  visuallyHidden: {
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: 1,
  },
});

export const gapClassNames = {
  none: mergeStyleSets({ gap: { gap: t.spacing.none } }).gap,
  xs: mergeStyleSets({ gap: { gap: t.spacing.xs } }).gap,
  sm: mergeStyleSets({ gap: { gap: t.spacing.sm } }).gap,
  md: mergeStyleSets({ gap: { gap: t.spacing.md } }).gap,
  lg: mergeStyleSets({ gap: { gap: t.spacing.lg } }).gap,
  xl: mergeStyleSets({ gap: { gap: t.spacing.xl } }).gap,
} as const;
