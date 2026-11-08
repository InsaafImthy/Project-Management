import { SPHttpClient, type SPHttpClientResponse } from '@microsoft/sp-http';
import type { IPmoEnvironmentConfiguration, PmoListName } from '../../config/environment';
import type { IPmoSharePointService } from './IPmoSharePointService';

export class PmoSharePointService implements IPmoSharePointService {
  public constructor(
    private readonly httpClient: SPHttpClient,
    private readonly environment: IPmoEnvironmentConfiguration
  ) {}

  public getListItemsEndpoint(listName: PmoListName): string {
    return `${this.environment.siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/items`;
  }

  public getListItems(listName: PmoListName): Promise<SPHttpClientResponse> {
    return this.httpClient.get(
      this.getListItemsEndpoint(listName),
      SPHttpClient.configurations.v1
    );
  }
}
