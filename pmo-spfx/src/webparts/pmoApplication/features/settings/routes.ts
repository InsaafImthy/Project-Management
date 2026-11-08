import { PMO_ROUTES } from "../../routing/pmoRoutes";

export const SETTINGS_ROUTES = {
  dashboard: PMO_ROUTES.settings,
  list: PMO_ROUTES.settingsList,
} as const;
