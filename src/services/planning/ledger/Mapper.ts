import { LedgerExporter, ledgerExporter } from "./LedgerExporter";
import type {
  MonthlyLedger,
  MonthlyLedgerPersistenceRow,
} from "./Types";

export class LedgerMapper {
  constructor(private readonly exporter: LedgerExporter = ledgerExporter) {}

  toPersistence(ledger: MonthlyLedger): MonthlyLedgerPersistenceRow {
    return this.exporter.toPersistenceRow(ledger);
  }

  fromPersistence(row: MonthlyLedgerPersistenceRow): MonthlyLedger {
    return this.exporter.fromPersistenceRow(row);
  }
}

export const ledgerMapper = new LedgerMapper();
