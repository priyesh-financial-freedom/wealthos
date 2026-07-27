import { createDefaultProductRegistry } from "../products/defaultProducts";
import { assetRules } from "./assetRules";
import { eventRules } from "./eventRules";
import { expenseRules } from "./expenseRules";
import { epfRule } from "./investmentRules";
import { FinancialRuleRegistry } from "./registry";

export function createDefaultFinancialRuleRegistry(): FinancialRuleRegistry {
  const registry = new FinancialRuleRegistry();
  const productRegistry = createDefaultProductRegistry();

  registry.registerMany(productRegistry.getRules());
  registry.registerMany(expenseRules);
  registry.registerMany(eventRules);
  registry.register(epfRule);

  // Keep legacy asset rules for backward compatibility with direct imports.
  // The default product composition already emits the same IDs and behavior.
  if (!registry.list().some((rule) => rule.id === "asset.property-appreciation")) {
    registry.registerMany(assetRules);
  }

  return registry;
}