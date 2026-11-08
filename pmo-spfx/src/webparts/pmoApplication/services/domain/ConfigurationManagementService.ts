import { PMO_FIELDS as F } from "../../config/sharePointSchema";
import type { IPmoConfig } from "../../models/domain";
import type { IPmoSettingDraft } from "../../validation/configuration";
import {
  PMO_KNOWN_SETTINGS,
  validateSettingDraft,
} from "../../validation/configuration";
import type { IRepositoryPage } from "../repositories/contracts";
import type { ConfigRepository } from "../repositories/repositories";
import type { UserCapabilityService } from "./UserCapabilityService";
import { assertCapability } from "./UserCapabilityService";

export class PmoBusinessError extends Error {
  public constructor(
    public readonly code:
      | "duplicate"
      | "validation"
      | "assignment"
      | "conflict"
      | "authorization",
    message: string,
  ) {
    super(message);
    this.name = "PmoBusinessError";
  }
}

export class PmoConfigCache {
  private active?: Promise<readonly IPmoConfig[]>;

  public constructor(private readonly repository: ConfigRepository) {}

  public getActive(): Promise<readonly IPmoConfig[]> {
    this.active ??= this.loadActive();
    return this.active;
  }

  public invalidate(): void {
    this.active = undefined;
  }

  private async loadActive(): Promise<readonly IPmoConfig[]> {
    const settings: IPmoConfig[] = [];
    let continuation: string | undefined;
    do {
      const page = await this.repository.getActive(continuation);
      settings.push(...page.items);
      continuation = page.continuation;
    } while (continuation);
    return settings;
  }
}

export interface IConfigListFilters {
  readonly category?: IPmoConfig["category"];
  readonly isActive?: boolean;
  readonly search?: string;
}

export class ConfigurationManagementService {
  public readonly cache: PmoConfigCache;

  public constructor(
    private readonly repository: ConfigRepository,
    private readonly capabilities: UserCapabilityService,
  ) {
    this.cache = new PmoConfigCache(repository);
  }

  public list(
    filters: IConfigListFilters,
    continuation?: string,
    pageSize = 50,
  ): Promise<IRepositoryPage<IPmoConfig>> {
    return this.repository.getPage(filters, continuation, pageSize);
  }

  public getById(id: number): Promise<IPmoConfig> {
    return this.repository.getById(id);
  }

  public async save(
    draft: IPmoSettingDraft,
    existing?: IPmoConfig,
  ): Promise<IPmoConfig> {
    const actor = await this.capabilities.resolveCurrent();
    try {
      assertCapability(actor, "configuration.manage");
    } catch {
      throw new PmoBusinessError(
        "authorization",
        "Only PMO Owners can maintain configuration settings.",
      );
    }
    const errors = validateSettingDraft(draft);
    const firstKey = Object.keys(errors)[0];
    const firstError = firstKey ? errors[firstKey] : undefined;
    if (firstError) throw new PmoBusinessError("validation", firstError);
    if (
      !existing &&
      !PMO_KNOWN_SETTINGS[draft.key] &&
      !actor.securityRoles.has("owner")
    ) {
      throw new PmoBusinessError(
        "authorization",
        "Only PMO Owners can create an unknown configuration key.",
      );
    }
    const duplicate = await this.repository.getByKey(draft.key.trim());
    if (duplicate && duplicate.id !== existing?.id) {
      throw new PmoBusinessError(
        "duplicate",
        "A setting with this key already exists.",
      );
    }
    const values = {
      [F.config.Title]: draft.key.trim(),
      [F.config.Category]: draft.category,
      [F.config.ConfigValue]: draft.value.trim(),
      [F.config.Description]: draft.description.trim(),
      [F.config.IsActive]: draft.isActive,
      [F.config.SortOrder]: draft.sortOrder ?? 100,
    };
    const saved = existing
      ? await this.repository.update(existing.id, values, existing.etag)
      : await this.repository.create(values);
    this.cache.invalidate();
    return saved;
  }

  public async setActive(
    setting: IPmoConfig,
    active: boolean,
  ): Promise<IPmoConfig> {
    const actor = await this.capabilities.resolveCurrent();
    try {
      assertCapability(actor, "configuration.manage");
    } catch {
      throw new PmoBusinessError(
        "authorization",
        "Only PMO Owners can activate or deactivate settings.",
      );
    }
    const saved = await this.repository.update(
      setting.id,
      { [F.config.IsActive]: active },
      setting.etag,
    );
    this.cache.invalidate();
    return saved;
  }
}
