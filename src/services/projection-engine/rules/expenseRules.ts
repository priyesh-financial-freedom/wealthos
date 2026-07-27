import { annualRateToMonthlyRate } from "../assumptions";
import type { FinancialRule } from "./contracts";

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function baseMonthlyExpense(contextExpenseCategories: readonly { monthlyAmount: number; enabled?: boolean }[]): number {
  const configured = contextExpenseCategories
    .filter((category) => category.enabled !== false)
    .reduce((sum, category) => sum + Math.max(0, toFiniteNumber(category.monthlyAmount)), 0);

  return configured;
}

export const monthlyExpenseRule: FinancialRule = {
  id: "expense.monthly",
  family: "expense",
  step: "expenses",
  priority: 10,
  appliesTo: ({ context }) => {
    return context.expenseCategories.some((category) => category.enabled !== false);
  },
  execute: ({ context, state }) => {
    state.addExpense(baseMonthlyExpense(context.expenseCategories));
  },
};

export const inflationRule: FinancialRule = {
  id: "expense.inflation",
  family: "expense",
  step: "expenses",
  priority: 20,
  appliesTo: ({ context, monthIndex }) => {
    return monthIndex > 0
      && context.expenseCategories.some((category) => category.enabled !== false)
      && toFiniteNumber(context.assumptions.inflationAnnualRate) !== 0;
  },
  execute: ({ context, monthIndex, state }) => {
    const monthlyInflationRate = annualRateToMonthlyRate(toFiniteNumber(context.assumptions.inflationAnnualRate));
    const baseExpense = baseMonthlyExpense(context.expenseCategories);
    const inflatedTotal = baseExpense * Math.pow(1 + monthlyInflationRate, monthIndex);
    const inflationDelta = inflatedTotal - baseExpense;
    state.addExpense(inflationDelta);
  },
};

export const expenseRules: readonly FinancialRule[] = [
  monthlyExpenseRule,
  inflationRule,
];