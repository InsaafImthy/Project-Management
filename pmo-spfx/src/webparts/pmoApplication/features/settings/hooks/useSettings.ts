import * as React from "react";
import type { IPmoConfig } from "../../../models/domain";
import type {
  ConfigurationManagementService,
  IConfigListFilters,
} from "../../../services/domain";

export interface ISettingsPageState {
  readonly items: readonly IPmoConfig[];
  readonly loading: boolean;
  readonly error?: string;
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly setPageIndex: (page: number) => void;
  readonly reload: () => void;
}

export const useSettingsPage = (
  service: ConfigurationManagementService,
  filters: IConfigListFilters,
  pageSize = 25,
): ISettingsPageState => {
  const [items, setItems] = React.useState<readonly IPmoConfig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [pageIndex, setPageIndex] = React.useState(0);
  const [continuations, setContinuations] = React.useState<
    readonly (string | undefined)[]
  >([undefined]);
  const [hasNext, setHasNext] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const filterKey = JSON.stringify(filters);
  const continuation = continuations[pageIndex];

  React.useEffect(() => {
    setPageIndex(0);
    setContinuations([undefined]);
  }, [filterKey]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    service
      .list(filters, continuation, pageSize)
      .then((page) => {
        if (!active) return;
        setItems(page.items);
        setHasNext(Boolean(page.continuation));
        if (page.continuation) {
          setContinuations((current) => {
            const next = [...current];
            next[pageIndex + 1] = page.continuation;
            return next;
          });
        }
      })
      .then(undefined, () => {
        if (active) setError("Settings could not be loaded.");
      })
      .then(() => {
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Settings could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [continuation, filterKey, pageIndex, pageSize, service, version]);

  return {
    items,
    loading,
    error,
    pageIndex,
    pageSize,
    totalItems: pageIndex * pageSize + items.length + (hasNext ? 1 : 0),
    setPageIndex,
    reload: () => setVersion((current) => current + 1),
  };
};

export const useSettingsDashboard = (
  service: ConfigurationManagementService,
): {
  readonly settings: readonly IPmoConfig[];
  readonly loading: boolean;
  readonly error?: string;
} => {
  const [settings, setSettings] = React.useState<readonly IPmoConfig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  React.useEffect(() => {
    service.cache
      .getActive()
      .then(setSettings)
      .then(undefined, () =>
        setError("Configuration summary could not be loaded."),
      )
      .then(() => setLoading(false))
      .catch(() => {
        setError("Configuration summary could not be loaded.");
        setLoading(false);
      });
  }, [service]);
  return { settings, loading, error };
};
