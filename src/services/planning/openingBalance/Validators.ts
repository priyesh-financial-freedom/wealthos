import type { OpeningBalanceSnapshot } from "./OpeningBalanceSnapshot";

export interface OpeningBalanceValidationIssue {
  field: string;
  message: string;
}

function isValidDateToken(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function isNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

export class OpeningBalanceValidator {
  validate(snapshot: OpeningBalanceSnapshot): OpeningBalanceValidationIssue[] {
    const issues: OpeningBalanceValidationIssue[] = [];

    if (!snapshot.id.trim()) {
      issues.push({ field: "id", message: "id is required." });
    }

    if (!Number.isInteger(snapshot.version) || snapshot.version <= 0) {
      issues.push({ field: "version", message: "version must be a positive integer." });
    }

    if (!isValidDateToken(snapshot.effectiveDate)) {
      issues.push({ field: "effectiveDate", message: "effectiveDate must be a valid ISO date string." });
    }

    if (!isValidDateToken(snapshot.createdAt)) {
      issues.push({ field: "createdAt", message: "createdAt must be a valid ISO datetime string." });
    }

    if (!isValidDateToken(snapshot.updatedAt)) {
      issues.push({ field: "updatedAt", message: "updatedAt must be a valid ISO datetime string." });
    }

    if (snapshot.futureEffectiveDate !== null && !isValidDateToken(snapshot.futureEffectiveDate)) {
      issues.push({ field: "futureEffectiveDate", message: "futureEffectiveDate must be null or a valid ISO date string." });
    }

    if (snapshot.futureEffectiveDate !== null && snapshot.futureEffectiveDate < snapshot.effectiveDate) {
      issues.push({
        field: "futureEffectiveDate",
        message: "futureEffectiveDate cannot be earlier than effectiveDate.",
      });
    }

    const numericChecks: Array<[string, number]> = [
      ["openingAssets", snapshot.openingAssets],
      ["openingLiabilities", snapshot.openingLiabilities],
      ["cashPosition", snapshot.cashPosition],
      ["retirementCorpus", snapshot.retirementCorpus],
      ["investmentCorpus", snapshot.investmentCorpus],
      ["debtPosition", snapshot.debtPosition],
    ];

    for (const [field, value] of numericChecks) {
      if (!isNonNegative(value)) {
        issues.push({ field, message: `${field} must be a non-negative finite number.` });
      }
    }

    return issues;
  }
}

export const openingBalanceValidator = new OpeningBalanceValidator();
