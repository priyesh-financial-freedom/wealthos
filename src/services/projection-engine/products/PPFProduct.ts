import type { FinancialRule } from "../rules/contracts";
import type { ContributionRule, ProjectionContext } from "../types";
import type { FinancialProduct, ProductValidationIssue, ProductValidationResult } from "./contracts";
import { contributionAmount, toFiniteNumber } from "./helpers";

export interface PPFContributionDefinition {
  id: string;
  amount?: number;
  percentage?: number;
  enabled?: boolean;
}

export interface PPFProductData {
  useContextRules?: boolean;
  rules?: readonly PPFContributionDefinition[];
}

function contextPPFRules(context: ProjectionContext): ContributionRule[] {
  return context.contributionRules.filter((rule) => rule.type === "ppf");
}

export class PPFProduct implements FinancialProduct<PPFProductData> {
  readonly id: string;

  readonly type = "ppf";

  constructor(readonly data: PPFProductData = {}, id = "product.ppf") {
    this.id = id;
  }

  validate(): ProductValidationResult {
    const issues: ProductValidationIssue[] = [];

    for (const [index, rule] of (this.data.rules ?? []).entries()) {
      const amount = rule.amount;
      const percentage = rule.percentage;
      if (amount !== undefined && toFiniteNumber(amount) < 0) {
        issues.push({ field: `rules[${index}].amount`, message: "Contribution amount must be non-negative." });
      }

      if (percentage !== undefined && toFiniteNumber(percentage) < 0) {
        issues.push({ field: `rules[${index}].percentage`, message: "Contribution percentage must be non-negative." });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  getRules(): readonly FinancialRule[] {
    const resolveRules = (context: ProjectionContext): ReadonlyArray<ContributionRule | PPFContributionDefinition> => {
      const configured = this.data.rules ?? [];
      if (this.data.useContextRules === false) {
        return configured;
      }

      return [...contextPPFRules(context), ...configured];
    };

    const rule: FinancialRule = {
      id: "investment.ppf",
      family: "investment",
      step: "investment-contributions",
      priority: 30,
      appliesTo: ({ context }) => {
        return resolveRules(context).some((candidate) => candidate.enabled !== false);
      },
      execute: ({ context, state }) => {
        const income = toFiniteNumber(context.assumptions.incomeMonthly);
        for (const candidate of resolveRules(context)) {
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

    return [rule];
  }
}
