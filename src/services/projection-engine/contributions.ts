import type { ContributionRule, MonthlyAssumptionSet } from "./types";

export interface ContributionInput {
  openingCash: number;
  income: number;
  expenses: number;
  monthlyAssumptions: MonthlyAssumptionSet;
}

export interface ContributionResult {
  contribution: number;
  contributionShortfall: number;
}

export interface ContributionRulesInput {
  rules: readonly ContributionRule[];
  monthlyIncome: number;
  monthlyExpenses: number;
  openingCash: number;
  fallbackPlannedContribution: number;
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function calculateContribution(input: ContributionInput): ContributionResult {
  const openingCash = toFiniteNumber(input.openingCash);
  const income = toFiniteNumber(input.income);
  const expenses = toFiniteNumber(input.expenses);
  const plannedContribution = Math.max(0, toFiniteNumber(input.monthlyAssumptions.plannedContribution));
  const availableForContribution = Math.max(0, openingCash + income - expenses);
  const contribution = Math.min(plannedContribution, availableForContribution);

  return {
    contribution,
    contributionShortfall: plannedContribution - contribution,
  };
}

export function calculateContributionFromRules(input: ContributionRulesInput): ContributionResult {
  const income = toFiniteNumber(input.monthlyIncome);
  const expenses = toFiniteNumber(input.monthlyExpenses);
  const openingCash = toFiniteNumber(input.openingCash);
  const surplus = Math.max(0, income - expenses);

  const plannedFromRules = input.rules
    .filter((rule) => rule.enabled !== false)
    .reduce((sum, rule) => {
      if (rule.type === "fixed") {
        return sum + Math.max(0, toFiniteNumber(rule.amount));
      }

      if (rule.type === "percent-of-income") {
        const percent = Math.max(0, toFiniteNumber(rule.percentage)) / 100;
        return sum + income * percent;
      }

      const percent = Math.max(0, toFiniteNumber(rule.percentage)) / 100;
      return sum + surplus * percent;
    }, 0);

  const plannedContribution =
    plannedFromRules > 0
      ? plannedFromRules
      : Math.max(0, toFiniteNumber(input.fallbackPlannedContribution));

  const availableForContribution = Math.max(0, openingCash + income - expenses);
  const contribution = Math.min(plannedContribution, availableForContribution);

  return {
    contribution,
    contributionShortfall: plannedContribution - contribution,
  };
}