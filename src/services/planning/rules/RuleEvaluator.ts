import { createRuleResult } from "./RuleResult";
import type { RuleContext, RuleEvaluatorLike, RuleResult } from "./Types";
import { RuleRegistry } from "./RuleRegistry";

function isMonthWithinRange(context: RuleContext, effectiveDate: string, expiryDate: string | null): boolean {
  const monthKey = context.projectionMonth.monthKey;
  if (monthKey < effectiveDate.slice(0, 7)) {
    return false;
  }

  if (expiryDate && monthKey > expiryDate.slice(0, 7)) {
    return false;
  }

  return true;
}

export class RuleEvaluator implements RuleEvaluatorLike {
  constructor(private readonly registry: RuleRegistry) {}

  evaluateRule(ruleId: string, context: RuleContext, trail: Set<string> = new Set<string>()): RuleResult {
    if (trail.has(ruleId)) {
      throw new Error(`Cyclic rule evaluation detected for ${ruleId}`);
    }

    trail.add(ruleId);
    try {
      const rule = this.registry.get(ruleId);

      if (!rule.enabled) {
        return createRuleResult({
          ruleId: rule.ruleId,
          applied: false,
          reason: "Rule is disabled.",
          formulaReference: rule.formulaReference,
          effectiveVersion: rule.version,
          projectionMonth: context.projectionMonth.monthKey,
          traceMetadata: {
            sourceModule: "RuleEngine",
            evaluationFunctionName: rule.evaluationFunctionName,
            evaluationStrategy: "leaf",
            operator: null,
            childRuleIds: [],
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!isMonthWithinRange(context, rule.effectiveDate, rule.expiryDate)) {
        return createRuleResult({
          ruleId: rule.ruleId,
          applied: false,
          reason: "Projection month is outside the rule effective window.",
          formulaReference: rule.formulaReference,
          effectiveVersion: rule.version,
          projectionMonth: context.projectionMonth.monthKey,
          traceMetadata: {
            sourceModule: "RuleEngine",
            evaluationFunctionName: rule.evaluationFunctionName,
            evaluationStrategy: "leaf",
            operator: null,
            childRuleIds: [...rule.dependencies],
            timestamp: new Date().toISOString(),
          },
        });
      }

      return rule.evaluate(context, this, trail);
    } finally {
      trail.delete(ruleId);
    }
  }

  evaluateRules(ruleIds: readonly string[], context: RuleContext): RuleResult[] {
    return ruleIds.map((ruleId) => this.evaluateRule(ruleId, context));
  }
}
