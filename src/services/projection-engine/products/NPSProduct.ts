import type { FinancialRule } from "../rules/contracts";
import type { ContributionRule, ProjectionContext } from "../types";
import type { FinancialProduct, ProductValidationIssue, ProductValidationResult } from "./contracts";
import { contributionAmount, isValidMonthNumber, toFiniteNumber } from "./helpers";

export interface NPSContributionDefinition {
  id: string;
  amount?: number;
  percentage?: number;
  scheduleMonth?: number;
  enabled?: boolean;
}

export interface NPSProductData {
  useContextRules?: boolean;
  monthlyRules?: readonly NPSContributionDefinition[];
  annualRules?: readonly NPSContributionDefinition[];
}

function annualDue(monthIndex: number, scheduleMonth?: number): boolean {
  const monthNumber = (monthIndex % 12) + 1;
  const configuredMonth = Number(scheduleMonth ?? 3);
  return monthNumber === (Number.isInteger(configuredMonth) ? configuredMonth : 3);
}

function contextNPSRules(context: ProjectionContext, type: "nps-monthly" | "nps-annual"): ContributionRule[] {
  return context.contributionRules.filter((rule) => rule.type === type);
}

export class NPSProduct implements FinancialProduct<NPSProductData> {
  readonly id: string;

  readonly type = "nps";

  constructor(readonly data: NPSProductData = {}, id = "product.nps") {
    this.id = id;
  }

  validate(): ProductValidationResult {
    const issues: ProductValidationIssue[] = [];

    const inspectRules = (rules: readonly NPSContributionDefinition[] | undefined, mode: "monthly" | "annual"): void => {
      for (const [index, rule] of (rules ?? []).entries()) {
        if (rule.amount !== undefined && toFiniteNumber(rule.amount) < 0) {
          issues.push({ field: `${mode}Rules[${index}].amount`, message: "Contribution amount must be non-negative." });
        }

        if (rule.percentage !== undefined && toFiniteNumber(rule.percentage) < 0) {
          issues.push({ field: `${mode}Rules[${index}].percentage`, message: "Contribution percentage must be non-negative." });
        }

        if (mode === "annual" && rule.scheduleMonth !== undefined && !isValidMonthNumber(rule.scheduleMonth)) {
          issues.push({
            field: `${mode}Rules[${index}].scheduleMonth`,
            message: "Annual schedule month must be an integer from 1 to 12.",
          });
        }
      }
    };

    inspectRules(this.data.monthlyRules, "monthly");
    inspectRules(this.data.annualRules, "annual");

    return { valid: issues.length === 0, issues };
  }

  getRules(): readonly FinancialRule[] {
    const monthlyRules = (context: ProjectionContext): ReadonlyArray<ContributionRule | NPSContributionDefinition> => {
      const configured = this.data.monthlyRules ?? [];
      if (this.data.useContextRules === false) {
        return configured;
      }

      return [...contextNPSRules(context, "nps-monthly"), ...configured];
    };

    const annualRules = (context: ProjectionContext): ReadonlyArray<ContributionRule | NPSContributionDefinition> => {
      const configured = this.data.annualRules ?? [];
      if (this.data.useContextRules === false) {
        return configured;
      }

      return [...contextNPSRules(context, "nps-annual"), ...configured];
    };

    const monthlyRule: FinancialRule = {
      id: "investment.nps-monthly",
      family: "investment",
      step: "investment-contributions",
      priority: 40,
      appliesTo: ({ context }) => monthlyRules(context).some((candidate) => candidate.enabled !== false),
      execute: ({ context, state }) => {
        const income = toFiniteNumber(context.assumptions.incomeMonthly);
        for (const candidate of monthlyRules(context)) {
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

    const annualRule: FinancialRule = {
      id: "investment.nps-annual",
      family: "investment",
      step: "investment-contributions",
      priority: 50,
      appliesTo: ({ context }) => annualRules(context).some((candidate) => candidate.enabled !== false),
      execute: ({ context, monthIndex, state }) => {
        const income = toFiniteNumber(context.assumptions.incomeMonthly);
        for (const candidate of annualRules(context)) {
          if (candidate.enabled === false) {
            continue;
          }

          const amount = contributionAmount(candidate, income);
          if (amount <= 0 || !annualDue(monthIndex, candidate.scheduleMonth)) {
            continue;
          }

          state.addContribution(amount);
        }
      },
    };

    return [monthlyRule, annualRule];
  }
}
