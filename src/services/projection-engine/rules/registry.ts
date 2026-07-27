import {
  FINANCIAL_RULE_STEP_ORDER,
  type FinancialRule,
  type FinancialRuleExecutionInput,
} from "./contracts";

function stepOrderIndex(step: FinancialRule["step"]): number {
  const index = FINANCIAL_RULE_STEP_ORDER.indexOf(step);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function deterministicRuleSort(left: FinancialRule, right: FinancialRule): number {
  const byStep = stepOrderIndex(left.step) - stepOrderIndex(right.step);
  if (byStep !== 0) {
    return byStep;
  }

  const byPriority = left.priority - right.priority;
  if (byPriority !== 0) {
    return byPriority;
  }

  return left.id.localeCompare(right.id);
}

export class FinancialRuleRegistry {
  private readonly rules = new Map<string, FinancialRule>();

  register(rule: FinancialRule): void {
    this.rules.set(rule.id, rule);
  }

  registerMany(rules: readonly FinancialRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  list(): FinancialRule[] {
    return Array.from(this.rules.values()).sort(deterministicRuleSort);
  }

  discoverActiveRules(input: FinancialRuleExecutionInput): FinancialRule[] {
    return this.list().filter((rule) => rule.appliesTo(input));
  }

  execute(input: FinancialRuleExecutionInput): FinancialRule[] {
    const activeRules = this.discoverActiveRules(input);
    for (const rule of activeRules) {
      rule.execute(input);
    }

    return activeRules;
  }
}