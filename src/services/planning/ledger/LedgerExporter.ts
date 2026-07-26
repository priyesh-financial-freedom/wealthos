import type {
  MonthlyLedger,
  MonthlyLedgerPersistenceRow,
  MonthlyLedgerRecord,
} from "./Types";

function cloneRecord(record: MonthlyLedgerRecord): MonthlyLedgerRecord {
  return { ...record };
}

export class LedgerExporter {
  toPersistenceRow(ledger: MonthlyLedger): MonthlyLedgerPersistenceRow {
    return {
      ledger_id: ledger.id,
      version: ledger.version,
      effective_date: ledger.effectiveDate,
      created_at: ledger.createdAt,
      updated_at: ledger.updatedAt,
      is_active: ledger.isActive,
      future_effective_date: ledger.futureEffectiveDate,
      projection_context_id: ledger.projectionContextId,
      scenario_id: ledger.scenarioId,
      records: ledger.records.map(cloneRecord),
    };
  }

  fromPersistenceRow(row: MonthlyLedgerPersistenceRow): MonthlyLedger {
    return {
      id: row.ledger_id,
      version: row.version,
      effectiveDate: row.effective_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
      futureEffectiveDate: row.future_effective_date,
      projectionContextId: row.projection_context_id,
      scenarioId: row.scenario_id,
      records: row.records.map(cloneRecord),
    };
  }

  serialize(ledger: MonthlyLedger): string {
    return JSON.stringify(this.toPersistenceRow(ledger));
  }

  deserialize(payload: string): MonthlyLedger {
    const parsed = JSON.parse(payload) as MonthlyLedgerPersistenceRow;
    return this.fromPersistenceRow(parsed);
  }

  exportRecords(ledger: MonthlyLedger): MonthlyLedgerRecord[] {
    return ledger.records.map(cloneRecord);
  }
}

export const ledgerExporter = new LedgerExporter();
