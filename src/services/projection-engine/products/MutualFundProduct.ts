import { annualRateToMonthlyRate } from "../assumptions";
import type { FinancialRule } from "../rules/contracts";
import type { ContributionRule, ProjectionContext } from "../types";
import type { FinancialProduct, ProductValidationIssue, ProductValidationResult } from "./contracts";
import { contributionAmount, toFiniteNumber } from "./helpers";

export interface MutualFundSIPDefinition {
  id: string;
  amount?: number;
  percentage?: number;
  enabled?: boolean;
}

export interface MutualFundProductData {
  useContextSIPRules?: boolean;
  sipRules?: readonly MutualFundSIPDefinition[];
  annualGrowthRate?: number;
  includeInvestmentGrowthRule?: boolean;
}

function contextSIPRules(context: ProjectionContext): ContributionRule[] {
  return context.contributionRules.filter((rule) => rule.type === "sip");
}

export class MutualFundProduct implements FinancialProduct<MutualFundProductData> {
  readonly id: string;

  readonly type = "mutual-fund";

  constructor(readonly data: MutualFundProductData = {}, id = "product.mutual-fund") {
    this.id = id;
  }

  validate(): ProductValidationResult {
    const issues: ProductValidationIssue[] = [];

    for (const [index, rule] of (this.data.sipRules ?? []).entries()) {
      if (rule.amount !== undefined && toFiniteNumber(rule.amount) < 0) {
        issues.push({ field: `sipRules[${index}].amount`, message: "SIP amount must be non-negative." });
      }

      if (rule.percentage !== undefined && toFiniteNumber(rule.percentage) < 0) {
        issues.push({ field: `sipRules[${index}].percentage`, message: "SIP percentage must be non-negative." });
      }
    }

    if (this.data.annualGrowthRate !== undefined && !Number.isFinite(Number(this.data.annualGrowthRate))) {
      issues.push({ field: "annualGrowthRate", message: "Annual growth rate must be a finite number." });
    }

    return { valid: issues.length === 0, issues };
  }

  getRules(): readonly FinancialRule[] {
    const resolveSipRules = (context: ProjectionContext): ReadonlyArray<ContributionRule | MutualFundSIPDefinition> => {
      const configured = this.data.sipRules ?? [];
      if (this.data.useContextSIPRules === false) {
        return configured;
      }

      return [...contextSIPRules(context), ...configured];
    };

    const resolveGrowthRate = (context: ProjectionContext): number => {
      if (this.data.annualGrowthRate !== undefined) {
        return toFiniteNumber(this.data.annualGrowthRate);
      }

      return toFiniteNumber(context.assumptions.investmentGrowthAnnualRate);
    };

    const sipRule: FinancialRule = {
      id: "investment.sip",
      family: "investment",
      step: "investment-contributions",
      priority: 10,
      appliesTo: ({ context }) => resolveSipRules(context).some((candidate) => candidate.enabled !== false),
      execute: ({ context, state }) => {
        const income = toFiniteNumber(context.assumptions.incomeMonthly);
        for (const candidate of resolveSipRules(context)) {
          if (candidate.enabled === false) {
            continue;
          }

          const amount = contributionAmount(candidate, income);
          if (amount > 0) {
            state.addContribution(amount);
          }
        }
      },
    };

    const growthRule: FinancialRule = {
      id: "investment.growth",
      family: "investment",
      step: "investment-growth",
      priority: 10,
      appliesTo: () => this.data.includeInvestmentGrowthRule !== false,
      execute: ({ context, state }) => {
        const snapshot = state.snapshot({ assetBaseNonInvestment: 0, eventAssetDelta: 0 });
        const monthlyRate = annualRateToMonthlyRate(resolveGrowthRate(context));
        const growth = Math.max(0, (snapshot.opening.investments + snapshot.activity.contribution) * monthlyRate);
        state.addInvestmentGrowth(growth);
      },
    };

    return [sipRule, growthRule];
  }
}
