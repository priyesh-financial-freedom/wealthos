import type { ContributionRule, GrowthRule } from "@/services/projection-engine";

export interface Investment {
  id: string;
  name: string;
  type: string;
  currentValue: number;
  monthlyContribution: number;
  annualContribution: number;
  expectedReturn: number;
  startDate: string;
  status: string;
}

export type InvestmentCreateInput = Omit<Investment, "id">;
export type InvestmentUpdateInput = Partial<Omit<Investment, "id">>;

export interface InvestmentValidationIssue {
  field: keyof InvestmentCreateInput;
  message: string;
}

export interface InvestmentProjectionIntegration {
  contributionRules: ContributionRule[];
  growthRules: GrowthRule[];
  investmentGrowthAnnualRate: number;
}

export interface InvestmentSummary {
  currentValue: number;
  totalContributions: number;
  projectedValue: number;
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

function isActiveInvestment(status: string): boolean {
  return status.toLowerCase() !== "closed";
}

function normalizeInvestmentInput(input: InvestmentCreateInput): InvestmentCreateInput {
  return {
    ...input,
    name: String(input.name ?? "").trim(),
    type: String(input.type ?? "").trim(),
    currentValue: toFiniteNumber(input.currentValue),
    monthlyContribution: toFiniteNumber(input.monthlyContribution),
    annualContribution: toFiniteNumber(input.annualContribution),
    expectedReturn: toFiniteNumber(input.expectedReturn),
    startDate: String(input.startDate ?? "").trim(),
    status: String(input.status ?? "").trim(),
  };
}

export function validateInvestment(input: InvestmentCreateInput): InvestmentValidationIssue[] {
  const normalized = normalizeInvestmentInput(input);
  const issues: InvestmentValidationIssue[] = [];

  if (!normalized.name) {
    issues.push({ field: "name", message: "Name is required." });
  }

  if (normalized.currentValue < 0) {
    issues.push({ field: "currentValue", message: "Current value must be greater than or equal to 0." });
  }

  if (normalized.expectedReturn < 0 || normalized.expectedReturn > 100) {
    issues.push({ field: "expectedReturn", message: "Expected return must be between 0 and 100." });
  }

  if (normalized.monthlyContribution < 0) {
    issues.push({ field: "monthlyContribution", message: "Monthly contribution must be greater than or equal to 0." });
  }

  if (normalized.annualContribution < 0) {
    issues.push({ field: "annualContribution", message: "Annual contribution must be greater than or equal to 0." });
  }

  return issues;
}

function assertValidInvestment(input: InvestmentCreateInput): void {
  const issues = validateInvestment(input);
  if (issues.length === 0) {
    return;
  }

  throw new Error(issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | "));
}

export class InvestmentManagementService {
  private readonly investments = new Map<string, Investment>();

  constructor(initialInvestments: readonly Investment[] = []) {
    for (const investment of initialInvestments) {
      this.investments.set(investment.id, { ...investment });
    }
  }

  addInvestment(input: InvestmentCreateInput): Investment {
    const normalizedInput = normalizeInvestmentInput(input);
    assertValidInvestment(normalizedInput);

    const id = crypto.randomUUID();
    const investment: Investment = {
      id,
      ...normalizedInput,
    };

    this.investments.set(id, investment);
    return { ...investment };
  }

  editInvestment(id: string, updates: InvestmentUpdateInput): Investment {
    const current = this.investments.get(id);
    if (!current) {
      throw new Error("Investment not found.");
    }

    const merged: InvestmentCreateInput = normalizeInvestmentInput({
      name: updates.name ?? current.name,
      type: updates.type ?? current.type,
      currentValue: updates.currentValue ?? current.currentValue,
      monthlyContribution: updates.monthlyContribution ?? current.monthlyContribution,
      annualContribution: updates.annualContribution ?? current.annualContribution,
      expectedReturn: updates.expectedReturn ?? current.expectedReturn,
      startDate: updates.startDate ?? current.startDate,
      status: updates.status ?? current.status,
    });

    assertValidInvestment(merged);

    const updated: Investment = {
      id,
      ...merged,
    };

    this.investments.set(id, updated);
    return { ...updated };
  }

  deleteInvestment(id: string): void {
    if (!this.investments.has(id)) {
      throw new Error("Investment not found.");
    }

    this.investments.delete(id);
  }

  listInvestments(): Investment[] {
    return Array.from(this.investments.values()).map((investment) => ({ ...investment }));
  }
}

export function generateProjectionRules(investments: readonly Investment[]): InvestmentProjectionIntegration {
  const activeInvestments = investments.filter((investment) => isActiveInvestment(investment.status));

  const contributionRules: ContributionRule[] = [];
  const growthRules: GrowthRule[] = [];

  for (const investment of activeInvestments) {
    if (investment.monthlyContribution > 0) {
      contributionRules.push({
        id: `investment:${investment.id}:monthly`,
        type: "sip",
        amount: roundTwo(investment.monthlyContribution),
        enabled: true,
        metadata: {
          source: "investment-management",
          investmentId: investment.id,
          investmentName: investment.name,
        },
      });
    }

    if (investment.annualContribution > 0) {
      contributionRules.push({
        id: `investment:${investment.id}:annual-as-monthly`,
        type: "sip",
        amount: roundTwo(investment.annualContribution / 12),
        enabled: true,
        metadata: {
          source: "investment-management",
          investmentId: investment.id,
          investmentName: investment.name,
          annualContribution: investment.annualContribution,
        },
      });
    }

    growthRules.push({
      id: `investment:${investment.id}:growth`,
      target: "investments",
      annualRate: roundTwo(investment.expectedReturn),
      enabled: true,
    });
  }

  const weightedGrowthRateNumerator = activeInvestments.reduce((sum, investment) => {
    const weight = Math.max(0, investment.currentValue + investment.monthlyContribution * 12 + investment.annualContribution);
    return sum + weight * investment.expectedReturn;
  }, 0);

  const weightedGrowthRateDenominator = activeInvestments.reduce((sum, investment) => {
    return sum + Math.max(0, investment.currentValue + investment.monthlyContribution * 12 + investment.annualContribution);
  }, 0);

  const investmentGrowthAnnualRate =
    weightedGrowthRateDenominator > 0
      ? roundTwo(weightedGrowthRateNumerator / weightedGrowthRateDenominator)
      : 0;

  return {
    contributionRules,
    growthRules,
    investmentGrowthAnnualRate,
  };
}

export function buildInvestmentSummary(investments: readonly Investment[], years = 1): InvestmentSummary {
  const projectionYears = Math.max(1, Math.floor(toFiniteNumber(years)));

  let currentValue = 0;
  let totalContributions = 0;
  let projectedValue = 0;

  for (const investment of investments) {
    const annualContribution = investment.monthlyContribution * 12 + investment.annualContribution;
    const contributionOverPeriod = annualContribution * projectionYears;
    const principal = Math.max(0, investment.currentValue) + Math.max(0, contributionOverPeriod);
    const projected = principal * Math.pow(1 + Math.max(0, investment.expectedReturn) / 100, projectionYears);

    currentValue += Math.max(0, investment.currentValue);
    totalContributions += Math.max(0, contributionOverPeriod);
    projectedValue += projected;
  }

  return {
    currentValue: roundTwo(currentValue),
    totalContributions: roundTwo(totalContributions),
    projectedValue: roundTwo(projectedValue),
  };
}