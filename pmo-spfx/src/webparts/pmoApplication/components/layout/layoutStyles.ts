import { mergeStyleSets } from "@fluentui/react";
import { pmoDesignTokens as t } from "../../theme/pmoDesignTokens";

const focusRing = {
  outline: `${t.borders.strongWidth}px solid ${t.colors.brand.primary}`,
  outlineOffset: -t.borders.strongWidth,
};

export const layoutStyles = mergeStyleSets({
  appShell: {
    background: t.colors.neutral.background,
    display: "grid",
    gridTemplateAreas: '"sidebar header" "sidebar main"',
    gridTemplateColumns: "240px minmax(0, 1fr)",
    gridTemplateRows: "auto minmax(0, 1fr)",
    minHeight: "70vh",
    transition: `grid-template-columns ${t.motion.durations.standard}ms ${t.motion.easing}`,
    selectors: {
      [`@media (max-width: ${t.breakpoints.tablet}px)`]: {
        gridTemplateColumns: `${t.controlHeights.large + t.spacing.lg}px minmax(0, 1fr)`,
      },
      [t.motion.reducedMotionMediaQuery]: { transition: "none" },
    },
  },
  appShellCollapsed: {
    gridTemplateColumns: `${t.controlHeights.large + t.spacing.lg}px minmax(0, 1fr)`,
  },
  sidebar: {
    background: t.colors.neutral.strong,
    color: t.colors.neutral.surface,
    gridArea: "sidebar",
    minWidth: 0,
    overflow: "hidden",
    padding: `${t.spacing.md}px ${t.spacing.sm}px`,
  },
  sidebarBrand: {
    alignItems: "center",
    display: "flex",
    fontSize: t.typography.sizes.subtitle,
    fontWeight: t.typography.weights.semibold,
    gap: t.spacing.sm,
    justifyContent: "space-between",
    marginBottom: t.spacing.lg,
    minHeight: t.controlHeights.large,
  },
  sidebarToggle: {
    selectors: {
      [`@media (max-width: ${t.breakpoints.tablet}px)`]: { display: "none" },
    },
  },
  sidebarLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    selectors: {
      [`@media (max-width: ${t.breakpoints.tablet}px)`]: {
        clip: "rect(0 0 0 0)",
        clipPath: "inset(50%)",
        height: 1,
        position: "absolute",
        width: 1,
      },
    },
  },
  sidebarLabelCollapsed: {
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    position: "absolute",
    width: 1,
  },
  sidebarGroup: { marginBottom: t.spacing.lg },
  sidebarGroupTitle: {
    color: t.colors.neutral.border,
    fontSize: t.typography.sizes.caption,
    fontWeight: t.typography.weights.semibold,
    margin: `${t.spacing.sm}px ${t.spacing.sm}px`,
    textTransform: "uppercase",
  },
  sidebarList: { listStyle: "none", margin: 0, padding: 0 },
  sidebarLink: {
    alignItems: "center",
    background: "transparent",
    border: 0,
    borderRadius: t.radii.medium,
    color: t.colors.neutral.surface,
    cursor: "pointer",
    display: "flex",
    font: "inherit",
    gap: t.spacing.md,
    minHeight: t.controlHeights.large,
    padding: `0 ${t.spacing.md}px`,
    textAlign: "left",
    width: "100%",
    selectors: {
      ":hover": { background: t.colors.neutral.text },
      ":focus-visible": focusRing,
    },
  },
  sidebarLinkActive: {
    background: t.colors.brand.primary,
    fontWeight: t.typography.weights.semibold,
  },
  sidebarIcon: {
    flex: "0 0 auto",
    fontSize: t.typography.sizes.bodyLarge,
    width: t.spacing.xl,
  },
  header: {
    alignItems: "center",
    background: t.colors.neutral.surface,
    borderBottom: `${t.borders.dividerWidth}px solid ${t.colors.neutral.border}`,
    display: "flex",
    gap: t.spacing.lg,
    gridArea: "header",
    justifyContent: "space-between",
    minHeight: 64,
    padding: `${t.spacing.sm}px ${t.spacing.xl}px`,
  },
  headerTitle: {
    fontSize: t.typography.sizes.subtitle,
    fontWeight: t.typography.weights.semibold,
  },
  headerUser: { alignItems: "center", display: "flex", gap: t.spacing.sm },
  headerVersion: {
    color: t.colors.neutral.muted,
    fontSize: t.typography.sizes.caption,
    whiteSpace: "nowrap",
  },
  breadcrumbs: {
    color: t.colors.neutral.muted,
    fontSize: t.typography.sizes.caption,
  },
  breadcrumbList: {
    display: "flex",
    flexWrap: "wrap",
    gap: t.spacing.xs,
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  breadcrumbButton: {
    background: "transparent",
    border: 0,
    color: t.colors.brand.primary,
    cursor: "pointer",
    font: "inherit",
    padding: 0,
    selectors: { ":focus-visible": focusRing },
  },
  main: { gridArea: "main", minWidth: 0 },
  messages: { padding: `${t.spacing.md}px ${t.spacing.xl}px 0` },
  contentContainer: {
    margin: "0 auto",
    maxWidth: t.contentWidths.wide,
    padding: t.spacing.xl,
    width: "100%",
    boxSizing: "border-box",
    selectors: {
      [`@media (max-width: ${t.breakpoints.tablet}px)`]: {
        padding: t.spacing.md,
      },
    },
  },
  pageHeader: {
    alignItems: "end",
    display: "flex",
    flexWrap: "wrap",
    gap: t.spacing.lg,
    justifyContent: "space-between",
  },
  pageTitle: {
    color: t.colors.neutral.strong,
    fontSize: t.typography.sizes.title,
    lineHeight: t.typography.lineHeights.heading,
    margin: 0,
  },
  pageSubtitle: {
    color: t.colors.neutral.muted,
    margin: `${t.spacing.xs}px 0 0`,
  },
  errorPage: {
    margin: "0 auto",
    maxWidth: t.contentWidths.reading,
    padding: `${t.spacing.xxl}px ${t.spacing.xl}px`,
    textAlign: "center",
  },
});
