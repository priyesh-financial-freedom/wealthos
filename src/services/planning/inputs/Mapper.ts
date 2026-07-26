import type {
  PlanningInputEntityMap,
  PlanningInputEntityName,
} from "./Types";

export interface PlanningInputPersistenceRow<TEntityName extends PlanningInputEntityName> {
  entity_name: TEntityName;
  entity_id: string;
  effective_date: string;
  version: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  future_effective_date: string | null;
  payload: Omit<PlanningInputEntityMap[TEntityName], "id" | "effectiveDate" | "version" | "createdAt" | "updatedAt" | "isActive" | "futureEffectiveDate">;
}

export class PlanningInputMapper {
  toPersistence<TEntityName extends PlanningInputEntityName>(
    entityName: TEntityName,
    entity: PlanningInputEntityMap[TEntityName],
  ): PlanningInputPersistenceRow<TEntityName> {
    const {
      id,
      effectiveDate,
      version,
      createdAt,
      updatedAt,
      isActive,
      futureEffectiveDate,
      ...payload
    } = entity;

    return {
      entity_name: entityName,
      entity_id: id,
      effective_date: effectiveDate,
      version,
      created_at: createdAt,
      updated_at: updatedAt,
      is_active: isActive,
      future_effective_date: futureEffectiveDate,
      payload: payload as PlanningInputPersistenceRow<TEntityName>["payload"],
    };
  }

  fromPersistence<TEntityName extends PlanningInputEntityName>(
    row: PlanningInputPersistenceRow<TEntityName>,
  ): PlanningInputEntityMap[TEntityName] {
    return {
      ...row.payload,
      id: row.entity_id,
      effectiveDate: row.effective_date,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
      futureEffectiveDate: row.future_effective_date,
    } as PlanningInputEntityMap[TEntityName];
  }
}

export const planningInputMapper = new PlanningInputMapper();
