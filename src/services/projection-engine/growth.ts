export interface GrowthInput {
  openingInvestments: number;
  contribution: number;
  monthlyGrowthRate: number;
}

export interface GrowthResult {
  investmentGrowth: number;
}

export interface RuleBasedGrowthResult {
  investmentGrowth: number;
  assetAppreciation: number;
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function calculateInvestmentGrowth(input: GrowthInput): GrowthResult {
  const baseInvestments = Math.max(0, toFiniteNumber(input.openingInvestments));
  const contribution = Math.max(0, toFiniteNumber(input.contribution));
  const monthlyGrowthRate = toFiniteNumber(input.monthlyGrowthRate);
  const growthBase = baseInvestments + contribution;

  return {
    investmentGrowth: Math.max(0, growthBase * monthlyGrowthRate),
  };
}

export function calculateGrowthFromRates(input: {
  investmentsBase: number;
  assetsBase: number;
  investmentMonthlyRate: number;
  assetMonthlyRate: number;
}): RuleBasedGrowthResult {
  const investmentsBase = Math.max(0, toFiniteNumber(input.investmentsBase));
  const assetsBase = Math.max(0, toFiniteNumber(input.assetsBase));
  const investmentMonthlyRate = toFiniteNumber(input.investmentMonthlyRate);
  const assetMonthlyRate = toFiniteNumber(input.assetMonthlyRate);

  return {
    investmentGrowth: Math.max(0, investmentsBase * investmentMonthlyRate),
    assetAppreciation: Math.max(0, assetsBase * assetMonthlyRate),
  };
}