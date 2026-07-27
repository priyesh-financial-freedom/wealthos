import { annualRateToMonthlyRate } from "../assumptions";
import type { FinancialRule } from "../rules/contracts";
import type { AssetPosition, ProjectionContext } from "../types";
import type { FinancialProduct, ProductValidationIssue, ProductValidationResult } from "./contracts";
import { clampNonNegative, toFiniteNumber } from "./helpers";

export interface PropertyAssetDefinition {
  id: string;
  currentValue: number;
  category?: string;
}

export interface PropertyProductData {
  useContextAssets?: boolean;
  assets?: readonly PropertyAssetDefinition[];
  annualAppreciationRate?: number;
}

function isPropertyAsset(asset: { category: string }): boolean {
  return asset.category.toLowerCase().includes("property");
}

function contextPropertyAssets(context: ProjectionContext): AssetPosition[] {
  return context.assets.filter((asset) => isPropertyAsset(asset));
}

export class PropertyProduct implements FinancialProduct<PropertyProductData> {
  readonly id: string;

  readonly type = "property";

  constructor(readonly data: PropertyProductData = {}, id = "product.property") {
    this.id = id;
  }

  validate(): ProductValidationResult {
    const issues: ProductValidationIssue[] = [];

    for (const [index, asset] of (this.data.assets ?? []).entries()) {
      if (toFiniteNumber(asset.currentValue) < 0) {
        issues.push({ field: `assets[${index}].currentValue`, message: "Property value must be non-negative." });
      }
    }

    if (this.data.annualAppreciationRate !== undefined && !Number.isFinite(Number(this.data.annualAppreciationRate))) {
      issues.push({ field: "annualAppreciationRate", message: "Annual appreciation rate must be a finite number." });
    }

    return { valid: issues.length === 0, issues };
  }

  getRules(): readonly FinancialRule[] {
    const resolveAssets = (context: ProjectionContext): ReadonlyArray<AssetPosition | PropertyAssetDefinition> => {
      const configured = this.data.assets ?? [];
      if (this.data.useContextAssets === false) {
        return configured;
      }

      return [...contextPropertyAssets(context), ...configured];
    };

    const resolveRate = (context: ProjectionContext): number => {
      if (this.data.annualAppreciationRate !== undefined) {
        return toFiniteNumber(this.data.annualAppreciationRate);
      }

      return toFiniteNumber(context.assumptions.investmentGrowthAnnualRate);
    };

    const rule: FinancialRule = {
      id: "asset.property-appreciation",
      family: "asset",
      step: "asset-appreciation",
      priority: 10,
      appliesTo: ({ context }) => resolveAssets(context).length > 0,
      execute: ({ context, state }) => {
        const propertyBase = resolveAssets(context).reduce((sum, asset) => {
          return sum + clampNonNegative(asset.currentValue);
        }, 0);

        if (propertyBase <= 0) {
          return;
        }

        const monthlyRate = annualRateToMonthlyRate(resolveRate(context));
        state.addAssetAppreciation(propertyBase * monthlyRate);
      },
    };

    return [rule];
  }
}
