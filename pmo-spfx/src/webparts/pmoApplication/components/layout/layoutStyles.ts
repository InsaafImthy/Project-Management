import { mergeStyleSets } from "@fluentui/react";
import { pmoDesignTokens as t } from "../../theme/pmoDesignTokens";

const focusRing = {
  outline: `${t.borders.strongWidth}px solid ${t.colors.brand.primary}`,
  outlineOffset: -t.borders.strongWidth,
};

export const layoutStyles = mergeStyleSets({
  appShell: {
    background: t.colors.neutral.background,
    blockSize: "100dvh",
    containerType: "inline-size",
    display: "grid",
    gridTemplateAreas: '"sidebar header" "sidebar main"',
    gridTemplateColumns: "236px minmax(0, 1fr)",
    gridTemplateRows: "auto minmax(0, 1fr)",
    maxHeight: "100dvh",
    maxWidth: "100%",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    transition: `grid-template-columns ${t.motion.durations.standard}ms ${t.motion.easing}`,
    width: "100%",
    selectors: {
      [t.motion.reducedMotionMediaQuery]: { transition: "none" },
    },
  },
  appShellCollapsed: {
    gridTemplateColumns: "64px minmax(0, 1fr)",
  },
  appShellMobile: {
    gridTemplateAreas: '"header" "main"',
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  sidebar: {
    background: t.colors.neutral.surface,
    borderRight: `${t.borders.width}px solid ${t.colors.neutral.border}`,
    color: t.colors.neutral.text,
    gridArea: "sidebar",
    alignSelf: "stretch",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    overflowX: "hidden",
    overflowY: "auto",
    padding: `${t.spacing.md}px ${t.spacing.sm}px`,
  },
  sidebarDrawer: { borderRight: 0, height: "100%", paddingTop: t.spacing.sm },
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
  sidebarToggle: { flex: "0 0 auto" },
  sidebarLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
    color: t.colors.neutral.muted,
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
    color: t.colors.neutral.text,
    cursor: "pointer",
    display: "flex",
    font: "inherit",
    gap: t.spacing.md,
    minHeight: t.controlHeights.large,
    padding: `0 ${t.spacing.md}px`,
    textAlign: "left",
    width: "100%",
    selectors: {
      ":hover": { background: t.colors.neutral.subtle },
      ":focus-visible": focusRing,
    },
  },
  sidebarLinkActive: {
    background: t.colors.brand.primary,
    color: t.colors.neutral.surface,
    fontWeight: t.typography.weights.semibold,
    selectors: {
      ":hover": { background: t.colors.brand.hover },
    },
  },
  sidebarIcon: {
    flex: "0 0 auto",
    fontSize: t.typography.sizes.bodyLarge,
    textAlign: "center",
    width: t.spacing.lg,
  },
  header: {
    alignItems: "center",
    background: t.colors.neutral.surface,
    borderBottom: `${t.borders.dividerWidth}px solid ${t.colors.neutral.border}`,
    display: "flex",
    gap: t.spacing.lg,
    gridArea: "header",
    justifyContent: "space-between",
    minHeight: 68,
    padding: `${t.spacing.sm}px ${t.spacing.xl}px`,
  },
  headerCompact: {
    gap: t.spacing.sm,
    padding: `${t.spacing.sm}px ${t.spacing.md}px`,
  },
  headerMenuButton: { flex: "0 0 auto" },
  headerContext: { flex: "1 1 auto", minWidth: 0, overflow: "hidden" },
  headerTitle: {
    fontSize: t.typography.sizes.subtitle,
    fontWeight: t.typography.weights.semibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headerUser: {
    alignItems: "center",
    display: "flex",
    flex: "0 0 auto",
    gap: t.spacing.sm,
  },
  headerIdentityCompact: {
    selectors: {
      ":global(.ms-Persona-details)": { display: "none" },
    },
  },
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
  main: {
    gridArea: "main",
    minHeight: 0,
    minWidth: 0,
    overflowX: "hidden",
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingBottom: t.spacing.xl,
  },
  messages: {
    padding: `${t.spacing.md}px ${t.spacing.xl}px 0`,
    selectors: {
      "@container (max-width: 520px)": {
        padding: `${t.spacing.md}px ${t.spacing.md}px 0`,
      },
    },
  },
  contentContainer: {
    margin: "0 auto",
    maxWidth: t.contentWidths.wide,
    padding: t.spacing.xl,
    width: "100%",
    boxSizing: "border-box",
    selectors: {
      "@container (max-width: 520px)": { padding: t.spacing.md },
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
    overflowWrap: "anywhere",
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

/** Fluent Panel overrides that make the mobile drawer match the application shell. */
export const navigationDrawerPanelStyles = {
  main: {
    background: t.colors.neutral.surface,
    boxShadow: t.shadows.high,
  },
  header: {
    borderBottom: `${t.borders.dividerWidth}px solid ${t.colors.neutral.border}`,
    color: t.colors.neutral.strong,
    fontSize: t.typography.sizes.subtitle,
    fontWeight: "600",
  },
  content: { padding: 0 },
};
