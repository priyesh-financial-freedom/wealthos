import type {
  MonthlyLedger,
  MonthlyLedgerPatchVersionInput,
  MonthlyLedgerRecord,
} from "./Types";

function nowIso(): string {
  return new Date().toISOString();
}

function effectiveAnchor(ledger: MonthlyLedger): string {
  return ledger.futureEffectiveDate ?? ledger.effectiveDate;
}

function cloneRecord(record: MonthlyLedgerRecord): MonthlyLedgerRecord {
  return { ...record };
}

function cloneLedger(ledger: MonthlyLedger): MonthlyLedger {
  return {
    ...ledger,
    records: ledger.records.map(cloneRecord),
  };
}

export interface MonthlyLedgerRepository {
  listVersions(ledgerId: string): Promise<MonthlyLedger[]>;
  getVersion(ledgerId: string, version: number): Promise<MonthlyLedger | null>;
  getActive(ledgerId: string, asOfDate?: string): Promise<MonthlyLedger | null>;
  save(ledger: MonthlyLedger): Promise<MonthlyLedger>;
  patch(input: MonthlyLedgerPatchVersionInput): Promise<MonthlyLedger | null>;
  activateVersion(ledgerId: string, version: number): Promise<MonthlyLedger | null>;
}

export class InMemoryMonthlyLedgerRepository implements MonthlyLedgerRepository {
  private readonly ledgers: MonthlyLedger[] = [];

  async listVersions(ledgerId: string): Promise<MonthlyLedger[]> {
    return this.ledgers
      .filter((ledger) => ledger.id === ledgerId)
      .sort((left, right) => right.version - left.version)
      .map(cloneLedger);
  }

  async getVersion(ledgerId: string, version: number): Promise<MonthlyLedger | null> {
    const found = this.ledgers.find((ledger) => ledger.id === ledgerId && ledger.version === version);
    return found ? cloneLedger(found) : null;
  }

  async getActive(ledgerId: string, asOfDate?: string): Promise<MonthlyLedger | null> {
    const anchor = asOfDate ?? new Date().toISOString().slice(0, 10);
    const match = this.ledgers
      .filter((ledger) => ledger.id === ledgerId)
      .filter((ledger) => ledger.isActive)
      .filter((ledger) => effectiveAnchor(ledger) <= anchor)
      .sort((left, right) => right.version - left.version)[0];

    return match ? cloneLedger(match) : null;
  }

  async save(ledger: MonthlyLedger): Promise<MonthlyLedger> {
    const copy = cloneLedger(ledger);
    const index = this.ledgers.findIndex((item) => item.id === copy.id && item.version === copy.version);

    if (copy.isActive) {
      for (let position = 0; position < this.ledgers.length; position += 1) {
        if (this.ledgers[position]?.id !== copy.id) {
          continue;
        }

        this.ledgers[position] = {
          ...this.ledgers[position],
          isActive: false,
          updatedAt: nowIso(),
        };
      }
    }

    if (index >= 0) {
      this.ledgers[index] = copy;
    } else {
      this.ledgers.push(copy);
    }

    return cloneLedger(copy);
  }

  async patch(input: MonthlyLedgerPatchVersionInput): Promise<MonthlyLedger | null> {
    const index = this.ledgers.findIndex((ledger) => ledger.id === input.id && ledger.version === input.version);
    if (index < 0) {
      return null;
    }

    if (input.isActive === true) {
      for (let position = 0; position < this.ledgers.length; position += 1) {
        if (this.ledgers[position]?.id !== input.id) {
          continue;
        }

        this.ledgers[position] = {
          ...this.ledgers[position],
          isActive: false,
          updatedAt: nowIso(),
        };
      }
    }

    const current = this.ledgers[index] as MonthlyLedger;
    const next: MonthlyLedger = {
      ...current,
      isActive: input.isActive ?? current.isActive,
      futureEffectiveDate: input.futureEffectiveDate === undefined ? current.futureEffectiveDate : input.futureEffectiveDate,
      projectionContextId: input.projectionContextId === undefined ? current.projectionContextId : input.projectionContextId,
      scenarioId: input.scenarioId === undefined ? current.scenarioId : input.scenarioId,
      records: input.records ? input.records.map(cloneRecord) : current.records.map(cloneRecord),
      updatedAt: nowIso(),
    };

    this.ledgers[index] = next;
    return cloneLedger(next);
  }

  async activateVersion(ledgerId: string, version: number): Promise<MonthlyLedger | null> {
    const index = this.ledgers.findIndex((ledger) => ledger.id === ledgerId && ledger.version === version);
    if (index < 0) {
      return null;
    }

    for (let position = 0; position < this.ledgers.length; position += 1) {
      if (this.ledgers[position]?.id !== ledgerId) {
        continue;
      }

      this.ledgers[position] = {
        ...this.ledgers[position],
        isActive: this.ledgers[position]?.version === version,
        updatedAt: nowIso(),
      };
    }

    return cloneLedger(this.ledgers[index] as MonthlyLedger);
  }
}

export const monthlyLedgerRepository: MonthlyLedgerRepository = new InMemoryMonthlyLedgerRepository();
