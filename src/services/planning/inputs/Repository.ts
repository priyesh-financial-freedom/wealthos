import type {
  PlanningInputCreate,
  PlanningInputEntityMap,
  PlanningInputEntityName,
  PlanningInputPatch,
} from "./Types";

function nowIso() {
  return new Date().toISOString();
}

function effectiveAnchor(effectiveDate: string, futureEffectiveDate: string | null) {
  return futureEffectiveDate ?? effectiveDate;
}

export interface PlanningInputRepositoryContract {
  listVersions<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
  ): Promise<Array<PlanningInputEntityMap[TEntityName]>>;
  getVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
    version: number,
  ): Promise<PlanningInputEntityMap[TEntityName] | null>;
  getActive<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
    asOfDate?: string,
  ): Promise<PlanningInputEntityMap[TEntityName] | null>;
  upsertVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    payload: PlanningInputCreate<TEntityName>,
  ): Promise<PlanningInputEntityMap[TEntityName]>;
  patchVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    patch: PlanningInputPatch<TEntityName>,
  ): Promise<PlanningInputEntityMap[TEntityName] | null>;
  activateVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
    version: number,
  ): Promise<PlanningInputEntityMap[TEntityName] | null>;
}

type Store = {
  [EntityName in PlanningInputEntityName]: Array<PlanningInputEntityMap[EntityName]>;
};

function createEmptyStore(): Store {
  return {
    PersonalProfile: [],
    EmploymentProfile: [],
    IncomeProfile: [],
    ExpenseProfile: [],
    RetirementProfile: [],
    TaxProfile: [],
    InvestmentAssumptions: [],
    LoanAssumptions: [],
    InsuranceAssumptions: [],
    GoalPlanningAssumptions: [],
    InflationAssumptions: [],
  };
}

export class PlanningInputRepository implements PlanningInputRepositoryContract {
  private readonly store: Store;

  constructor(initialState?: Partial<Store>) {
    this.store = {
      ...createEmptyStore(),
      ...(initialState ?? {}),
    };
  }

  async listVersions<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
  ): Promise<Array<PlanningInputEntityMap[TEntityName]>> {
    return this.store[entityName]
      .filter((row) => row.id === id)
      .slice()
      .sort((left, right) => right.version - left.version) as Array<PlanningInputEntityMap[TEntityName]>;
  }

  async getVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
    version: number,
  ): Promise<PlanningInputEntityMap[TEntityName] | null> {
    const row = this.store[entityName].find((entry) => entry.id === id && entry.version === version) ?? null;
    return row as PlanningInputEntityMap[TEntityName] | null;
  }

  async getActive<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
    asOfDate?: string,
  ): Promise<PlanningInputEntityMap[TEntityName] | null> {
    const anchor = asOfDate ?? new Date().toISOString().slice(0, 10);
    const candidates = this.store[entityName]
      .filter((entry) => entry.id === id)
      .filter((entry) => entry.isActive)
      .filter((entry) => effectiveAnchor(entry.effectiveDate, entry.futureEffectiveDate) <= anchor)
      .sort((left, right) => right.version - left.version);

    return (candidates[0] ?? null) as PlanningInputEntityMap[TEntityName] | null;
  }

  async upsertVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    payload: PlanningInputCreate<TEntityName>,
  ): Promise<PlanningInputEntityMap[TEntityName]> {
    const createdAt = payload.createdAt ?? nowIso();
    const updatedAt = payload.updatedAt ?? createdAt;

    const next = {
      ...payload,
      createdAt,
      updatedAt,
    } as PlanningInputEntityMap[TEntityName];

    const bucket = this.store[entityName];
    const existingIndex = bucket.findIndex((entry) => entry.id === next.id && entry.version === next.version);

    if (next.isActive) {
      for (let index = 0; index < bucket.length; index += 1) {
        if (bucket[index]?.id === next.id) {
          bucket[index] = {
            ...bucket[index],
            isActive: false,
            updatedAt: nowIso(),
          };
        }
      }
    }

    if (existingIndex >= 0) {
      bucket[existingIndex] = next;
    } else {
      bucket.push(next);
    }

    return next;
  }

  async patchVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    patch: PlanningInputPatch<TEntityName>,
  ): Promise<PlanningInputEntityMap[TEntityName] | null> {
    const bucket = this.store[entityName];
    const index = bucket.findIndex((entry) => entry.id === patch.id && entry.version === patch.version);
    if (index < 0) {
      return null;
    }

    const next = {
      ...bucket[index],
      ...patch,
      updatedAt: nowIso(),
    } as PlanningInputEntityMap[TEntityName];

    bucket[index] = next;
    return next;
  }

  async activateVersion<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    id: string,
    version: number,
  ): Promise<PlanningInputEntityMap[TEntityName] | null> {
    const bucket = this.store[entityName];
    const targetIndex = bucket.findIndex((entry) => entry.id === id && entry.version === version);

    if (targetIndex < 0) {
      return null;
    }

    for (let index = 0; index < bucket.length; index += 1) {
      if (bucket[index]?.id !== id) {
        continue;
      }

      bucket[index] = {
        ...bucket[index],
        isActive: bucket[index]?.version === version,
        updatedAt: nowIso(),
      };
    }

    return bucket[targetIndex] as PlanningInputEntityMap[TEntityName];
  }
}

export const planningInputRepository: PlanningInputRepositoryContract = new PlanningInputRepository();
