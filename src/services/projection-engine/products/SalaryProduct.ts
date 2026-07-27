import { annualRateToMonthlyRate } from "../assumptions";
import { monthsBetween } from "../rules/month";
import type { FinancialRule } from "../rules/contracts";
import type { IncomeSource, ProjectionContext } from "../types";
import type { FinancialProduct, ProductValidationIssue, ProductValidationResult } from "./contracts";
import { clampNonNegative, isValidMonthNumber, toFiniteNumber } from "./helpers";

export interface SalaryProductData {
  baseMonthlyIncome?: number;
  annualGrowthRate?: number;
  annualBonusMonth?: number;
  bonusMonthlyAmount?: number;
}

function hasActiveRetirementBeforeOrInMonth(input: {
  monthKey: string;
  context: ProjectionContext;
}): boolean {
  return input.context.events.some(
    (event) => event.enabled && event.category === "Retirement" && monthsBetween(event.startMonth, input.monthKey) >= 0,
  );
}

function bonusFromSources(incomeSources: readonly IncomeSource[]): number {
  return incomeSources
    .filter((source) => source.enabled !== false && source.name.toLowerCase().includes("bonus"))
    .reduce((sum, source) => sum + clampNonNegative(source.monthlyAmount), 0);
}

export class SalaryProduct implements FinancialProduct<SalaryProductData> {
  readonly id: string;

  readonly type = "salary";

  constructor(readonly data: SalaryProductData = {}, id = "product.salary") {
    this.id = id;
  }

  validate(): ProductValidationResult {
    const issues: ProductValidationIssue[] = [];

    if (this.data.baseMonthlyIncome !== undefined && toFiniteNumber(this.data.baseMonthlyIncome) < 0) {
      issues.push({ field: "baseMonthlyIncome", message: "Base monthly income must be non-negative." });
    }

    if (this.data.annualGrowthRate !== undefined && !Number.isFinite(Number(this.data.annualGrowthRate))) {
      issues.push({ field: "annualGrowthRate", message: "Annual growth rate must be a finite number." });
    }

    if (this.data.bonusMonthlyAmount !== undefined && toFiniteNumber(this.data.bonusMonthlyAmount) < 0) {
      issues.push({ field: "bonusMonthlyAmount", message: "Bonus amount must be non-negative." });
    }

    if (this.data.annualBonusMonth !== undefined && !isValidMonthNumber(this.data.annualBonusMonth)) {
      issues.push({ field: "annualBonusMonth", message: "Annual bonus month must be an integer from 1 to 12." });
    }

    return { valid: issues.length === 0, issues };
  }

  getRules(): readonly FinancialRule[] {
    const resolveMonthlyIncome = (context: ProjectionContext): number => {
      if (this.data.baseMonthlyIncome !== undefined) {
        return clampNonNegative(this.data.baseMonthlyIncome);
      }

      return clampNonNegative(context.assumptions.incomeMonthly);
    };

    const resolveAnnualGrowthRate = (context: ProjectionContext): number => {
      if (this.data.annualGrowthRate !== undefined) {
        return toFiniteNumber(this.data.annualGrowthRate);
      }

      return toFiniteNumber(context.assumptions.incomeAnnualGrowthRate);
    };

    const resolveBonus = (context: ProjectionContext): number => {
      if (this.data.bonusMonthlyAmount !== undefined) {
        return clampNonNegative(this.data.bonusMonthlyAmount);
      }

      return bonusFromSources(context.incomeSources);
    };

    const salaryRule: FinancialRule = {
      id: "income.salary",
      family: "income",
      step: "income",
      priority: 10,
      appliesTo: ({ context }) => resolveMonthlyIncome(context) > 0,
      execute: ({ context, monthIndex, monthKey, state }) => {
        if (state.isRetired() || hasActiveRetirementBeforeOrInMonth({ monthKey, context })) {
          return;
        }

        const baseSalary = resolveMonthlyIncome(context);
        const monthlyGrowth = annualRateToMonthlyRate(resolveAnnualGrowthRate(context));
        const salary = baseSalary * Math.pow(1 + monthlyGrowth, monthIndex);
        state.addIncome(salary);
      },
    };

    const annualIncrementRule: FinancialRule = {
      id: "income.annual-increment",
      family: "income",
      step: "income",
      priority: 20,
      appliesTo: ({ context, monthIndex }) => resolveMonthlyIncome(context) > 0 && monthIndex > 0 && monthIndex % 12 === 0,
      execute: ({ context, state }) => {
        if (state.isRetired()) {
          return;
        }

        const increment = resolveMonthlyIncome(context) * (resolveAnnualGrowthRate(context) / 100);
        state.addIncome(increment);
      },
    };

    const bonusRule: FinancialRule = {
      id: "income.bonus",
      family: "income",
      step: "income",
      priority: 30,
      appliesTo: ({ context }) => resolveBonus(context) > 0,
      execute: ({ context, monthIndex, state }) => {
        const bonusMonth = this.data.annualBonusMonth ?? 12;
        const monthNumber = (monthIndex % 12) + 1;

        if (state.isRetired() || monthNumber !== bonusMonth) {
          return;
        }

        state.addIncome(resolveBonus(context));
      },
    };

    return [salaryRule, annualIncrementRule, bonusRule];
  }
}
