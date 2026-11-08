import * as React from "react";
import { AppButton, AvatarName } from "../primitives";
import { compositeStyles as styles } from "./compositeStyles";

export interface IDescriptionListItem {
  readonly key: string;
  readonly label: string;
  readonly value: React.ReactNode;
}

/** Responsive label/value summary with semantic description-list markup. */
export const DescriptionList = ({
  items,
}: {
  readonly items: readonly IDescriptionListItem[];
}): React.ReactElement => (
  <dl className={styles.descriptionList}>
    {items.map((item) => (
      <div className={styles.descriptionItem} key={item.key}>
        <dt className={styles.descriptionTerm}>{item.label}</dt>
        <dd className={styles.descriptionValue}>{item.value}</dd>
      </div>
    ))}
  </dl>
);

export interface ITimelineItem {
  readonly key: string;
  readonly title: string;
  readonly detail?: React.ReactNode;
  readonly timestamp?: React.ReactNode;
  readonly actor?: string;
}

/** Ordered status, approval, or action history. */
export const Timeline = ({
  items,
  ariaLabel = "History",
}: {
  readonly items: readonly ITimelineItem[];
  readonly ariaLabel?: string;
}): React.ReactElement => (
  <ol className={styles.timeline} aria-label={ariaLabel}>
    {items.map((item) => (
      <li className={styles.timelineItem} key={item.key}>
        <strong>{item.title}</strong>
        {item.actor ? (
          <div className={styles.mutedText}>{item.actor}</div>
        ) : null}
        {item.detail ? <div>{item.detail}</div> : null}
        {item.timestamp ? (
          <div className={styles.mutedText}>{item.timestamp}</div>
        ) : null}
      </li>
    ))}
  </ol>
);

export interface IActivityItem {
  readonly key: string;
  readonly actor: string;
  readonly actorImageUrl?: string;
  readonly summary: React.ReactNode;
  readonly timestamp: React.ReactNode;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

/** Recent activity feed with optional per-entry follow-up action. */
export const ActivityList = ({
  items,
  ariaLabel = "Recent activity",
}: {
  readonly items: readonly IActivityItem[];
  readonly ariaLabel?: string;
}): React.ReactElement => (
  <ul className={styles.activityList} aria-label={ariaLabel}>
    {items.map((item) => (
      <li className={styles.activityItem} key={item.key}>
        <AvatarName name={item.actor} imageUrl={item.actorImageUrl} />
        <div>{item.summary}</div>
        <div className={styles.mutedText}>{item.timestamp}</div>
        {item.actionLabel && item.onAction ? (
          <AppButton
            variant="subtle"
            text={item.actionLabel}
            onClick={item.onAction}
          />
        ) : null}
      </li>
    ))}
  </ul>
);
