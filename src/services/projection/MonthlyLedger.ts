import type { MonthlyLedger, MonthlyLedgerRecord } from "@/types/projection";

export function freezeMonthlyLedgerRecord(record: MonthlyLedgerRecord): Readonly<MonthlyLedgerRecord> {
  return Object.freeze({ ...record });
}

export function appendMonthlyLedgerRecord(
  ledger: MonthlyLedger,
  record: MonthlyLedgerRecord,
): MonthlyLedger {
  return [...ledger, freezeMonthlyLedgerRecord(record)];
}