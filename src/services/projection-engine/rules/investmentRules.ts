import { annualRateToMonthlyRate } from "../assumptions";
import type { ContributionRule } from "../types";
import type { FinancialRule } from "./contracts";

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function ruleAmount(rule: ContributionRule, income: number): number {
  const fixed = Math.max(0, toFiniteNumber(rule.amount));
  const percent = Math.max(0, toFiniteNumber(rule.percentage));
  if (fixed > 0) {
    return fixed;
  }

  if (percent > 0) {
    return income * (percent / 100);
  }

  return 0;
}

function annualDue(monthIndex: number, scheduleMonth?: number): boolean {
  if (monthIndex < 0) {
    return false;
  }

  const monthNumber = (monthIndex % 12) + 1;
  const configured = Number(scheduleMonth ?? 3);
  return monthNumber === (Number.isInteger(configured) ? configured : 3);
}

function executeContributionType(input: {
  type: string;
  monthIndex: number;
  rules: readonly ContributionRule[];
  incomeMonthly: number;
  state: { addContribution: (amount: number) => void };
}): void {
  const activeRules = input.rules.filter((rule) => rule.enabled !== false && rule.type === input.type);
  for (const rule of activeRules) {
    const amount = ruleAmount(rule, input.incomeMonthly);
    if (amount <= 0) {
      continue;
    }

    if (rule.type === "nps-annual") {
      if (annualDue(input.monthIndex, rule.scheduleMonth)) {
        input.state.addContribution(amount);
      }
      continue;
    }

    input.state.addContribution(amount);
  }
}

export const sipRule: FinancialRule = {
  id: "investment.sip",
  family: "investment",
  step: "investment-contributions",
  priority: 10,
  appliesTo: ({ context }) => context.contributionRules.some((rule) => rule.enabled !== false && rule.type === "sip"),
  execute: ({ context, monthIndex, state }) => {
    executeContributionType({
      type: "sip",
      monthIndex,
      rules: context.contributionRules,
      incomeMonthly: context.assumptions.incomeMonthly,
      state,
    });
  },
};

export const epfRule: FinancialRule = {
  id: "investment.epf",
  family: "investment",
  step: "investment-contributions",
  priority: 20,
  appliesTo: ({ context }) => context.contributionRules.some((rule) => rule.enabled !== false && rule.type === "epf"),
  execute: ({ context, monthIndex, state }) => {
    executeContributionType({
      type: "epf",
      monthIndex,
      rules: context.contributionRules,
      incomeMonthly: context.assumptions.incomeMonthly,
      state,
    });
  },
};

export const ppfRule: FinancialRule = {
  id: "investment.ppf",
  family: "investment",
  step: "investment-contributions",
  priority: 30,
  appliesTo: ({ context }) => context.contributionRules.some((rule) => rule.enabled !== false && rule.type === "ppf"),
  execute: ({ context, monthIndex, state }) => {
    executeContributionType({
      type: "ppf",
      monthIndex,
      rules: context.contributionRules,
      incomeMonthly: context.assumptions.incomeMonthly,
      state,
    });
  },
};

export const npsMonthlyRule: FinancialRule = {
  id: "investment.nps-monthly",
  family: "investment",
  step: "investment-contributions",
  priority: 40,
  appliesTo: ({ context }) => context.contributionRules.some((rule) => rule.enabled !== false && rule.type === "nps-monthly"),
  execute: ({ context, monthIndex, state }) => {
    executeContributionType({
      type: "nps-monthly",
      monthIndex,
      rules: context.contributionRules,
      incomeMonthly: context.assumptions.incomeMonthly,
      state,
    });
  },
};

export const npsAnnualRule: FinancialRule = {
  id: "investment.nps-annual",
  family: "investment",
  step: "investment-contributions",
  priority: 50,
  appliesTo: ({ context }) => context.contributionRules.some((rule) => rule.enabled !== false && rule.type === "nps-annual"),
  execute: ({ context, monthIndex, state }) => {
    executeContributionType({
      type: "nps-annual",
      monthIndex,
      rules: context.contributionRules,
      incomeMonthly: context.assumptions.incomeMonthly,
      state,
    });
  },
};

export const investmentGrowthRule: FinancialRule = {
  id: "investment.growth",
  family: "investment",
  step: "investment-growth",
  priority: 10,
  appliesTo: () => true,
  execute: ({ context, state }) => {
    const openingInvestments = state.snapshot({ assetBaseNonInvestment: 0, eventAssetDelta: 0 }).opening.investments;
    const contribution = state.snapshot({ assetBaseNonInvestment: 0, eventAssetDelta: 0 }).activity.contribution;
    const monthlyRate = annualRateToMonthlyRate(context.assumptions.investmentGrowthAnnualRate);
    const growth = Math.max(0, (openingInvestments + contribution) * monthlyRate);
    state.addInvestmentGrowth(growth);
  },
};

export const investmentRules: readonly FinancialRule[] = [
  sipRule,
  epfRule,
  ppfRule,
  npsMonthlyRule,
  npsAnnualRule,
  investmentGrowthRule,
];