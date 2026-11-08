import type { SPHttpClientResponse } from '@microsoft/sp-http';
import type { PmoListName } from '../../config/environment';

/** Shared direct-service boundary; repositories are added by feature stages. */
export interface IPmoSharePointService {
  getListItemsEndpoint(listName: PmoListName): string;
  getListItems(listName: PmoListName): Promise<SPHttpClientResponse>;
}
