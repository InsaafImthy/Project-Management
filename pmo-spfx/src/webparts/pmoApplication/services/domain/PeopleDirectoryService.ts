import type { IPmoPerson } from "../../models/domain";
import type { ISharePointClient } from "../sharepoint/SharePointClient";
import { escapeODataString } from "../sharepoint/SharePointClient";

interface ISiteUsersResponse {
  readonly value?: readonly {
    readonly Id: number;
    readonly Title: string;
    readonly Email?: string;
    readonly LoginName?: string;
  }[];
}

export class PeopleDirectoryService {
  public constructor(private readonly client: ISharePointClient) {}

  public async search(query: string): Promise<readonly IPmoPerson[]> {
    const term = query.trim();
    if (term.length < 2) return [];
    const filter = `PrincipalType eq 1 and (substringof('${escapeODataString(term)}',Title) or substringof('${escapeODataString(term)}',Email))`;
    const response = await this.client.getJson<ISiteUsersResponse>(
      `_api/web/siteusers?$select=Id,Title,Email,LoginName&$filter=${encodeURIComponent(filter)}&$top=20`,
    );
    return (response.value ?? [])
      .filter((person) => Boolean(person.Email))
      .map((person) => ({
        id: person.Id,
        displayName: person.Title,
        email: person.Email?.toLowerCase(),
        loginName: person.LoginName,
      }));
  }
}
