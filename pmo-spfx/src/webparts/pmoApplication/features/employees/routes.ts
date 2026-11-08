import { PMO_ROUTES } from "../../routing/pmoRoutes";

export const EMPLOYEE_ROUTES = {
  dashboard: PMO_ROUTES.employees,
  list: PMO_ROUTES.employeeList,
  detail: PMO_ROUTES.employee,
  myProfile: PMO_ROUTES.myProfile,
} as const;
