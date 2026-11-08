import type { IPmoEntity } from "../../models/domain";
import type {
  IEntityRepository,
  RepositoryValues,
} from "../../services/repositories/contracts";

export type InMemoryCreate<T extends IPmoEntity> = (
  id: number,
  values: RepositoryValues,
) => T;
export type InMemoryUpdate<T extends IPmoEntity> = (
  current: T,
  values: RepositoryValues,
  nextEtag: string,
) => T;

/** Test-only repository double; production services never import this folder. */
export class InMemoryRepository<T extends IPmoEntity>
  implements IEntityRepository<T>
{
  private readonly items = new Map<number, T>();
  private nextId = 1;
  private version = 1;

  public constructor(
    seed: readonly T[],
    private readonly createEntity: InMemoryCreate<T>,
    private readonly updateEntity: InMemoryUpdate<T>,
  ) {
    seed.forEach((item) => this.items.set(item.id, item));
    this.nextId = Math.max(0, ...seed.map((item) => item.id)) + 1;
  }

  public async getById(id: number): Promise<T> {
    const item = this.items.get(id);
    if (!item) throw new Error(`Test entity ${id} was not found.`);
    return item;
  }

  public async create(values: RepositoryValues): Promise<T> {
    const item = this.createEntity(this.nextId++, values);
    this.items.set(item.id, item);
    return item;
  }

  public async update(
    id: number,
    values: RepositoryValues,
    etag: string,
  ): Promise<T> {
    const current = await this.getById(id);
    if (etag !== current.etag) throw new Error("Test ETag conflict.");
    const updated = this.updateEntity(
      current,
      values,
      `\"memory-${this.version++}\"`,
    );
    this.items.set(id, updated);
    return updated;
  }

  public all(): readonly T[] {
    return Array.from(this.items.values());
  }
}
