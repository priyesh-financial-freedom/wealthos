import {
  PlanningInputRepository,
  type PlanningInputRepositoryContract,
} from "./Repository";
import {
  PlanningInputMapper,
  type PlanningInputPersistenceRow,
} from "./Mapper";
import type {
  PlanningInputCreate,
  PlanningInputEntityMap,
  PlanningInputEntityName,
  PlanningInputPatch,
} from "./Types";
import {
  PlanningInputValidator,
  type PlanningInputValidationIssue,
} from "./Validators";

function nowIso() {
  return new Date().toISOString();
}

export class PlanningInputService {
  constructor(
    private readonly repository: PlanningInputRepositoryContract = new PlanningInputRepository(),
    private readonly validator: PlanningInputValidator = new PlanningInputValidator(),
    private readonly mapper: PlanningInputMapper = new PlanningInputMapper(),
  ) {}

  async listVersions<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
  ): Promise<Array<PlanningInputEntityMap[TEntityName]>> {
    return this.repository.listVersions(entityName, id);
  }

  async getActive<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
    asOfDate?: string,
  ): Promise<PlanningInputEntityMap[TEntityName] | null> {
    return this.repository.getActive(entityName, id, asOfDate);
  }

  async saveVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    payload: PlanningInputCreate<TEntityName>,
  ): Promise<{ entity: PlanningInputEntityMap[TEntityName] | null; issues: PlanningInputValidationIssue[] }> {
    const createdAt = payload.createdAt ?? nowIso();
    const hydrated = {
      ...payload,
      createdAt,
      updatedAt: payload.updatedAt ?? createdAt,
    } as PlanningInputEntityMap[TEntityName];

    const issues = this.validator.validate(entityName, hydrated);
    if (issues.length > 0) {
      return { entity: null, issues };
    }

    const entity = await this.repository.upsertVersion(entityName, hydrated);
    return { entity, issues: [] };
  }

  async patchVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    patch: PlanningInputPatch<TEntityName>,
  ): Promise<{ entity: PlanningInputEntityMap[TEntityName] | null; issues: PlanningInputValidationIssue[] }> {
    const existing = await this.repository.getVersion(entityName, patch.id, patch.version);
    if (!existing) {
      return {
        entity: null,
        issues: [{ field: "id", message: "Entity version not found." }],
      };
    }

    const candidate = {
      ...existing,
      ...patch,
      updatedAt: nowIso(),
    } as PlanningInputEntityMap[TEntityName];

    const issues = this.validator.validate(entityName, candidate);
    if (issues.length > 0) {
      return { entity: null, issues };
    }

    const entity = await this.repository.patchVersion(entityName, patch);
    return { entity, issues: [] };
  }

  async activateVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
    version: number,
  ): Promise<PlanningInputEntityMap[TEntityName] | null> {
    return this.repository.activateVersion(entityName, id, version);
  }

  toPersistence<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    entity: PlanningInputEntityMap[TEntityName],
  ): PlanningInputPersistenceRow<TEntityName> {
    return this.mapper.toPersistence(entityName, entity);
  }

  fromPersistence<TEntityName extends PlanningInputEntityName>(
    row: PlanningInputPersistenceRow<TEntityName>,
  ): PlanningInputEntityMap[TEntityName] {
    return this.mapper.fromPersistence(row);
  }
}

export const planningInputService = new PlanningInputService();
