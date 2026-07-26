import type { OpeningBalanceSnapshot } from "./OpeningBalanceSnapshot";

export interface OpeningBalanceSnapshotRow {
  snapshot_id: string;
  version: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  future_effective_date: string | null;
  payload: Omit<OpeningBalanceSnapshot, "id" | "version" | "effectiveDate" | "createdAt" | "updatedAt" | "isActive" | "futureEffectiveDate">;
}

export class OpeningBalanceMapper {
  toRow(snapshot: OpeningBalanceSnapshot): OpeningBalanceSnapshotRow {
    const {
      id,
      version,
      effectiveDate,
      createdAt,
      updatedAt,
      isActive,
      futureEffectiveDate,
      ...payload
    } = snapshot;

    return {
      snapshot_id: id,
      version,
      effective_date: effectiveDate,
      created_at: createdAt,
      updated_at: updatedAt,
      is_active: isActive,
      future_effective_date: futureEffectiveDate,
      payload,
    };
  }

  fromRow(row: OpeningBalanceSnapshotRow): OpeningBalanceSnapshot {
    return {
      ...row.payload,
      id: row.snapshot_id,
      version: row.version,
      effectiveDate: row.effective_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
      futureEffectiveDate: row.future_effective_date,
    };
  }
}

export const openingBalanceMapper = new OpeningBalanceMapper();
