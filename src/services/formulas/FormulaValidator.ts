import type { FormulaMetadata } from "./FormulaMetadata";

export interface FormulaValidationIssue {
  field: string;
  message: string;
}

function isValidIsoDate(value: string): boolean {
  if (!value || Number.isNaN(Date.parse(value))) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export class FormulaValidator {
  validateFormula(metadata: FormulaMetadata): FormulaValidationIssue[] {
    const issues: FormulaValidationIssue[] = [];

    if (!isNonEmptyString(metadata.formulaId)) {
      issues.push({ field: "formulaId", message: "formulaId is required." });
    }

    if (!isNonEmptyString(metadata.module)) {
      issues.push({ field: "module", message: "module is required." });
    }

    if (!isNonEmptyString(metadata.description)) {
      issues.push({ field: "description", message: "description is required." });
    }

    if (!isNonEmptyString(metadata.excelEquivalent) || !metadata.excelEquivalent.trim().startsWith("=")) {
      issues.push({ field: "excelEquivalent", message: "excelEquivalent must be an Excel formula string." });
    }

    if (!isNonEmptyString(metadata.formulaExpression)) {
      issues.push({ field: "formulaExpression", message: "formulaExpression is required." });
    }

    if (!isNonEmptyString(metadata.version)) {
      issues.push({ field: "version", message: "version is required." });
    }

    if (!isValidIsoDate(metadata.effectiveDate)) {
      issues.push({ field: "effectiveDate", message: "effectiveDate must be an ISO date string." });
    }

    if (!isNonEmptyString(metadata.owner)) {
      issues.push({ field: "owner", message: "owner is required." });
    }

    if (!isNonEmptyString(metadata.exampleInput)) {
      issues.push({ field: "exampleInput", message: "exampleInput is required." });
    }

    if (!isNonEmptyString(metadata.exampleOutput)) {
      issues.push({ field: "exampleOutput", message: "exampleOutput is required." });
    }

    if (metadata.validationStatus !== "Validated" && metadata.validationStatus !== "Draft" && metadata.validationStatus !== "Deprecated") {
      issues.push({ field: "validationStatus", message: "validationStatus must be Validated, Draft, or Deprecated." });
    }

    return issues;
  }

  validateCatalog(formulas: readonly FormulaMetadata[]): FormulaValidationIssue[] {
    const issues: FormulaValidationIssue[] = [];
    const seen = new Set<string>();

    for (const formula of formulas) {
      for (const issue of this.validateFormula(formula)) {
        issues.push({ field: `${formula.formulaId}.${issue.field}`, message: issue.message });
      }

      if (seen.has(formula.formulaId)) {
        issues.push({ field: "formulaId", message: `Duplicate formulaId detected: ${formula.formulaId}` });
      }

      seen.add(formula.formulaId);
    }

    return issues;
  }

  validateReference(reference: { formulaId: string; module: string; version: string; effectiveDate: string }, catalog: readonly FormulaMetadata[]): FormulaValidationIssue[] {
    const issues: FormulaValidationIssue[] = [];
    const formula = catalog.find((item) => item.formulaId === reference.formulaId);

    if (!formula) {
      issues.push({ field: "formulaId", message: `Formula not found: ${reference.formulaId}` });
      return issues;
    }

    if (formula.module !== reference.module) {
      issues.push({ field: "module", message: `Module mismatch for formula ${reference.formulaId}.` });
    }

    if (formula.version !== reference.version) {
      issues.push({ field: "version", message: `Version mismatch for formula ${reference.formulaId}.` });
    }

    if (formula.effectiveDate !== reference.effectiveDate) {
      issues.push({ field: "effectiveDate", message: `Effective date mismatch for formula ${reference.formulaId}.` });
    }

    return issues;
  }
}

export const formulaValidator = new FormulaValidator();
