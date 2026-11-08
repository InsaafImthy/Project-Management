import type { ISharePointClient } from "../services/sharepoint/SharePointClient";

export interface IPmoApplicationProps {
  isDarkTheme: boolean;
  userDisplayName: string;
  userEmail: string;
  sharePointClient?: ISharePointClient;
}
