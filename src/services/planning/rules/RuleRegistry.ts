import { deepFreeze } from "../shared";

import { ruleValidator } from "./RuleValidator";
import type { RuleDefinition } from "./Types";

export class RuleRegistry {
  private readonly rules: readonly RuleDefinition[];

  private readonly byId: ReadonlyMap<string, RuleDefinition>;

  constructor(rules: readonly RuleDefinition[]) {
    const frozenRules = rules.map((rule) => deepFreeze({
      ...rule,
      dependencies: [...rule.dependencies],
    }));

    const issues = ruleValidator.validateCatalog(frozenRules);
    if (issues.length > 0) {
      throw new Error(`Invalid rule registry: ${issues.map((issue) => `${issue.field}: ${issue.message}`).join("; ")}`);
    }

    this.rules = frozenRules.slice().sort((left, right) => (left.priority - right.priority) || left.ruleId.localeCompare(right.ruleId));
    this.byId = new Map(this.rules.map((rule) => [rule.ruleId, rule] as const));
  }

  list(): RuleDefinition[] {
    return this.rules.map((rule) => ({ ...rule, dependencies: [...rule.dependencies] }));
  }

  get(ruleId: string): RuleDefinition {
    const rule = this.byId.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    return { ...rule, dependencies: [...rule.dependencies] };
  }

  has(ruleId: string): boolean {
    return this.byId.has(ruleId);
  }

  validate(): ReturnType<typeof ruleValidator.validateCatalog> {
    return ruleValidator.validateCatalog(this.rules);
  }
}
