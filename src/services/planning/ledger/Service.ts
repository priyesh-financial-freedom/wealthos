import { createFinancialPlanningServiceContract } from "../shared";
import { projectionContextFactory, type ProjectionContext } from "../projectionContext";

import { LEDGER_MODULE_KEY } from "./Types";
import type {
  LedgerPlanningService,
  MonthlyLedger,
  MonthlyLedgerBuildInput,
  MonthlyLedgerCreateVersionInput,
  MonthlyLedgerPatchVersionInput,
  MonthlyLedgerValidationIssue,
} from "./Types";
import {
  InMemoryMonthlyLedgerRepository,
  type MonthlyLedgerRepository,
} from "./Repository";
import { LedgerBuilder } from "./LedgerBuilder";
import { LedgerValidator } from "./Validators";
import { LedgerExporter } from "./LedgerExporter";

export function createLedgerPlanningService(context: ProjectionContext): LedgerPlanningService {
  return createFinancialPlanningServiceContract(LEDGER_MODULE_KEY, context);
}

export const ledgerPlanningService = createLedgerPlanningService(projectionContextFactory.createEmpty());

export class MonthlyLedgerService {
  constructor(
    private readonly repository: MonthlyLedgerRepository = new InMemoryMonthlyLedgerRepository(),
    private readonly builder: LedgerBuilder = new LedgerBuilder(),
    private readonly validator: LedgerValidator = new LedgerValidator(),
    private readonly exporter: LedgerExporter = new LedgerExporter(),
  ) {}

  async createVersion(
    input: MonthlyLedgerCreateVersionInput,
  ): Promise<{ ledger: MonthlyLedger | null; issues: MonthlyLedgerValidationIssue[] }> {
    const ledger = this.builder.buildVersion(input);
    const issues = this.validator.validateVersion(ledger);

    if (issues.length > 0) {
      return { ledger: null, issues };
    }

    const saved = await this.repository.save(ledger);
    return { ledger: saved, issues: [] };
  }

  async appendRecord(
    ledgerId: string,
    version: number,
    input: MonthlyLedgerBuildInput,
  ): Promise<{ ledger: MonthlyLedger | null; issues: MonthlyLedgerValidationIssue[] }> {
    const current = await this.repository.getVersion(ledgerId, version);
    if (!current) {
      return {
        ledger: null,
        issues: [{ field: "id", message: "Ledger version not found." }],
      };
    }

    const record = this.builder.buildRecord(input);
    const recordIssues = this.validator.validateRecord(record);
    if (recordIssues.length > 0) {
      return { ledger: null, issues: recordIssues };
    }

    const next: MonthlyLedger = {
      ...current,
      records: [...current.records.map((item) => ({ ...item })), record],
      updatedAt: new Date().toISOString(),
    };

    const issues = this.validator.validateVersion(next);
    if (issues.length > 0) {
      return { ledger: null, issues };
    }

    const saved = await this.repository.save(next);
    return { ledger: saved, issues: [] };
  }

  async patchVersion(
    input: MonthlyLedgerPatchVersionInput,
  ): Promise<{ ledger: MonthlyLedger | null; issues: MonthlyLedgerValidationIssue[] }> {
    const patched = await this.repository.patch(input);
    if (!patched) {
      return {
        ledger: null,
        issues: [{ field: "id", message: "Ledger version not found." }],
      };
    }

    const issues = this.validator.validateVersion(patched);
    if (issues.length > 0) {
      return { ledger: null, issues };
    }

    return { ledger: patched, issues: [] };
  }

  listVersions(ledgerId: string): Promise<MonthlyLedger[]> {
    return this.repository.listVersions(ledgerId);
  }

  getVersion(ledgerId: string, version: number): Promise<MonthlyLedger | null> {
    return this.repository.getVersion(ledgerId, version);
  }

  getActive(ledgerId: string, asOfDate?: string): Promise<MonthlyLedger | null> {
    return this.repository.getActive(ledgerId, asOfDate);
  }

  activateVersion(ledgerId: string, version: number): Promise<MonthlyLedger | null> {
    return this.repository.activateVersion(ledgerId, version);
  }

  serialize(ledger: MonthlyLedger): string {
    return this.exporter.serialize(ledger);
  }

  deserialize(payload: string): MonthlyLedger {
    return this.exporter.deserialize(payload);
  }
}

export const monthlyLedgerService = new MonthlyLedgerService();
