import { mergeStyleSets } from "@fluentui/react";
import { pmoDesignTokens as t } from "../../theme/pmoDesignTokens";

const focusRing = {
  outline: `${t.borders.strongWidth}px solid ${t.colors.brand.primary}`,
  outlineOffset: t.spacing.xxs,
};

export const primitiveStyles = mergeStyleSets({
  buttonDanger: {
    background: t.colors.semantic.danger.foreground,
    borderColor: t.colors.semantic.danger.foreground,
    color: t.colors.neutral.surface,
    selectors: {
      ":hover": {
        background: t.colors.semantic.danger.border,
        color: t.colors.neutral.surface,
      },
      ":focus-visible": focusRing,
    },
  },
  buttonSubtle: {
    background: "transparent",
    borderColor: "transparent",
    color: t.colors.brand.primary,
    selectors: { ":focus-visible": focusRing },
  },
  field: { marginBottom: t.spacing.md },
  fieldLabel: {
    color: t.colors.neutral.strong,
    display: "block",
    fontSize: t.typography.sizes.body,
    fontWeight: t.typography.weights.semibold,
    lineHeight: t.typography.lineHeights.body,
    marginBottom: t.spacing.xs,
  },
  required: {
    color: t.colors.semantic.danger.foreground,
    marginLeft: t.spacing.xs,
  },
  fieldHint: {
    color: t.colors.neutral.muted,
    display: "block",
    fontSize: t.typography.sizes.caption,
    marginTop: t.spacing.xs,
  },
  fieldError: {
    color: t.colors.semantic.danger.foreground,
    display: "block",
    fontSize: t.typography.sizes.caption,
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
    minHeight: t.controlHeights.compact,
    padding: `0 ${t.spacing.sm}px`,
  },
  toneNeutral: {
    background: t.colors.semantic.neutral.background,
    borderColor: t.colors.semantic.neutral.border,
    color: t.colors.semantic.neutral.foreground,
  },
  toneSuccess: {
    background: t.colors.semantic.success.background,
    borderColor: t.colors.semantic.success.border,
    color: t.colors.semantic.success.foreground,
  },
  toneWarning: {
    background: t.colors.semantic.warning.background,
    borderColor: t.colors.semantic.warning.border,
    color: t.colors.semantic.warning.foreground,
  },
  toneDanger: {
    background: t.colors.semantic.danger.background,
    borderColor: t.colors.semantic.danger.border,
    color: t.colors.semantic.danger.foreground,
  },
  toneInformation: {
    background: t.colors.semantic.information.background,
    borderColor: t.colors.semantic.information.border,
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
  feedback: { maxWidth: t.contentWidths.reading, padding: t.spacing.lg },
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
