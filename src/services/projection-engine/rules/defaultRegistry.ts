import { assetRules } from "./assetRules";
import { eventRules } from "./eventRules";
import { expenseRules } from "./expenseRules";
import { incomeRules } from "./incomeRules";
import { investmentRules } from "./investmentRules";
import { loanRules } from "./loanRules";
import { FinancialRuleRegistry } from "./registry";

export function createDefaultFinancialRuleRegistry(): FinancialRuleRegistry {
  const registry = new FinancialRuleRegistry();
  registry.registerMany(incomeRules);
  registry.registerMany(expenseRules);
  registry.registerMany(eventRules);
  registry.registerMany(investmentRules);
  registry.registerMany(loanRules);
  registry.registerMany(assetRules);
  return registry;
}