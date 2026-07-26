import { formulaRegistry, type FormulaValidationIssue } from "@/services/formulas";

import type { RuleDefinition } from "./Types";

export interface RuleValidationIssue {
  field: string;
  message: string;
}

function isValidIsoDate(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function detectCycles(rules: readonly RuleDefinition[]): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  const map = new Map(rules.map((rule) => [rule.ruleId, rule] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(ruleId: string, path: string[]): void {
    if (visited.has(ruleId)) {
      return;
    }

    if (visiting.has(ruleId)) {
      issues.push({ field: ruleId, message: `Cyclic rule dependency detected: ${[...path, ruleId].join(" -> ")}` });
      return;
    }

    const rule = map.get(ruleId);
    if (!rule) {
      return;
    }

    visiting.add(ruleId);
    for (const dependency of rule.dependencies) {
      visit(dependency, [...path, ruleId]);
    }
    visiting.delete(ruleId);
    visited.add(ruleId);
  }

  for (const rule of rules) {
    visit(rule.ruleId, []);
  }

  return issues;
}

export class RuleValidator {
  validateRule(rule: RuleDefinition): RuleValidationIssue[] {
    const issues: RuleValidationIssue[] = [];

    if (!isNonEmptyString(rule.ruleId)) {
      issues.push({ field: "ruleId", message: "ruleId is required." });
    }

    if (!isNonEmptyString(rule.ruleName)) {
      issues.push({ field: "ruleName", message: "ruleName is required." });
    }

    if (!isNonEmptyString(rule.description)) {
      issues.push({ field: "description", message: "description is required." });
    }

    if (!isNonEmptyString(rule.category)) {
      issues.push({ field: "category", message: "category is required." });
    }

    if (!Number.isFinite(rule.priority) || rule.priority < 0) {
      issues.push({ field: "priority", message: "priority must be a non-negative finite number." });
    }

    if (!isValidIsoDate(rule.effectiveDate)) {
      issues.push({ field: "effectiveDate", message: "effectiveDate must be a valid ISO date string." });
    }

    if (rule.expiryDate !== null && !isValidIsoDate(rule.expiryDate)) {
      issues.push({ field: "expiryDate", message: "expiryDate must be null or a valid ISO date string." });
    }

    if (rule.expiryDate && rule.effectiveDate && Date.parse(rule.expiryDate) < Date.parse(rule.effectiveDate)) {
      issues.push({ field: "expiryDate", message: "expiryDate cannot be earlier than effectiveDate." });
    }

    if (!isNonEmptyString(rule.version)) {
      issues.push({ field: "version", message: "version is required." });
    }

    const formulaIssues: FormulaValidationIssue[] = formulaRegistry.validateReference(rule.formulaReference);
    for (const formulaIssue of formulaIssues) {
      issues.push({ field: `formulaReference.${formulaIssue.field}`, message: formulaIssue.message });
    }

    if (!Array.isArray(rule.dependencies)) {
      issues.push({ field: "dependencies", message: "dependencies must be an array of rule ids." });
    }

    if (!isNonEmptyString(rule.evaluationFunctionName)) {
      issues.push({ field: "evaluationFunctionName", message: "evaluationFunctionName is required." });
    }

    if (typeof rule.enabled !== "boolean") {
      issues.push({ field: "enabled", message: "enabled must be a boolean." });
    }

    return issues;
  }

  validateCatalog(rules: readonly RuleDefinition[]): RuleValidationIssue[] {
    const issues: RuleValidationIssue[] = [];
    const ids = new Set<string>();

    for (const rule of rules) {
      for (const issue of this.validateRule(rule)) {
        issues.push({ field: `${rule.ruleId}.${issue.field}`, message: issue.message });
      }

      if (ids.has(rule.ruleId)) {
        issues.push({ field: "ruleId", message: `Duplicate ruleId detected: ${rule.ruleId}` });
      }
      ids.add(rule.ruleId);
    }

    for (const rule of rules) {
      for (const dependency of rule.dependencies) {
        if (!ids.has(dependency)) {
          issues.push({ field: `${rule.ruleId}.dependencies`, message: `Missing dependency rule: ${dependency}` });
        }
      }
    }

    issues.push(...detectCycles(rules));
    return issues;
  }
}

export const ruleValidator = new RuleValidator();
