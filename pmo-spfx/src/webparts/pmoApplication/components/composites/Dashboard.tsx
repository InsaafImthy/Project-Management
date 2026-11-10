import * as React from "react";
import {
  EmptyState,
  LoadingSkeleton,
  PercentageDisplay,
  Stack,
} from "../primitives";
import { AppButton } from "../primitives/Buttons";
import { compositeStyles as styles } from "./compositeStyles";
import {
  pmoDesignTokens,
  type PmoSemanticTone,
} from "../../theme/pmoDesignTokens";

/** Vertical dashboard composition shared by every module. */
export const DashboardLayout = ({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement => <div className={styles.dashboard}>{children}</div>;

/** Responsive KPI container. */
export const KpiGrid = ({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement => <div className={styles.kpiGrid}>{children}</div>;

/** Responsive card grid for dashboard charts, summaries, and queues. */
export const DashboardCardGrid = ({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement => (
  <div className={styles.dashboardCardGrid}>{children}</div>
);

export interface IKpiStatus {
  /** Visible text keeps the indicator meaningful without relying on color. */
  readonly label: string;
  readonly tone?: PmoSemanticTone;
}

export interface IKpiCardProps {
  readonly title: string;
  readonly value: React.ReactNode;
  readonly helpText?: string;
  readonly trend?: React.ReactNode;
  readonly status?: IKpiStatus;
  readonly onDrillDown?: () => void;
}

/** Text-first KPI with an optional keyboard-accessible drill-down. */
export const KpiCard = ({
  title,
  value,
  helpText,
  trend,
  status,
  onDrillDown,
}: IKpiCardProps): React.ReactElement => {
  const content = (
    <>
      <div className={styles.kpiCardHeader}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {status ? (
          <span
            className={`${styles.kpiStatus} ${
              styles[`kpiStatus${status.tone ?? "neutral"}`]
            }`}
          >
            <span aria-hidden="true" className={styles.kpiStatusDot} />
            {status.label}
          </span>
        ) : null}
      </div>
      <div className={styles.cardValue}>{value}</div>
      {trend ? <div className={styles.kpiTrend}>{trend}</div> : null}
      {helpText ? <p className={styles.cardHelp}>{helpText}</p> : null}
      {onDrillDown ? (
        <span aria-hidden="true" className={styles.cardAction}>
          View details <span className={styles.cardActionArrow}>→</span>
        </span>
      ) : null}
    </>
  );
  return onDrillDown ? (
    <button
      className={`${styles.card} ${styles.kpiCard} ${styles.cardButton}`}
      type="button"
      onClick={onDrillDown}
      aria-label={`${title}: open details`}
    >
      {content}
    </button>
  ) : (
    <section className={`${styles.card} ${styles.kpiCard}`}>{content}</section>
  );
};

export interface IChartCardProps {
  readonly title: string;
  readonly helpText?: string;
  readonly children?: React.ReactNode;
  readonly dataTableFallback: React.ReactNode;
  readonly loading?: boolean;
  readonly empty?: boolean;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
}

/** Chart host without a chart-library dependency; always includes accessible equivalent data. */
export const ChartCard = ({
  title,
  helpText,
  children,
  dataTableFallback,
  loading,
  empty,
  emptyTitle = "No chart data",
  emptyDescription = "There is no data available for this chart.",
}: IChartCardProps): React.ReactElement => (
  <section
    className={`${styles.card} ${styles.chartCard}`}
    aria-labelledby={`chart-${title.replace(/\s+/g, "-")}`}
  >
    <header className={styles.chartCardHeader}>
      <h3
        className={styles.cardTitle}
        id={`chart-${title.replace(/\s+/g, "-")}`}
      >
        {title}
      </h3>
      {helpText ? <p className={styles.cardHelp}>{helpText}</p> : null}
    </header>
    <div className={styles.chartCardContent}>
      {loading ? (
        <LoadingSkeleton label={`Loading ${title}`} />
      ) : empty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div aria-hidden="true">{children}</div>
          <div className={styles.chartFallback}>{dataTableFallback}</div>
        </>
      )}
    </div>
  </section>
);

export interface ISimpleBarChartItem {
  readonly label: string;
  readonly value: number;
  readonly colorIndex?: number;
}

/** Lightweight CSS bar chart. Chart colors and category limits are centralized in tokens. */
export const SimpleBarChart = ({
  items,
}: {
  readonly items: readonly ISimpleBarChartItem[];
}): React.ReactElement => {
  const visible = items.slice(0, pmoDesignTokens.charts.maxCategories);
  const maximum = Math.max(1, ...visible.map((item) => item.value));
  return (
    <div className={styles.chartBars}>
      {visible.map((item, index) => (
        <div className={styles.chartBarRow} key={item.label}>
          <span className={styles.chartBarLabel}>{item.label}</span>
          <span className={styles.chartBarTrack}>
            <span
              className={styles.chartBarFill}
              style={{
                display: "block",
                width: `${Math.max(0, (item.value / maximum) * 100)}%`,
                background:
                  pmoDesignTokens.charts.colors[
                    (item.colorIndex ?? index) %
                      pmoDesignTokens.charts.colors.length
                  ],
              }}
            />
          </span>
          <strong className={styles.chartBarValue}>{item.value}</strong>
        </div>
      ))}
    </div>
  );
};

export interface IActionQueueItem {
  readonly key: string;
  readonly title: string;
  readonly detail?: React.ReactNode;
  readonly actionLabel: string;
  readonly onAction: () => void;
}

/** Prioritized in-app action queue; it performs no notification queries. */
export const ActionQueue = ({
  items,
  emptyMessage = "No actions require attention.",
  contained = false,
}: {
  readonly items: readonly IActionQueueItem[];
  readonly emptyMessage?: string;
  /** Use inside a SummaryCard to avoid nesting visual card surfaces. */
  readonly contained?: boolean;
}): React.ReactElement => {
  const content = items.length ? (
    <ul className={styles.queue} aria-label="Action queue">
      {items.map((item) => (
        <li className={styles.queueItem} key={item.key}>
          <div className={styles.queueContent}>
            <strong className={styles.queueTitle}>{item.title}</strong>
            {item.detail ? (
              <div className={styles.mutedText}>{item.detail}</div>
            ) : null}
          </div>
          <AppButton text={item.actionLabel} onClick={item.onAction} />
        </li>
      ))}
    </ul>
  ) : (
    <p className={styles.mutedText}>{emptyMessage}</p>
  );
  return contained ? (
    content
  ) : (
    <div className={styles.actionQueue}>{content}</div>
  );
};

/** Generic summary content card. */
export const SummaryCard = ({
  title,
  children,
  footer,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
}): React.ReactElement => (
  <section className={`${styles.card} ${styles.summaryCard}`}>
    <header className={styles.summaryCardHeader}>
      <h3 className={styles.cardTitle}>{title}</h3>
    </header>
    <div className={styles.summaryCardContent}>{children}</div>
    {footer ? (
      <footer className={styles.summaryCardFooter}>{footer}</footer>
    ) : null}
  </section>
);

/** Labeled, text-equivalent progress summary. */
export const ProgressSummary = ({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: number;
  readonly detail?: React.ReactNode;
}): React.ReactElement => {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div>
      <Stack direction="horizontal" gap="sm">
        <strong>{label}</strong>
        <PercentageDisplay value={bounded} />
      </Stack>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bounded}
      >
        <div className={styles.progressFill} style={{ width: `${bounded}%` }} />
      </div>
      {detail ? <div className={styles.mutedText}>{detail}</div> : null}
    </div>
  );
};

export interface IQuickAction {
  readonly key: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

/** Compact dashboard shortcuts using shared buttons. */
export const QuickActions = ({
  actions,
}: {
  readonly actions: readonly IQuickAction[];
}): React.ReactElement => (
  <Stack direction="horizontal" gap="sm" wrap>
    {actions.map((action) => (
      <AppButton
        key={action.key}
        text={action.label}
        disabled={action.disabled}
        onClick={action.onClick}
      />
    ))}
  </Stack>
);

/** Named dashboard region with optional supporting text and commands. */
export const DashboardSection = ({
  title,
  description,
  commands,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly commands?: React.ReactNode;
  readonly children: React.ReactNode;
}): React.ReactElement => (
  <section
    className={styles.dashboardSection}
    aria-labelledby={`dashboard-${title.replace(/\s+/g, "-")}`}
  >
    <div className={styles.dashboardSectionHeader}>
      <div>
        <h2
          className={styles.sectionHeading}
          id={`dashboard-${title.replace(/\s+/g, "-")}`}
        >
          {title}
        </h2>
        {description ? (
          <p className={styles.sectionDescription}>{description}</p>
        ) : null}
      </div>
      {commands}
    </div>
    {children}
  </section>
);
