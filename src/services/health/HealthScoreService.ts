import { getBalanceSheetData, type BalanceSheetSummary } from "@/services/balanceSheet";
import { getMonthlyHistory, buildMonthlyHistoryModel, type MonthlyHistoryModel } from "@/services/monthlySnapshots";
import { goalService } from "@/services/planning/goals";
import type { FinancialGoalWithProgress } from "@/types/financialGoal";
import { createPlanningScenarioSimulationEngine } from "@/services/planning/scenarios";
import { monthlyReviewService } from "@/services/projection";
import type { SimulationResult } from "@/services/simulation";
import type { HealthScore, HealthScoreComponent, HealthScoreComponentKey, HealthScoreTrendPoint, HealthScoreWeights } from "@/types/healthScore";

const HEALTH_SCORE_WEIGHTS: HealthScoreWeights = {
  liquidity: 20,
  debt: 15,
  goals: 25,
  retirement: 20,
  diversification: 10,
  emergencyFund: 10,
};

interface ScoreBreakdown {
  score: number;
  detail: string;
  strengths: string[];
  watchItems: string[];
  recommendations: string[];
}

interface HealthScoreContext {
  summary: BalanceSheetSummary;
  goals: FinancialGoalWithProgress[];
  simulation: SimulationResult;
  monthlyHistory: MonthlyHistoryModel;
  monthlyReviewVariance: number;
}

interface HealthScoreServiceDependencies {
  balanceSheetLoader?: () => Promise<{ summary: BalanceSheetSummary }>;
  goalsLoader?: () => Promise<FinancialGoalWithProgress[]>;
  simulationLoader?: () => Promise<SimulationResult>;
  monthlyHistoryLoader?: () => Promise<MonthlyHistoryModel>;
  monthlyReviewVarianceLoader?: () => Promise<number>;
}

interface CalculateHealthScoreInput {
  summary?: BalanceSheetSummary;
  goals?: FinancialGoalWithProgress[];
  simulation?: SimulationResult;
  monthlyHistory?: MonthlyHistoryModel;
  monthlyReviewVariance?: number;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function gradeFor(score: number): HealthScore["grade"] {
  if (score >= 95) {
    return "A+";
  }
  if (score >= 90) {
    return "A";
  }
  if (score >= 80) {
    return "B";
  }
  if (score >= 70) {
    return "C";
  }

  return "Needs Attention";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function monthSort(left: HealthScoreTrendPoint, right: HealthScoreTrendPoint): number {
  return left.month.localeCompare(right.month);
}

export class HealthScoreService {
  private readonly simulationEngine = createPlanningScenarioSimulationEngine();

  constructor(private readonly dependencies: HealthScoreServiceDependencies = {}) {}

  async calculateHealthScore(input: CalculateHealthScoreInput = {}): Promise<HealthScore> {
    const context = await this.buildContext(input);

    const liquidity = this.calculateLiquidityScore(context);
    const debt = this.calculateDebtScore(context);
    const goals = this.calculateGoalScore(context);
    const retirement = this.calculateRetirementScore(context);
    const diversification = this.calculateDiversificationScore(context);
    const emergencyFund = this.calculateEmergencyFundScore(context);

    const components: HealthScoreComponent[] = [
      this.toComponent("liquidity", "Liquidity", liquidity),
      this.toComponent("debt", "Debt", debt),
      this.toComponent("goals", "Goals", goals),
      this.toComponent("retirement", "Retirement", retirement),
      this.toComponent("diversification", "Diversification", diversification),
      this.toComponent("emergencyFund", "Emergency Fund", emergencyFund),
    ];

    const weightedTotal = components.reduce((sum, component) => sum + component.weightedScore, 0);
    const overallScore = clampScore(weightedTotal);

    const strengths = [...liquidity.strengths, ...debt.strengths, ...goals.strengths, ...retirement.strengths, ...diversification.strengths, ...emergencyFund.strengths].slice(0, 6);
    const watchItems = [...liquidity.watchItems, ...debt.watchItems, ...goals.watchItems, ...retirement.watchItems, ...diversification.watchItems, ...emergencyFund.watchItems].slice(0, 6);
    const recommendations = [
      ...liquidity.recommendations,
      ...debt.recommendations,
      ...goals.recommendations,
      ...retirement.recommendations,
      ...diversification.recommendations,
      ...emergencyFund.recommendations,
    ].slice(0, 8);

    return {
      overallScore,
      grade: gradeFor(overallScore),
      components,
      strengths,
      watchItems,
      recommendations,
      trend: this.buildTrend(context, components),
    };
  }

  calculateLiquidityScore(context: HealthScoreContext): ScoreBreakdown {
    const cashRatio = Number(context.summary.cashRatio ?? 0);
    const liquidityRatio = Number(context.summary.liquidityRatio ?? 0);

    const cashRatioScore = clampScore(Math.min(100, (cashRatio / 0.2) * 100));
    const liabilityCoverageScore = clampScore(Math.min(100, (liquidityRatio / 0.75) * 100));
    const score = clampScore(cashRatioScore * 0.6 + liabilityCoverageScore * 0.4);

    const detail = `Cash ratio ${(cashRatio * 100).toFixed(1)}% and liquidity coverage ${liquidityRatio.toFixed(2)}x.`;
    const strengths: string[] = [];
    const watchItems: string[] = [];
    const recommendations: string[] = [];

    if (cashRatio >= 0.15) {
      strengths.push("Liquid allocation is strong for short-term flexibility.");
    } else {
      watchItems.push("Liquid allocation is below the 15% comfort range.");
      recommendations.push("Increase cash and near-cash holdings toward at least 15% of the balance sheet.");
    }

    if (liquidityRatio >= 0.75) {
      strengths.push("Liquid holdings cover a meaningful share of liabilities.");
    } else {
      watchItems.push("Liquidity coverage of liabilities is thin.");
      recommendations.push("Build incremental liquid buffers to improve liability coverage.");
    }

    return { score, detail, strengths, watchItems, recommendations };
  }

  calculateDebtScore(context: HealthScoreContext): ScoreBreakdown {
    const debtRatio = Number(context.summary.debtRatio ?? 0);
    const debtRatioScore = clampScore(100 - (debtRatio / 0.6) * 100);
    const variancePenalty = Math.min(15, Math.abs(context.monthlyReviewVariance) > 0 ? Math.abs(context.monthlyReviewVariance) / Math.max(context.summary.netWorth, 1) * 120 : 0);
    const score = clampScore(debtRatioScore - variancePenalty);

    const detail = `Debt ratio ${(debtRatio * 100).toFixed(1)}% with monthly review variance ${context.monthlyReviewVariance.toLocaleString("en-IN")}.`;
    const strengths: string[] = [];
    const watchItems: string[] = [];
    const recommendations: string[] = [];

    if (debtRatio <= 0.3) {
      strengths.push("Debt ratio is in a conservative range.");
    } else if (debtRatio <= 0.5) {
      watchItems.push("Debt ratio is elevated and should be monitored.");
      recommendations.push("Prioritize repayment for high-interest liabilities to reduce leverage.");
    } else {
      watchItems.push("Debt load is high relative to the asset base.");
      recommendations.push("Create a debt reduction plan and evaluate refinancing options.");
    }

    return { score, detail, strengths, watchItems, recommendations };
  }

  calculateGoalScore(context: HealthScoreContext): ScoreBreakdown {
    const goals = context.goals;

    if (goals.length === 0) {
      return {
        score: 40,
        detail: "No long-term goals are currently defined.",
        strengths: [],
        watchItems: ["Goals are not configured."],
        recommendations: ["Create long-term goals and link them to scenarios for progress tracking."],
      };
    }

    const completed = goals.filter((goal) => goal.status === "COMPLETED").length;
    const onTrack = goals.filter((goal) => goal.status === "ON_TRACK").length;
    const needsAttention = goals.filter((goal) => goal.status === "NEEDS_ATTENTION").length;
    const atRisk = goals.filter((goal) => goal.status === "AT_RISK").length;
    const notStarted = goals.filter((goal) => goal.status === "NOT_STARTED").length;

    const fulfillmentScore = ((completed + onTrack * 0.8 + needsAttention * 0.5 + notStarted * 0.25) / goals.length) * 100;
    const riskPenalty = (atRisk / goals.length) * 25;
    const score = clampScore(fulfillmentScore - riskPenalty);

    const avgProgress = average(goals.map((goal) => Number(goal.progress?.progress_percent ?? 0)));
    const detail = `${completed} completed, ${onTrack} on-track, ${atRisk} at-risk goals. Avg progress ${avgProgress.toFixed(1)}%.`;

    const strengths: string[] = [];
    const watchItems: string[] = [];
    const recommendations: string[] = [];

    if (onTrack + completed >= Math.ceil(goals.length * 0.6)) {
      strengths.push("Most goals are completed or on track.");
    }

    if (atRisk > 0) {
      watchItems.push(`${atRisk} goal${atRisk === 1 ? " is" : "s are"} at risk.`);
      recommendations.push("Revisit funding assumptions or timeline for at-risk goals.");
    }

    if (needsAttention > 0) {
      watchItems.push(`${needsAttention} goal${needsAttention === 1 ? " needs" : "s need"} closer tracking.`);
      recommendations.push("Review scenario links for goals that need attention.");
    }

    return { score, detail, strengths, watchItems, recommendations };
  }

  calculateRetirementScore(context: HealthScoreContext): ScoreBreakdown {
    const totalBase = Math.max(Number(context.summary.totalBalanceSheetAssets ?? 0), 1);
    const retirementAssets = Number(context.summary.categoryTotals.retirement ?? 0);
    const retirementRatio = retirementAssets / totalBase;
    const growthScore = clampScore(50 + (context.simulation.summary.netWorthChange / Math.max(context.simulation.summary.openingNetWorth, 1)) * 50);
    const allocationScore = clampScore((retirementRatio / 0.25) * 100);
    const score = clampScore(allocationScore * 0.7 + growthScore * 0.3);

    const detail = `Retirement allocation ${(retirementRatio * 100).toFixed(1)}% with projected net-worth change ${context.simulation.summary.netWorthChange.toLocaleString("en-IN")}.`;
    const strengths: string[] = [];
    const watchItems: string[] = [];
    const recommendations: string[] = [];

    if (retirementRatio >= 0.2) {
      strengths.push("Retirement allocation is well represented in assets.");
    } else {
      watchItems.push("Retirement allocation is below the 20% benchmark.");
      recommendations.push("Increase retirement-directed contributions across EPF/PPF/NPS buckets.");
    }

    if (context.simulation.summary.netWorthChange <= 0) {
      watchItems.push("Simulation outlook does not show positive long-term growth.");
      recommendations.push("Tune assumptions and events to improve long-term retirement trajectory.");
    }

    return { score, detail, strengths, watchItems, recommendations };
  }

  calculateDiversificationScore(context: HealthScoreContext): ScoreBreakdown {
    const allocation = context.summary.assetAllocation.filter((item) => item.value > 0);
    const total = allocation.reduce((sum, item) => sum + item.value, 0);

    if (total <= 0 || allocation.length === 0) {
      return {
        score: 35,
        detail: "Allocation data is insufficient for diversification analysis.",
        strengths: [],
        watchItems: ["Diversification cannot be evaluated without asset mix data."],
        recommendations: ["Add and classify assets to enable diversification tracking."],
      };
    }

    const shares = allocation.map((item) => item.value / total);
    const concentrationIndex = shares.reduce((sum, share) => sum + share * share, 0);
    const effectiveBuckets = 1 / Math.max(concentrationIndex, 0.0001);
    const score = clampScore((Math.min(effectiveBuckets, 6) / 6) * 100);

    const largestShare = Math.max(...shares);
    const detail = `Diversification spans ${allocation.length} categories with largest share ${(largestShare * 100).toFixed(1)}%.`;

    const strengths: string[] = [];
    const watchItems: string[] = [];
    const recommendations: string[] = [];

    if (largestShare <= 0.4) {
      strengths.push("No single asset category dominates the balance sheet.");
    } else {
      watchItems.push("Asset concentration is high in one category.");
      recommendations.push("Rebalance allocations to reduce category concentration risk.");
    }

    if (allocation.length >= 4) {
      strengths.push("Asset mix is distributed across multiple categories.");
    } else {
      watchItems.push("Asset mix has limited category breadth.");
      recommendations.push("Add exposure to additional uncorrelated asset categories over time.");
    }

    return { score, detail, strengths, watchItems, recommendations };
  }

  calculateEmergencyFundScore(context: HealthScoreContext): ScoreBreakdown {
    const monthlyEmi = Math.max(Number(context.summary.monthlyEmi ?? 0), 0);
    const averageBurn = Math.max(0, average(context.simulation.cashFlowForecast.points.filter((point) => point.delta < 0).map((point) => Math.abs(point.delta))));
    const baselineMonthlyNeed = Math.max(monthlyEmi, averageBurn, 1);
    const coverageMonths = Number(context.summary.cashHoldings ?? 0) / baselineMonthlyNeed;
    const score = clampScore((Math.min(coverageMonths, 12) / 12) * 100);

    const detail = `Emergency coverage is ${coverageMonths.toFixed(1)} months based on cash flow and EMI commitments.`;
    const strengths: string[] = [];
    const watchItems: string[] = [];
    const recommendations: string[] = [];

    if (coverageMonths >= 6) {
      strengths.push("Emergency reserve coverage is healthy.");
    } else {
      watchItems.push("Emergency reserves are below six months of commitments.");
      recommendations.push("Build emergency reserves to at least six months of core outflows.");
    }

    return { score, detail, strengths, watchItems, recommendations };
  }

  private toComponent(key: HealthScoreComponentKey, label: string, breakdown: ScoreBreakdown): HealthScoreComponent {
    const weight = HEALTH_SCORE_WEIGHTS[key];

    return {
      key,
      label,
      weight,
      score: breakdown.score,
      weightedScore: roundTo((breakdown.score * weight) / 100, 2),
      detail: breakdown.detail,
    };
  }

  private async buildContext(input: CalculateHealthScoreInput): Promise<HealthScoreContext> {
    const [summaryPayload, goals, simulation, monthlyHistory, monthlyReviewVariance] = await Promise.all([
      input.summary ? Promise.resolve({ summary: input.summary }) : this.loadBalanceSheet(),
      input.goals ? Promise.resolve(input.goals) : this.loadGoals(),
      input.simulation ? Promise.resolve(input.simulation) : this.loadSimulation(),
      input.monthlyHistory ? Promise.resolve(input.monthlyHistory) : this.loadMonthlyHistory(),
      typeof input.monthlyReviewVariance === "number" ? Promise.resolve(input.monthlyReviewVariance) : this.loadMonthlyReviewVariance(),
    ]);

    return {
      summary: summaryPayload.summary,
      goals,
      simulation,
      monthlyHistory,
      monthlyReviewVariance,
    };
  }

  private async loadBalanceSheet() {
    if (this.dependencies.balanceSheetLoader) {
      return this.dependencies.balanceSheetLoader();
    }

    return getBalanceSheetData();
  }

  private async loadGoals() {
    if (this.dependencies.goalsLoader) {
      return this.dependencies.goalsLoader();
    }

    return goalService.listGoals({ includeProgress: true });
  }

  private async loadSimulation() {
    if (this.dependencies.simulationLoader) {
      return this.dependencies.simulationLoader();
    }

    const outcome = await this.simulationEngine.run({ snapshotId: "health-score" });
    if (!outcome.ok) {
      throw new Error(outcome.error.message);
    }

    return outcome.result;
  }

  private async loadMonthlyHistory() {
    if (this.dependencies.monthlyHistoryLoader) {
      return this.dependencies.monthlyHistoryLoader();
    }

    const history = await getMonthlyHistory().catch(() => []);
    return buildMonthlyHistoryModel(history);
  }

  private async loadMonthlyReviewVariance() {
    if (this.dependencies.monthlyReviewVarianceLoader) {
      return this.dependencies.monthlyReviewVarianceLoader();
    }

    const workspace = await monthlyReviewService.getMonthlyReviewWorkspace().catch(() => null);
    return Number(workspace?.summary?.projectionVariance ?? 0);
  }

  private buildTrend(context: HealthScoreContext, components: HealthScoreComponent[]): HealthScoreTrendPoint[] {
    const baseScore = components.reduce((sum, component) => sum + component.weightedScore, 0);
    const orderedHistory = [...context.monthlyHistory.records]
      .sort((left, right) => (left.snapshot.snapshot_year - right.snapshot.snapshot_year) || (left.snapshot.snapshot_month - right.snapshot.snapshot_month))
      .slice(-6);

    if (orderedHistory.length === 0) {
      return [];
    }

    return orderedHistory.map((record, index) => {
      const debtRatio = record.snapshot.assets_total + record.snapshot.investments_total > 0
        ? record.snapshot.liabilities_total / (record.snapshot.assets_total + record.snapshot.investments_total)
        : 0;
      const growthSignal = record.snapshot.growth_from_previous_month / Math.max(Math.abs(record.snapshot.net_worth), 1);
      const debtAdjustment = (0.35 - debtRatio) * 18;
      const growthAdjustment = growthSignal * 40;
      const recencyAdjustment = (index - Math.max(orderedHistory.length - 1, 0)) * 0.8;

      return {
        month: record.monthLabel,
        score: clampScore(baseScore + debtAdjustment + growthAdjustment + recencyAdjustment),
      };
    }).sort(monthSort);
  }
}

export const healthScoreService = new HealthScoreService();
