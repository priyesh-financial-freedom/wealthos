import { annualRateToMonthlyRate } from "../assumptions";
import type { FinancialRule } from "./contracts";

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export const propertyAppreciationRule: FinancialRule = {
  id: "asset.property-appreciation",
  family: "asset",
  step: "asset-appreciation",
  priority: 10,
  appliesTo: ({ context }) => {
    return context.assets.some((asset) => asset.category.toLowerCase().includes("property"));
  },
  execute: ({ context, state }) => {
    const propertyBase = context.assets
      .filter((asset) => asset.category.toLowerCase().includes("property"))
      .reduce((sum, asset) => sum + Math.max(0, toFiniteNumber(asset.currentValue)), 0);

    if (propertyBase <= 0) {
      return;
    }

    const monthlyRate = annualRateToMonthlyRate(context.assumptions.investmentGrowthAnnualRate);
    state.addAssetAppreciation(propertyBase * monthlyRate);
  },
};

export const assetRules: readonly FinancialRule[] = [
  propertyAppreciationRule,
];