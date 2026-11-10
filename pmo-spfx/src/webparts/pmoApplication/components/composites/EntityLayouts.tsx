import * as React from "react";
import { Pivot, PivotItem } from "@fluentui/react";
import { PageHeader, type IPageBreadcrumb } from "../layout/AppShell";
import { AppButton, Stack } from "../primitives";
import type { IDataTableProps } from "./DataTable";
import { DataTable } from "./DataTable";
import { compositeStyles as styles } from "./compositeStyles";

export interface IEntityListPageProps<T> extends IDataTableProps<T> {
  readonly title: string;
  readonly subtitle?: string;
  readonly breadcrumbs?: readonly IPageBreadcrumb[];
  readonly commands?: React.ReactNode;
  readonly createLabel?: string;
  readonly onCreate?: () => void;
}

/** Consistent list-page composition; callers retain all server and entity state. */
export const EntityListPage = <T,>({
  title,
  subtitle,
  breadcrumbs,
  commands,
  createLabel = "Create",
  onCreate,
  ...tableProps
}: IEntityListPageProps<T>): React.ReactElement => (
  <div className={`${styles.page} ${styles.entityListPage}`}>
    <PageHeader
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      commands={
        <div className={styles.entityHeaderCommands}>
          {commands}
          {onCreate ? (
            <AppButton
              variant="primary"
              text={createLabel}
              onClick={onCreate}
            />
          ) : null}
        </div>
      }
    />
    <DataTable {...tableProps} />
  </div>
);

export interface IEntityDetailTab {
  readonly key: string;
  readonly label: string;
  readonly content: React.ReactNode;
}

export interface IEntityDetailSection {
  readonly key: string;
  readonly title: string;
  readonly content: React.ReactNode;
}

export interface IEntityDetailLayoutProps {
  /** Title, breadcrumb, and concise record context shown before the detail band. */
  readonly header?: React.ReactNode;
  readonly summary: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly tabs?: readonly IEntityDetailTab[];
  readonly sections?: readonly IEntityDetailSection[];
  readonly relatedRecords?: React.ReactNode;
}

/** Detail-page skeleton supporting either tabbed or sequential information architecture. */
export const EntityDetailLayout = ({
  header,
  summary,
  actions,
  tabs,
  sections,
  relatedRecords,
}: IEntityDetailLayoutProps): React.ReactElement => (
  <div className={`${styles.page} ${styles.entityDetailLayout}`}>
    {header ? <div className={styles.detailHeader}>{header}</div> : null}
    <section
      className={`${styles.surface} ${styles.detailSummary}`}
      aria-label="Summary"
    >
      <Stack gap="md" className={styles.detailSummaryContent}>
        {summary}
      </Stack>
      {actions ? <div className={styles.detailActions}>{actions}</div> : null}
    </section>
    <div
      className={
        relatedRecords ? styles.detailBodyWithRelated : styles.detailBody
      }
    >
      <div className={styles.detailContent}>
        {tabs?.length ? (
          <div className={styles.detailTabsRegion}>
            <Pivot className={styles.detailTabs}>
              {tabs.map((tab) => (
                <PivotItem
                  key={tab.key}
                  headerText={tab.label}
                  itemKey={tab.key}
                >
                  <div className={styles.detailTabContent}>{tab.content}</div>
                </PivotItem>
              ))}
            </Pivot>
          </div>
        ) : (
          sections?.map((section) => (
            <section
              className={styles.detailSection}
              key={section.key}
              aria-labelledby={`section-${section.key}`}
            >
              <h2
                className={styles.detailSectionTitle}
                id={`section-${section.key}`}
              >
                {section.title}
              </h2>
              {section.content}
            </section>
          ))
        )}
      </div>
      {relatedRecords ? (
        <aside className={styles.detailRelated} aria-label="Related records">
          {relatedRecords}
        </aside>
      ) : null}
    </div>
  </div>
);
