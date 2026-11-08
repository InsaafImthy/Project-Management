import type { ITheme } from "@fluentui/react";
import { pmoTheme } from "./pmoTheme";

export type PmoSemanticTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "information"
  | "disabled";

export interface IPmoDesignTokens {
  readonly colors: {
    readonly brand: Readonly<
      Record<"primary" | "hover" | "pressed" | "subtle", string>
    >;
    readonly neutral: Readonly<
      Record<
        | "background"
        | "surface"
        | "subtle"
        | "border"
        | "muted"
        | "text"
        | "strong",
        string
      >
    >;
    readonly semantic: Readonly<
      Record<
        PmoSemanticTone,
        {
          readonly foreground: string;
          readonly background: string;
          readonly border: string;
        }
      >
    >;
  };
  readonly typography: {
    readonly families: Readonly<Record<"base" | "monospace", string>>;
    readonly sizes: Readonly<
      Record<
        "caption" | "body" | "bodyLarge" | "subtitle" | "title" | "display",
        number
      >
    >;
    readonly weights: Readonly<Record<"regular" | "semibold" | "bold", number>>;
    readonly lineHeights: Readonly<
      Record<"compact" | "body" | "comfortable" | "heading", number>
    >;
  };
  readonly spacing: Readonly<
    Record<"none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl", number>
  >;
  readonly radii: Readonly<
    Record<"none" | "small" | "medium" | "large" | "pill", number>
  >;
  readonly borders: Readonly<
    Record<"width" | "strongWidth" | "dividerWidth", number>
  >;
  readonly shadows: Readonly<
    Record<"none" | "low" | "medium" | "high", string>
  >;
  readonly controlHeights: Readonly<
    Record<"compact" | "standard" | "large", number>
  >;
  readonly contentWidths: Readonly<
    Record<"form" | "reading" | "page" | "wide", number>
  >;
  readonly breakpoints: Readonly<
    Record<"phone" | "tablet" | "laptop" | "desktop", number>
  >;
  readonly layers: Readonly<
    Record<
      "base" | "sticky" | "navigation" | "overlay" | "dialog" | "toast",
      number
    >
  >;
  readonly motion: {
    readonly durations: Readonly<
      Record<"instant" | "fast" | "standard" | "slow", number>
    >;
    readonly easing: string;
    readonly reducedMotionMediaQuery: string;
  };
}

/**
 * Creates the PMO token contract from a Fluent UI theme. Feature code should
 * consume this contract rather than introducing raw visual values.
 */
export const createPmoDesignTokens = (theme: ITheme): IPmoDesignTokens => ({
  colors: {
    brand: {
      primary: theme.palette.themePrimary,
      hover: theme.palette.themeDarkAlt,
      pressed: theme.palette.themeDark,
      subtle: theme.palette.themeLighterAlt,
    },
    neutral: {
      background: theme.palette.neutralLighterAlt,
      surface: theme.palette.white,
      subtle: theme.palette.neutralLighter,
      border: theme.palette.neutralQuaternary,
      muted: theme.palette.neutralSecondary,
      text: theme.palette.neutralPrimary,
      strong: theme.palette.neutralDark,
    },
    semantic: {
      neutral: {
        foreground: theme.palette.neutralPrimary,
        background: theme.palette.neutralLighter,
        border: theme.palette.neutralQuaternary,
      },
      success: {
        foreground: theme.semanticColors.successIcon,
        background: theme.semanticColors.successBackground,
        border: theme.palette.green,
      },
      warning: {
        foreground: theme.palette.yellowDark,
        background: theme.semanticColors.warningBackground,
        border: theme.palette.yellowDark,
      },
      danger: {
        foreground: theme.semanticColors.errorText,
        background: theme.semanticColors.errorBackground,
        border: theme.palette.redDark,
      },
      information: {
        foreground: theme.semanticColors.infoIcon,
        background: theme.semanticColors.infoBackground,
        border: theme.palette.themePrimary,
      },
      disabled: {
        foreground: theme.semanticColors.disabledText,
        background: theme.semanticColors.disabledBackground,
        border: theme.palette.neutralQuaternary,
      },
    },
  },
  typography: {
    families: {
      base: theme.fonts.medium.fontFamily ?? "Segoe UI, Arial, sans-serif",
      monospace: 'Consolas, "Courier New", monospace',
    },
    sizes: {
      caption: 12,
      body: 14,
      bodyLarge: 16,
      subtitle: 18,
      title: 24,
      display: 32,
    },
    weights: { regular: 400, semibold: 600, bold: 700 },
    lineHeights: { compact: 1.2, body: 1.4, comfortable: 1.5, heading: 1.25 },
  },
  spacing: { none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radii: { none: 0, small: 2, medium: 4, large: 8, pill: 999 },
  borders: { width: 1, strongWidth: 2, dividerWidth: 1 },
  shadows: {
    none: "none",
    low: theme.effects.elevation4,
    medium: theme.effects.elevation8,
    high: theme.effects.elevation16,
  },
  controlHeights: { compact: 28, standard: 32, large: 40 },
  contentWidths: { form: 640, reading: 760, page: 1200, wide: 1440 },
  breakpoints: { phone: 480, tablet: 768, laptop: 1024, desktop: 1366 },
  layers: {
    base: 0,
    sticky: 100,
    navigation: 200,
    overlay: 500,
    dialog: 600,
    toast: 700,
  },
  motion: {
    durations: { instant: 0, fast: 100, standard: 200, slow: 320 },
    easing: "cubic-bezier(0.33, 0, 0.2, 1)",
    reducedMotionMediaQuery: "(prefers-reduced-motion: reduce)",
  },
});

export const pmoDesignTokens = createPmoDesignTokens(pmoTheme);

/** Returns true when the current host asks the app to minimize nonessential motion. */
export const prefersReducedPmoMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(pmoDesignTokens.motion.reducedMotionMediaQuery).matches;

/** Converts a token duration to zero when reduced motion is requested. */
export const getPmoMotionDuration = (duration: number): number =>
  prefersReducedPmoMotion()
    ? pmoDesignTokens.motion.durations.instant
    : duration;
