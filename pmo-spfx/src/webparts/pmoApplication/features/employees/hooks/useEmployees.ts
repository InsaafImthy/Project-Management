import * as React from "react";
import type { IPmoEmployee, IPmoProjectMember } from "../../../models/domain";
import type {
  EmployeeManagementService,
  IEmployeeDashboardSummary,
  IEmployeeListFilters,
} from "../../../services/domain";

export const useEmployeePage = (
  service: EmployeeManagementService,
  filters: IEmployeeListFilters,
  pageSize = 25,
): {
  readonly items: readonly IPmoEmployee[];
  readonly loading: boolean;
  readonly error?: string;
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly setPageIndex: (page: number) => void;
  readonly reload: () => void;
} => {
  const [items, setItems] = React.useState<readonly IPmoEmployee[]>([]);
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
        if (active) setError("Employees could not be loaded.");
      })
      .then(() => {
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Employees could not be loaded.");
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

export const useEmployeeDashboard = (
  service: EmployeeManagementService,
): {
  readonly summary?: IEmployeeDashboardSummary;
  readonly loading: boolean;
  readonly error?: string;
} => {
  const [summary, setSummary] = React.useState<IEmployeeDashboardSummary>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  React.useEffect(() => {
    service
      .getDashboardSummary()
      .then(setSummary)
      .then(undefined, () => setError("Employee summary could not be loaded."))
      .then(() => setLoading(false))
      .catch(() => {
        setError("Employee summary could not be loaded.");
        setLoading(false);
      });
  }, [service]);
  return { summary, loading, error };
};

export const useEmployeeDetail = (
  service: EmployeeManagementService,
  employeeId?: number,
  myProfile = false,
): {
  readonly employee?: IPmoEmployee;
  readonly memberships: readonly IPmoProjectMember[];
  readonly loading: boolean;
  readonly error?: string;
  readonly reload: () => void;
} => {
  const [employee, setEmployee] = React.useState<IPmoEmployee>();
  const [memberships, setMemberships] = React.useState<
    readonly IPmoProjectMember[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    const request = myProfile
      ? service.getMyProfile()
      : employeeId
        ? service.getById(employeeId)
        : Promise.reject(new Error("Employee ID is required."));
    request
      .then(async (loaded) => {
        const memberPage = await service.getMemberships(loaded.id);
        if (active) {
          setEmployee(loaded);
          setMemberships(memberPage.items);
        }
      })
      .then(undefined, (caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Employee could not be loaded.",
          );
        }
      })
      .then(() => {
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Employee could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [employeeId, myProfile, service, version]);
  return {
    employee,
    memberships,
    loading,
    error,
    reload: () => setVersion((current) => current + 1),
  };
};
