import { DEFAULT_SCENARIO_KEY, assumptionsService } from "@/services/assumptions";
import { buildCashFlowSummary, cashFlowManagementService } from "@/services/cashFlowManagement";
import { getBalanceSheetData } from "@/services/balanceSheet";
import { buildAssetSummaryFromAssets } from "@/services/assetManagement";
import { buildInvestmentSummary } from "@/services/investments";
import { buildLoanSummaryFromLiabilities } from "@/services/loanManagement";
import { goalService } from "@/services/planning/goals";
import { createPlanningScenarioProductionSimulationEngine } from "@/services/planning/scenarios";
import { projectionEngine, projectionInputService } from "@/services/projection";
import type { SimulationResult } from "@/services/simulation";
import type { ProjectionScenario } from "@/types/projection";

export interface ExecutiveGoalProgressItem {
  id: string;
  name: string;
  progressPercent: number;
  targetAmount: number;
  gap: number;
}

export interface ExecutiveDashboardData {
  asOfLabel: string;
  emptyState: boolean;
  executiveSummary: {
    netWorth: number;
    assets: number;
    liabilities: number;
    monthlySavings: number;
  };
  investments: {
    currentPortfolio: number;
    monthlyInvestment: number;
    projectedValue: number;
    expectedCagr: number;
  };
  loans: {
    outstanding: number;
    emi: number;
    interestRate: number;
    activeLoans: number;
  };
  goals: {
    total: number;
    onTrack: number;
    atRisk: number;
    completed: number;
    items: ExecutiveGoalProgressItem[];
  };
  monthlySummary: {
    income: number;
    expenses: number;
    savings: number;
    investments: number;
    netWorthChange: number;
  };
}

function monthToLabel(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

const simulationEngine = createPlanningScenarioProductionSimulationEngine();

async function loadSimulation(): Promise<SimulationResult | null> {
  const outcome = await simulationEngine.run({ snapshotId: "executive-dashboard" });

  if (!outcome.ok) {
    return null;
  }

  return outcome.result;
}

function buildGoalProgressItems(goals: Awaited<ReturnType<typeof goalService.listGoals>>): ExecutiveGoalProgressItem[] {
  return [...goals]
    .sort((left, right) => Number(right.progress?.progress_percent ?? 0) - Number(left.progress?.progress_percent ?? 0))
    .slice(0, 5)
    .map((goal) => ({
      id: goal.id,
      name: goal.name,
      progressPercent: Number(goal.progress?.progress_percent ?? 0),
      targetAmount: Number(goal.progress?.target_amount ?? goal.target_amount ?? 0),
      gap: Math.max(0, Number(goal.progress?.target_amount ?? goal.target_amount ?? 0) - Number(goal.progress?.projected_amount ?? 0)),
    }));
}

async function loadCurrentMonthProjectionSummary(startMonth: string, endYear: number): Promise<{
  income: number;
  expenses: number;
  savings: number;
  investments: number;
  netWorthChange: number;
} | null> {
  const scenario: ProjectionScenario = {
    id: DEFAULT_SCENARIO_KEY,
    name: "Executive dashboard projection",
    description: "Executive dashboard monthly summary.",
    startMonth,
    planningHorizonYear: endYear,
    assumptions: [],
    events: [],
    isDefault: true,
  };

  const context = await projectionInputService.buildContext({
    scenario,
    startSource: { kind: "latest-closed-month-end" },
  }).catch(() => null);

  if (!context) {
    return null;
  }

  const projection = await projectionEngine.run(context).catch(() => null);
  const firstRecord = projection?.monthlyLedger[0];
  const firstSnapshot = projection?.snapshots[0];

  if (!firstRecord) {
    return null;
  }

  const income = toNumber(firstRecord.salary) + toNumber(firstRecord.bonus) + toNumber(firstRecord.rentalIncome) + toNumber(firstRecord.businessIncome) + toNumber(firstRecord.otherIncome);
  const expenses = toNumber(firstRecord.livingExpenses) + toNumber(firstRecord.insurancePremium) + toNumber(firstRecord.taxes) + toNumber(firstRecord.emis);
  const savings = income - expenses;

  return {
    income,
    expenses,
    savings,
    investments: toNumber(firstRecord.investmentContributions),
    netWorthChange: toNumber(firstSnapshot?.closingBalance) - toNumber(firstSnapshot?.openingBalance),
  };
}

export class ExecutiveDashboardService {
  async getDashboard(): Promise<ExecutiveDashboardData> {
    const [balanceSheetData, goals, assumptions, simulation, persistedCashFlowSummary] = await Promise.all([
      getBalanceSheetData(),
      goalService.listGoals({ includeProgress: true }).catch(() => []),
      assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY).catch(() => null),
      loadSimulation().catch(() => null),
      cashFlowManagementService.getCashFlowSummary().catch(() => null),
    ]);

    const projectionMonthly = assumptions
      ? await loadCurrentMonthProjectionSummary(assumptions.planning.startMonth, assumptions.planning.endYear).catch(() => null)
      : null;

    const investmentSummary = buildInvestmentSummary(balanceSheetData.investments);
    const assetSummary = buildAssetSummaryFromAssets(balanceSheetData.assets);
    const loanSummary = buildLoanSummaryFromLiabilities(balanceSheetData.liabilities);
    const goalItems = buildGoalProgressItems(goals);
    const goalsOnTrack = goals.filter((goal) => goal.status === "ON_TRACK" || goal.status === "COMPLETED").length;
    const atRiskGoals = goals.filter((goal) => goal.status === "AT_RISK").length;
    const completedGoals = goals.filter((goal) => goal.status === "COMPLETED").length;
    const monthlyIncomeFallback = toNumber(assumptions?.income.monthlyIncome) + toNumber(assumptions?.income.otherMonthlyIncome) + toNumber(assumptions?.income.rentalIncome) + toNumber(assumptions?.income.businessIncome);
    const monthlyExpensesFallback = toNumber(projectionMonthly?.expenses);
    const monthlyInvestmentFallback = toNumber(assumptions?.investments.monthlySipAmount) + toNumber(assumptions?.investments.stockInvestmentAmount);
    const monthlyCashFlow = persistedCashFlowSummary ?? buildCashFlowSummary(
      [
        {
          id: "dashboard-income",
          name: "Monthly income",
          type: "Other",
          monthlyAmount: projectionMonthly?.income ?? monthlyIncomeFallback,
          annualIncrement: 0,
          startDate: null,
          status: "Active",
          notes: null,
        },
      ],
      [
        {
          id: "dashboard-expenses",
          name: "Monthly expenses",
          category: "Other",
          monthlyAmount: projectionMonthly?.expenses ?? monthlyExpensesFallback,
          annualInflation: 0,
          startDate: null,
          status: "Active",
          notes: null,
        },
      ],
      [],
    );
    const projectedInvestmentValue = simulation?.monthlySnapshots.at(-1)?.closingBalances.investments ?? investmentSummary.totalInvestmentValue;

    const output: ExecutiveDashboardData = {
      asOfLabel: monthToLabel(simulation?.summary.projectionEnd ?? assumptions?.planning.startMonth ?? ""),
      emptyState: Number(balanceSheetData.summary.totalBalanceSheetAssets ?? 0) <= 0 && Number(balanceSheetData.summary.totalLiabilities ?? 0) <= 0,
      executiveSummary: {
        netWorth: Number(balanceSheetData.summary.netWorth ?? 0),
        assets: assetSummary.totalAssets,
        liabilities: Number(balanceSheetData.summary.totalLiabilities ?? 0),
        monthlySavings: monthlyCashFlow.monthlySavings,
      },
      investments: {
        currentPortfolio: Number(investmentSummary.totalInvestmentValue ?? 0),
        monthlyInvestment: projectionMonthly?.investments ?? monthlyInvestmentFallback,
        projectedValue: Number(projectedInvestmentValue ?? 0),
        expectedCagr: Number(investmentSummary.cagr ?? assumptions?.investments.expectedReturnRate ?? 0),
      },
      loans: {
        outstanding: loanSummary.totalOutstanding,
        emi: loanSummary.totalEmi,
        interestRate: loanSummary.averageInterestRate,
        activeLoans: loanSummary.activeLoans,
      },
      goals: {
        total: goals.length,
        onTrack: goalsOnTrack,
        atRisk: atRiskGoals,
        completed: completedGoals,
        items: goalItems,
      },
      monthlySummary: {
        income: monthlyCashFlow.monthlyIncome,
        expenses: monthlyCashFlow.monthlyExpenses,
        savings: monthlyCashFlow.monthlySavings,
        investments: projectionMonthly?.investments ?? monthlyInvestmentFallback,
        netWorthChange: projectionMonthly?.netWorthChange ?? Number(simulation?.summary.netWorthChange ?? 0),
      },
    };

    return output;
  }
}

export const executiveDashboardService = new ExecutiveDashboardService();
