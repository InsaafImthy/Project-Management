import * as React from "react";
import {
  EmptyState,
  LoadingSkeleton,
  PercentageDisplay,
  Stack,
} from "../primitives";
import { AppButton } from "../primitives/Buttons";
import { compositeStyles as styles } from "./compositeStyles";
import { pmoDesignTokens } from "../../theme/pmoDesignTokens";

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

export interface IKpiCardProps {
  readonly title: string;
  readonly value: React.ReactNode;
  readonly helpText?: string;
  readonly trend?: React.ReactNode;
  readonly onDrillDown?: () => void;
}

/** Text-first KPI with an optional keyboard-accessible drill-down. */
export const KpiCard = ({
  title,
  value,
  helpText,
  trend,
  onDrillDown,
}: IKpiCardProps): React.ReactElement => {
  const content = (
    <>
      <h3 className={styles.cardTitle}>{title}</h3>
      <div className={styles.cardValue}>{value}</div>
      {trend}
      {helpText ? <p className={styles.cardHelp}>{helpText}</p> : null}
    </>
  );
  return onDrillDown ? (
    <button
      className={`${styles.card} ${styles.cardButton}`}
      type="button"
      onClick={onDrillDown}
      aria-label={`${title}: open details`}
    >
      {content}
    </button>
  ) : (
    <section className={styles.card}>{content}</section>
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
    className={styles.card}
    aria-labelledby={`chart-${title.replace(/\s+/g, "-")}`}
  >
    <h3 className={styles.cardTitle} id={`chart-${title.replace(/\s+/g, "-")}`}>
      {title}
    </h3>
    {helpText ? <p className={styles.cardHelp}>{helpText}</p> : null}
    {loading ? (
      <LoadingSkeleton label={`Loading ${title}`} />
    ) : empty ? (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    ) : (
      <>
        <div aria-hidden="true">{children}</div>
        <div>{dataTableFallback}</div>
      </>
    )}
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
          <span>{item.label}</span>
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
          <strong>{item.value}</strong>
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
}: {
  readonly items: readonly IActionQueueItem[];
  readonly emptyMessage?: string;
}): React.ReactElement =>
  items.length ? (
    <ul className={styles.queue} aria-label="Action queue">
      {items.map((item) => (
        <li className={styles.queueItem} key={item.key}>
          <div>
            <strong>{item.title}</strong>
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
  <section className={styles.card}>
    <h3 className={styles.cardTitle}>{title}</h3>
    <div>{children}</div>
    {footer}
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
    <Stack direction="horizontal" gap="md" wrap>
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
    </Stack>
    {children}
  </section>
);
