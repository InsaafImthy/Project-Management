import * as React from "react";
import {
  Icon,
  MessageBar,
  MessageBarType,
  Panel,
  PanelType,
} from "@fluentui/react";
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
import {
  layoutStyles as styles,
  navigationDrawerPanelStyles,
} from "./layoutStyles";
import { PmoServicesContext } from "../../context/PmoServicesContext";
import type { IActionCenterResult } from "../../services/domain/ActionCenterService";
import { PMO_APPLICATION_VERSION } from "../../config/environment";

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
  readonly drawer?: boolean;
  readonly showCollapseToggle?: boolean;
}

/** Grouped capability-filtered application navigation. Visibility is not authorization. */
export const Sidebar = ({
  items,
  capabilities,
  activeRoute,
  collapsed,
  onCollapsedChange,
  onNavigate,
  drawer = false,
  showCollapseToggle = true,
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
    <aside
      className={`${styles.sidebar} ${drawer ? styles.sidebarDrawer : ""}`}
      aria-label="Application navigation"
    >
      {!drawer ? (
        <div className={styles.sidebarBrand}>
          <span className={hiddenLabelClass}>PMO</span>
          {showCollapseToggle ? (
            <IconButton
              className={styles.sidebarToggle}
              ariaLabel={
                collapsed ? "Expand navigation" : "Collapse navigation"
              }
              iconProps={{
                iconName: collapsed
                  ? "DoubleChevronRight"
                  : "DoubleChevronLeft",
              }}
              onClick={() => onCollapsedChange(!collapsed)}
            />
          ) : null}
        </div>
      ) : null}
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
  readonly compact?: boolean;
  readonly onNavigationOpen?: () => void;
}

const ActionCenterLauncher = (): React.ReactElement => {
  const services = React.useContext(PmoServicesContext);
  const { navigate } = usePmoRoute();
  const [open, setOpen] = React.useState(false);
  const [actions, setActions] = React.useState<IActionCenterResult>();
  const [loading, setLoading] = React.useState(false);
  const load = (): void => {
    if (!services) return;
    setLoading(true);
    void services.actionCenter
      .getActions()
      .then(setActions)
      .catch(() => undefined)
      .then(() => setLoading(false));
  };
  React.useEffect(load, [services]);
  const go = (view: string, query: Readonly<Record<string, string>> = {}) => {
    setOpen(false);
    navigate({ view, parameters: {}, query: { view, ...query } });
  };
  const total = actions
    ? Object.keys(actions.counts).reduce(
        (sum, key) => sum + actions.counts[key as keyof typeof actions.counts],
        0,
      )
    : 0;
  const items: readonly {
    readonly key: string;
    readonly label: string;
    readonly count: number;
    readonly view: string;
    readonly query: Readonly<Record<string, string>>;
  }[] = actions
    ? [
        {
          key: "assigned",
          label: "Assigned",
          count: actions.counts.awaitingAcceptance,
          view: "my-work",
          query: { status: "Assigned" },
        },
        {
          key: "overdue",
          label: "Overdue",
          count: actions.counts.overdue,
          view: "my-work",
          query: { overdue: "true" },
        },
        {
          key: "pending",
          label: "Pending approvals",
          count: actions.counts.pendingApprovals,
          view: "approval-queue",
          query: {},
        },
        {
          key: "returned",
          label: "Returned",
          count: actions.counts.returned,
          view: "my-work",
          query: { attention: "returned" },
        },
        {
          key: "failed",
          label: "Failed actions",
          count: actions.counts.failedTaskActions,
          view: "my-work",
          query: { actionStatus: "Failed" },
        },
        {
          key: "stale",
          label: "Stale metrics",
          count: actions.counts.staleMetrics,
          view: "project-list",
          query: { stale: "true" },
        },
      ]
    : [];
  return (
    <>
      <AppButton
        variant="subtle"
        text={`Action Center${total ? ` (${total})` : ""}`}
        disabled={!services}
        onClick={() => {
          setOpen(true);
          load();
        }}
      />
      <Panel
        isOpen={open}
        type={PanelType.medium}
        headerText="Action Center"
        onDismiss={() => setOpen(false)}
        closeButtonAriaLabel="Close Action Center"
      >
        {loading ? <p>Loading actions…</p> : null}
        {!loading && !items.some((item) => item.count > 0) ? (
          <p>
            No assigned, overdue, pending, returned, failed, or stale records
            require attention.
          </p>
        ) : null}
        <ul>
          {items
            .filter((item) => item.count > 0)
            .map((item) => (
              <li key={item.key}>
                <AppButton
                  variant="subtle"
                  text={`${item.label} (${item.count})`}
                  onClick={() => go(item.view, item.query)}
                />
              </li>
            ))}
        </ul>
      </Panel>
    </>
  );
};

/** Shared application title, route context, identity, and future Action Center entry point. */
export const AppHeader = ({
  title,
  breadcrumbs = [],
  userName,
  compact = false,
  onNavigationOpen,
}: IAppHeaderProps): React.ReactElement => (
  <header className={`${styles.header} ${compact ? styles.headerCompact : ""}`}>
    {onNavigationOpen ? (
      <IconButton
        className={styles.headerMenuButton}
        ariaLabel="Open navigation"
        iconProps={{ iconName: "GlobalNavButton" }}
        onClick={onNavigationOpen}
      />
    ) : null}
    <div className={styles.headerContext}>
      <div className={styles.headerTitle}>{title}</div>
      {!compact && breadcrumbs.length ? (
        <Breadcrumbs items={breadcrumbs} />
      ) : null}
    </div>
    <div className={styles.headerUser}>
      {!compact ? (
        <span className={styles.headerVersion}>v{PMO_APPLICATION_VERSION}</span>
      ) : null}
      <ActionCenterLauncher />
      <span className={compact ? styles.headerIdentityCompact : ""}>
        <AvatarName name={userName} />
      </span>
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

type ShellLayoutMode = "desktop" | "compact" | "mobile";

const getShellLayoutMode = (width: number): ShellLayoutMode => {
  if (width < 720) return "mobile";
  if (width < 1024) return "compact";
  return "desktop";
};

/** Observes the rendered web-part width so embedded layouts respond to their container. */
const useShellLayoutMode = (): [
  React.RefObject<HTMLDivElement>,
  ShellLayoutMode,
] => {
  const shellRef = React.useRef<HTMLDivElement>(null);
  const [mode, setMode] = React.useState<ShellLayoutMode>("desktop");

  React.useLayoutEffect(() => {
    const updateMode = (width?: number): void => {
      const measuredWidth =
        width ?? shellRef.current?.getBoundingClientRect().width ?? 0;
      const availableWidth =
        measuredWidth > 0 || typeof window === "undefined"
          ? measuredWidth
          : window.innerWidth;
      setMode(getShellLayoutMode(availableWidth));
    };
    const shell = shellRef.current;
    updateMode();
    if (shell && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        updateMode(entries[0]?.contentRect.width);
      });
      observer.observe(shell);
      return () => observer.disconnect();
    }
    const handleWindowResize = (): void => updateMode();
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  return [shellRef, mode];
};

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
  const [shellRef, layoutMode] = useShellLayoutMode();
  const [navigationOpen, setNavigationOpen] = React.useState(false);
  const mobile = layoutMode === "mobile";
  const compact = layoutMode !== "desktop";
  const effectiveCollapsed = !mobile && (sidebarCollapsed || compact);
  React.useEffect(() => {
    if (!mobile) setNavigationOpen(false);
  }, [mobile]);
  const navigateTo = (item: IPmoNavigationItem): void => {
    const next: IPmoRouteState = {
      view: item.route,
      parameters: {},
      query: { view: item.route },
    };
    navigate(next);
    setNavigationOpen(false);
  };
  const activeTitle =
    navigation.filter((item) => item.route === route.view)[0]?.label ?? title;
  return (
    <div
      ref={shellRef}
      className={`${styles.appShell} ${mobile ? styles.appShellMobile : effectiveCollapsed ? styles.appShellCollapsed : ""}`}
    >
      {!mobile ? (
        <Sidebar
          items={navigation}
          capabilities={user.capabilities ?? []}
          activeRoute={route.view}
          collapsed={effectiveCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          onNavigate={navigateTo}
          showCollapseToggle={!compact}
        />
      ) : null}
      <AppHeader
        title={activeTitle}
        breadcrumbs={breadcrumbs}
        userName={user.displayName}
        compact={compact}
        onNavigationOpen={mobile ? () => setNavigationOpen(true) : undefined}
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
      <Panel
        isOpen={mobile && navigationOpen}
        isLightDismiss
        type={PanelType.smallFixedNear}
        headerText="PMO navigation"
        closeButtonAriaLabel="Close navigation"
        styles={navigationDrawerPanelStyles}
        onDismiss={() => setNavigationOpen(false)}
      >
        <Sidebar
          drawer
          items={navigation}
          capabilities={user.capabilities ?? []}
          activeRoute={route.view}
          collapsed={false}
          onCollapsedChange={setSidebarCollapsed}
          onNavigate={navigateTo}
        />
      </Panel>
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
