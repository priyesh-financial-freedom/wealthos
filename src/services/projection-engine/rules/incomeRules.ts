import { annualRateToMonthlyRate } from "../assumptions";
import { monthsBetween } from "./month";
import type { FinancialRule } from "./contracts";

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function hasActiveRetirementBeforeOrInMonth(input: {
  monthKey: string;
  events: readonly { category: string; startMonth: string; enabled: boolean }[];
}): boolean {
  return input.events.some(
    (event) => event.enabled && event.category === "Retirement" && monthsBetween(event.startMonth, input.monthKey) >= 0,
  );
}

export const salaryRule: FinancialRule = {
  id: "income.salary",
  family: "income",
  step: "income",
  priority: 10,
  appliesTo: ({ context }) => toFiniteNumber(context.assumptions.incomeMonthly) > 0,
  execute: ({ context, monthIndex, monthKey, state }) => {
    if (state.isRetired() || hasActiveRetirementBeforeOrInMonth({ monthKey, events: context.events })) {
      return;
    }

    const baseSalary = toFiniteNumber(context.assumptions.incomeMonthly);
    const monthlyGrowth = annualRateToMonthlyRate(toFiniteNumber(context.assumptions.incomeAnnualGrowthRate));
    const salary = baseSalary * Math.pow(1 + monthlyGrowth, monthIndex);
    state.addIncome(salary);
  },
};

export const annualIncrementRule: FinancialRule = {
  id: "income.annual-increment",
  family: "income",
  step: "income",
  priority: 20,
  appliesTo: ({ context, monthIndex }) => {
    return toFiniteNumber(context.assumptions.incomeMonthly) > 0 && monthIndex > 0 && monthIndex % 12 === 0;
  },
  execute: ({ context, state }) => {
    if (state.isRetired()) {
      return;
    }

    const increment =
      toFiniteNumber(context.assumptions.incomeMonthly)
      * (toFiniteNumber(context.assumptions.incomeAnnualGrowthRate) / 100);
    state.addIncome(increment);
  },
};

export const bonusRule: FinancialRule = {
  id: "income.bonus",
  family: "income",
  step: "income",
  priority: 30,
  appliesTo: ({ context }) => {
    return context.incomeSources.some(
      (source) => source.enabled !== false && source.name.toLowerCase().includes("bonus"),
    );
  },
  execute: ({ context, monthIndex, state }) => {
    if (state.isRetired() || monthIndex % 12 !== 11) {
      return;
    }

    const annualBonus = context.incomeSources
      .filter((source) => source.enabled !== false && source.name.toLowerCase().includes("bonus"))
      .reduce((sum, source) => sum + toFiniteNumber(source.monthlyAmount), 0);

    state.addIncome(annualBonus);
  },
};

export const incomeRules: readonly FinancialRule[] = [
  salaryRule,
  annualIncrementRule,
  bonusRule,
];