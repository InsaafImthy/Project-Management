import { PMO_ROUTES } from "../../routing/pmoRoutes";

export const FINANCE_ROUTES = {
  dashboard: PMO_ROUTES.financialSummary,
  rates: PMO_ROUTES.employeeRates,
  costs: PMO_ROUTES.projectCosts,
  projectFinancials: PMO_ROUTES.projectFinancials,
} as const;
