import type { MonthlyAssumptionSet, ProjectionAssumptions } from "./types";

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNonNegative(value: number): number {
  return Math.max(0, value);
}

export function annualRateToMonthlyRate(annualRatePercent: number): number {
  const annualRate = toFiniteNumber(annualRatePercent) / 100;
  if (annualRate <= -1) {
    return -1;
  }

  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function normalizeAssumptions(input: ProjectionAssumptions): ProjectionAssumptions {
  return {
    incomeMonthly: clampNonNegative(toFiniteNumber(input.incomeMonthly)),
    incomeAnnualGrowthRate: toFiniteNumber(input.incomeAnnualGrowthRate),
    expensesMonthly: clampNonNegative(toFiniteNumber(input.expensesMonthly)),
    inflationAnnualRate: toFiniteNumber(input.inflationAnnualRate),
    investmentGrowthAnnualRate: toFiniteNumber(input.investmentGrowthAnnualRate),
    contributionMonthly: clampNonNegative(toFiniteNumber(input.contributionMonthly)),
    contributionAnnualStepUpRate: toFiniteNumber(input.contributionAnnualStepUpRate),
    loans: (input.loans ?? []).map((loan) => ({
      ...loan,
      outstandingPrincipal: clampNonNegative(toFiniteNumber(loan.outstandingPrincipal)),
      annualInterestRate: toFiniteNumber(loan.annualInterestRate),
      emi: clampNonNegative(toFiniteNumber(loan.emi)),
    })),
  };
}

export function buildMonthlyAssumptions(
  assumptions: ProjectionAssumptions,
  monthIndex: number,
): MonthlyAssumptionSet {
  const safeMonthIndex = Math.max(0, Math.floor(monthIndex));
  const incomeMonthlyGrowthRate = annualRateToMonthlyRate(assumptions.incomeAnnualGrowthRate);
  const inflationMonthlyRate = annualRateToMonthlyRate(assumptions.inflationAnnualRate);
  const investmentGrowthMonthlyRate = annualRateToMonthlyRate(assumptions.investmentGrowthAnnualRate);
  const stepUpMultiplier = Math.pow(
    1 + assumptions.contributionAnnualStepUpRate / 100,
    Math.floor(safeMonthIndex / 12),
  );

  return {
    income: clampNonNegative(
      assumptions.incomeMonthly * Math.pow(1 + incomeMonthlyGrowthRate, safeMonthIndex),
    ),
    expenses: clampNonNegative(
      assumptions.expensesMonthly * Math.pow(1 + inflationMonthlyRate, safeMonthIndex),
    ),
    plannedContribution: clampNonNegative(assumptions.contributionMonthly * stepUpMultiplier),
    incomeMonthlyGrowthRate,
    inflationMonthlyRate,
    investmentGrowthMonthlyRate,
  };
}