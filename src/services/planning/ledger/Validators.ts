import type {
  MonthlyLedger,
  MonthlyLedgerRecord,
  MonthlyLedgerValidationIssue,
} from "./Types";

function isMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

const NUMERIC_FIELDS: Array<keyof Omit<MonthlyLedgerRecord, "month">> = [
  "openingCash",
  "openingAssets",
  "openingLiabilities",
  "openingNetWorth",
  "salary",
  "bonus",
  "consultingIncome",
  "rentalIncome",
  "dividendIncome",
  "interestIncome",
  "expenses",
  "inflation",
  "emi",
  "tax",
  "epfContribution",
  "ppfContribution",
  "npsContribution",
  "mutualFundSip",
  "stockInvestment",
  "fdInvestment",
  "goldInvestment",
  "investmentGrowth",
  "loanInterest",
  "loanPrincipal",
  "goalFunding",
  "retirementCorpus",
  "emergencyFund",
  "closingCash",
  "closingAssets",
  "closingLiabilities",
  "closingNetWorth",
];

export class LedgerValidator {
  validateRecord(record: MonthlyLedgerRecord): MonthlyLedgerValidationIssue[] {
    const issues: MonthlyLedgerValidationIssue[] = [];

    if (!isMonthKey(record.month)) {
      issues.push({ field: "month", message: "month must be in YYYY-MM format." });
    }

    for (const field of NUMERIC_FIELDS) {
      if (!isFiniteNumber(record[field])) {
        issues.push({ field, message: `${field} must be a finite number.` });
      }
    }

    return issues;
  }

  validateVersion(ledger: MonthlyLedger): MonthlyLedgerValidationIssue[] {
    const issues: MonthlyLedgerValidationIssue[] = [];

    if (!ledger.id.trim()) {
      issues.push({ field: "id", message: "id is required." });
    }

    if (!Number.isInteger(ledger.version) || ledger.version <= 0) {
      issues.push({ field: "version", message: "version must be a positive integer." });
    }

    if (!isIsoDate(ledger.effectiveDate)) {
      issues.push({ field: "effectiveDate", message: "effectiveDate must be a valid ISO date." });
    }

    if (!isIsoDate(ledger.createdAt)) {
      issues.push({ field: "createdAt", message: "createdAt must be a valid ISO date-time." });
    }

    if (!isIsoDate(ledger.updatedAt)) {
      issues.push({ field: "updatedAt", message: "updatedAt must be a valid ISO date-time." });
    }

    if (ledger.futureEffectiveDate !== null && !isIsoDate(ledger.futureEffectiveDate)) {
      issues.push({ field: "futureEffectiveDate", message: "futureEffectiveDate must be null or a valid ISO date." });
    }

    for (let index = 0; index < ledger.records.length; index += 1) {
      const recordIssues = this.validateRecord(ledger.records[index] as MonthlyLedgerRecord);
      for (const issue of recordIssues) {
        issues.push({ field: `records[${index}].${issue.field}`, message: issue.message });
      }
    }

    return issues;
  }
}

export const ledgerValidator = new LedgerValidator();
