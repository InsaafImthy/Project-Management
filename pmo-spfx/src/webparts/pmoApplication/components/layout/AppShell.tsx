import * as React from "react";
import { Icon, MessageBar, MessageBarType } from "@fluentui/react";
import { usePmoCurrentUser } from "../../hooks/usePmoCurrentUser";
import {
  usePmoDisplayPreferences,
  usePmoInteractions,
  type PmoMessageTone,
} from "../../context/PmoApplicationContext";
import {
  PMO_NAVIGATION,
  type IPmoNavigationItem,
  type IPmoRouteState,
  usePmoRoute,
} from "../../routing/pmoRoutes";
import { ConfirmDialog } from "../composites/Forms";
import { AppButton, AvatarName, IconButton } from "../primitives";
import { layoutStyles as styles } from "./layoutStyles";

export interface IPageBreadcrumb {
  readonly text: string;
  readonly onClick?: () => void;
}

const Breadcrumbs = ({
  items,
}: {
  readonly items: readonly IPageBreadcrumb[];
}): React.ReactElement => (
  <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
    <ol className={styles.breadcrumbList}>
      {items.map((item, index) => (
        <li key={`${item.text}-${index}`}>
          {item.onClick ? (
            <button
              className={styles.breadcrumbButton}
              type="button"
              onClick={item.onClick}
            >
              {item.text}
            </button>
          ) : (
            <span
              aria-current={index === items.length - 1 ? "page" : undefined}
            >
              {item.text}
            </span>
          )}
          {index < items.length - 1 ? (
            <span aria-hidden="true"> / </span>
          ) : null}
        </li>
      ))}
    </ol>
  </nav>
);

export interface ISidebarProps {
  readonly items: readonly IPmoNavigationItem[];
  readonly capabilities: readonly string[];
  readonly activeRoute: string;
  readonly collapsed: boolean;
  readonly onCollapsedChange: (collapsed: boolean) => void;
  readonly onNavigate: (item: IPmoNavigationItem) => void;
}

/** Grouped capability-filtered application navigation. Visibility is not authorization. */
export const Sidebar = ({
  items,
  capabilities,
  activeRoute,
  collapsed,
  onCollapsedChange,
  onNavigate,
}: ISidebarProps): React.ReactElement => {
  const allowed = items.filter((item) =>
    (item.requiredCapabilities ?? []).every(
      (capability) => capabilities.indexOf(capability) >= 0,
    ),
  );
  const groups = allowed.reduce<Record<string, IPmoNavigationItem[]>>(
    (result, item) => {
      (result[item.group] ??= []).push(item);
      return result;
    },
    {},
  );
  const hiddenLabelClass = collapsed
    ? styles.sidebarLabelCollapsed
    : styles.sidebarLabel;
  return (
    <aside className={styles.sidebar} aria-label="Application navigation">
      <div className={styles.sidebarBrand}>
        <span className={hiddenLabelClass}>PMO</span>
        <IconButton
          className={styles.sidebarToggle}
          ariaLabel={collapsed ? "Expand navigation" : "Collapse navigation"}
          iconProps={{
            iconName: collapsed ? "DoubleChevronRight" : "DoubleChevronLeft",
          }}
          onClick={() => onCollapsedChange(!collapsed)}
        />
      </div>
      <nav aria-label="PMO modules">
        {Object.keys(groups).map((group) => (
          <section
            className={styles.sidebarGroup}
            key={group}
            aria-label={group}
          >
            <div className={`${styles.sidebarGroupTitle} ${hiddenLabelClass}`}>
              {group}
            </div>
            <ul className={styles.sidebarList}>
              {(groups[group] ?? []).map((item) => {
                const active = activeRoute === item.route;
                return (
                  <li key={item.key}>
                    <button
                      className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ""}`}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      onClick={() => onNavigate(item)}
                    >
                      <Icon
                        className={styles.sidebarIcon}
                        iconName={item.iconName ?? "NavigateExternalInline"}
                      />
                      <span className={hiddenLabelClass}>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
};

export interface IAppHeaderProps {
  readonly title: string;
  readonly breadcrumbs?: readonly IPageBreadcrumb[];
  readonly userName: string;
}

/** Shared application title, route context, identity, and future Action Center entry point. */
export const AppHeader = ({
  title,
  breadcrumbs = [],
  userName,
}: IAppHeaderProps): React.ReactElement => (
  <header className={styles.header}>
    <div>
      <div className={styles.headerTitle}>{title}</div>
      {breadcrumbs.length ? <Breadcrumbs items={breadcrumbs} /> : null}
    </div>
    <div className={styles.headerUser}>
      <AppButton
        variant="subtle"
        text="Action Center"
        disabled
        title="Available in a later feature stage"
      />
      <AvatarName name={userName} />
    </div>
  </header>
);

const messageTypes: Record<PmoMessageTone, MessageBarType> = {
  information: MessageBarType.info,
  success: MessageBarType.success,
  warning: MessageBarType.warning,
  danger: MessageBarType.error,
};

export interface IAppShellProps {
  readonly children: React.ReactNode;
  readonly title?: string;
  readonly breadcrumbs?: readonly IPageBreadcrumb[];
  readonly navigation?: readonly IPmoNavigationItem[];
}

/** Responsive, single-instance shell used by all routes and feature modules. */
export const AppShell = ({
  children,
  title = "PMO Workspace",
  breadcrumbs,
  navigation = PMO_NAVIGATION,
}: IAppShellProps): React.ReactElement => {
  const user = usePmoCurrentUser();
  const { route, navigate } = usePmoRoute();
  const { sidebarCollapsed, setSidebarCollapsed } = usePmoDisplayPreferences();
  const { messages, dismissMessage, dialogRequest, resolveConfirmation } =
    usePmoInteractions();
  const navigateTo = (item: IPmoNavigationItem): void => {
    const next: IPmoRouteState = {
      view: item.route,
      parameters: {},
      query: { view: item.route },
    };
    navigate(next);
  };
  const activeTitle =
    navigation.filter((item) => item.route === route.view)[0]?.label ?? title;
  return (
    <div
      className={`${styles.appShell} ${sidebarCollapsed ? styles.appShellCollapsed : ""}`}
    >
      <Sidebar
        items={navigation}
        capabilities={user.capabilities ?? []}
        activeRoute={route.view}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onNavigate={navigateTo}
      />
      <AppHeader
        title={activeTitle}
        breadcrumbs={breadcrumbs}
        userName={user.displayName}
      />
      <main className={styles.main}>
        {messages.length ? (
          <div className={styles.messages} aria-label="Application messages">
            {messages.map((message) => (
              <MessageBar
                key={message.id}
                messageBarType={messageTypes[message.tone]}
                onDismiss={() => dismissMessage(message.id)}
              >
                {message.text}
              </MessageBar>
            ))}
          </div>
        ) : null}
        {children}
      </main>
      <ConfirmDialog
        open={Boolean(dialogRequest)}
        title={dialogRequest?.title ?? "Confirm"}
        message={dialogRequest?.message ?? ""}
        confirmLabel={dialogRequest?.confirmLabel}
        destructive={dialogRequest?.destructive}
        onConfirm={() => resolveConfirmation(true)}
        onDismiss={() => resolveConfirmation(false)}
      />
    </div>
  );
};

export const ContentContainer = ({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement => (
  <div className={styles.contentContainer}>{children}</div>
);

export interface IPageHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly breadcrumbs?: readonly IPageBreadcrumb[];
  readonly commands?: React.ReactNode;
}

/** Route-page heading with one shared breadcrumb and command placement. */
export const PageHeader = ({
  title,
  subtitle,
  breadcrumbs = [],
  commands,
}: IPageHeaderProps): React.ReactElement => (
  <div>
    {breadcrumbs.length ? <Breadcrumbs items={breadcrumbs} /> : null}
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
      </div>
      {commands}
    </div>
  </div>
);
