import type { IPmoEntity } from "../../models/domain";
import type { ISharePointPage } from "../sharepoint/SharePointClient";

export type RepositoryValues = Readonly<Record<string, unknown>>;

export interface IEntityRepository<T extends IPmoEntity> {
  getById(id: number): Promise<T>;
  create(values: RepositoryValues): Promise<T>;
  update(id: number, values: RepositoryValues, etag: string): Promise<T>;
}

export interface IRepositoryPage<T> {
  readonly items: readonly T[];
  readonly continuation?: string;
}

export const mapRepositoryPage = <TWire, TDomain>(
  page: ISharePointPage<TWire>,
  mapper: (wire: TWire) => TDomain,
): IRepositoryPage<TDomain> => ({
  items: page.items.map(mapper),
  continuation: page.nextLink,
});
