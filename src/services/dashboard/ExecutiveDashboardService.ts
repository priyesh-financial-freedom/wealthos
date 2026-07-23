import { getBalanceSheetData, type BalanceSheetData } from "@/services/balanceSheet";
import { DecisionEngine, type DecisionRecommendation } from "@/services/decision";
import { healthScoreService, type HealthScore } from "@/services/health";
import { goalService } from "@/services/planning/goals";
import { createPlanningScenarioSimulationEngine } from "@/services/planning/scenarios";
import { monthlyReviewService, type MonthlyReviewWorkspace } from "@/services/projection";
import type { FinancialGoalWithProgress } from "@/types/financialGoal";
import type { SimulationResult } from "@/services/simulation";

class MissingMonthlyReviewWorkspaceError extends Error {
  constructor() {
    super("Monthly review workspace is unavailable.");
    this.name = "MissingMonthlyReviewWorkspaceError";
  }
}

export interface ExecutiveTimelineItem {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
}

export interface ExecutiveGoalProgressItem {
  id: string;
  name: string;
  status: FinancialGoalWithProgress["status"];
  progressPercent: number;
  targetAmount: number;
  projectedAmount: number;
  targetDate: string;
}

export interface ExecutiveAllocationItem {
  name: string;
  value: number;
  sharePercent: number;
}

export interface ExecutiveCashFlowPoint {
  month: string;
  value: number;
  delta: number;
}

export interface ExecutiveDashboardData {
  asOfLabel: string;
  emptyState: boolean;
  health: HealthScore;
  kpis: {
    netWorth: number;
    totalGoals: number;
    goalsOnTrack: number;
    openDecisions: number;
    criticalDecisions: number;
    retirementCoveragePercent: number;
    retirementAssets: number;
  };
  decisionCenter: {
    openCount: number;
    criticalCount: number;
    items: DecisionRecommendation[];
  };
  goals: {
    total: number;
    onTrack: number;
    atRisk: number;
    completed: number;
    items: ExecutiveGoalProgressItem[];
  };
  wealthAllocation: {
    assets: ExecutiveAllocationItem[];
    liabilities: ExecutiveAllocationItem[];
  };
  cashFlow: {
    currentCash: number;
    averageMonthlyDelta: number;
    negativeMonths: number;
    projectedNetWorthChange: number;
    points: ExecutiveCashFlowPoint[];
  };
  recentActivity: ExecutiveTimelineItem[];
}

function safeDateLabel(isoValue: string): string {
  const timestamp = Date.parse(isoValue);
  if (!Number.isFinite(timestamp)) {
    return "Recently";
  }

  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
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

function shareOf(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return (value / total) * 100;
}

async function traceAsync<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  console.log(`[ExecutiveDashboardService] ${label} - start`);

  try {
    const result = await operation();
    console.log(`[ExecutiveDashboardService] ${label} - complete`, {
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    console.error(`[ExecutiveDashboardService] ${label} - error`, {
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
}

async function loadSimulation(): Promise<SimulationResult | null> {
  const startedAt = Date.now();
  console.log("[ExecutiveDashboardService] loadSimulation helper start");
  const simulationEngine = createPlanningScenarioSimulationEngine();
  console.log("[ExecutiveDashboardService] loadSimulation helper before simulationEngine.run");
  const outcome = await simulationEngine.run({ snapshotId: "executive-dashboard" });
  console.log("[ExecutiveDashboardService] loadSimulation helper after simulationEngine.run", {
    durationMs: Date.now() - startedAt,
    ok: outcome.ok,
  });

  if (!outcome.ok) {
    console.warn("[ExecutiveDashboardService] loadSimulation helper returning null because outcome is not ok", {
      code: outcome.error.code,
      message: outcome.error.message,
    });
    return null;
  }

  console.log("[ExecutiveDashboardService] loadSimulation helper complete", {
    durationMs: Date.now() - startedAt,
  });
  return outcome.result;
}

async function loadDecisionPreview(input: {
  balanceSheet: BalanceSheetData;
  health: HealthScore;
  goals: FinancialGoalWithProgress[];
  monthlyReview: MonthlyReviewWorkspace | null;
  simulation: SimulationResult | null;
}): Promise<DecisionRecommendation[]> {
  const startedAt = Date.now();
  console.log("[ExecutiveDashboardService] loadDecisionPreview start", {
    hasSimulation: Boolean(input.simulation),
    goalsCount: input.goals.length,
  });
  const simulation = input.simulation;
  if (!simulation) {
    console.log("[ExecutiveDashboardService] loadDecisionPreview skip because simulation is unavailable");
    return [];
  }

  const decisionPreviewEngine = new DecisionEngine({
    balanceSheetLoader: async () => input.balanceSheet,
    healthScoreLoader: async () => input.health,
    goalsLoader: async () => input.goals,
    scenarioLoader: async () => [],
    monthlyReviewLoader: async () => {
      if (!input.monthlyReview) {
        throw new MissingMonthlyReviewWorkspaceError();
      }

      return input.monthlyReview;
    },
    baselineSimulationLoader: async () => simulation,
  });

  console.log("[ExecutiveDashboardService] loadDecisionPreview before generateRecommendations");
  const recommendations = await decisionPreviewEngine.generateRecommendations().catch((error) => {
    console.error("[ExecutiveDashboardService] loadDecisionPreview generateRecommendations failed; returning []", {
      error,
      durationMs: Date.now() - startedAt,
    });
    return [];
  });
  console.log("[ExecutiveDashboardService] loadDecisionPreview complete", {
    durationMs: Date.now() - startedAt,
    recommendations: recommendations.length,
  });

  return recommendations;
}

function buildGoalProgressItems(goals: FinancialGoalWithProgress[]): ExecutiveGoalProgressItem[] {
  return [...goals]
    .sort((left, right) => Number(right.progress?.progress_percent ?? 0) - Number(left.progress?.progress_percent ?? 0))
    .slice(0, 5)
    .map((goal) => ({
      id: goal.id,
      name: goal.name,
      status: goal.status,
      progressPercent: Number(goal.progress?.progress_percent ?? 0),
      targetAmount: Number(goal.progress?.target_amount ?? goal.target_amount ?? 0),
      projectedAmount: Number(goal.progress?.projected_amount ?? 0),
      targetDate: goal.target_date,
    }));
}

function buildRecentActivity(params: {
  goals: FinancialGoalWithProgress[];
  decisions: DecisionRecommendation[];
  monthlyReview: MonthlyReviewWorkspace | null;
  simulation: SimulationResult | null;
}): ExecutiveTimelineItem[] {
  const timeline: ExecutiveTimelineItem[] = [];

  if (params.monthlyReview?.selectedPeriod && params.monthlyReview.summary) {
    timeline.push({
      id: `monthly-close-${params.monthlyReview.selectedPeriod.closeId}`,
      title: `${params.monthlyReview.selectedPeriod.label} close reviewed`,
      detail: `Net worth variance ${params.monthlyReview.summary.projectionVariance.toLocaleString("en-IN")} against projection baseline.`,
      timeLabel: "Latest close",
    });
  }

  for (const goal of [...params.goals].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)).slice(0, 3)) {
    timeline.push({
      id: `goal-${goal.id}`,
      title: `Goal updated: ${goal.name}`,
      detail: `${Number(goal.progress?.progress_percent ?? 0).toFixed(1)}% funded toward target.`,
      timeLabel: safeDateLabel(goal.updated_at),
    });
  }

  for (const recommendation of params.decisions.filter((item) => item.status === "Open").slice(0, 3)) {
    timeline.push({
      id: `decision-${recommendation.id}`,
      title: `Decision flagged: ${recommendation.title}`,
      detail: `${recommendation.priority} priority in ${recommendation.category}.`,
      timeLabel: safeDateLabel(recommendation.createdAt),
    });
  }

  if (params.simulation) {
    timeline.push({
      id: "simulation-refresh",
      title: "Simulation baseline refreshed",
      detail: `Projection runs through ${monthToLabel(params.simulation.summary.projectionEnd)} with net-worth delta ${params.simulation.summary.netWorthChange.toLocaleString("en-IN")}.`,
      timeLabel: "Now",
    });
  }

  return timeline.slice(0, 8);
}

export class ExecutiveDashboardService {
  async getDashboard(): Promise<ExecutiveDashboardData> {
    const startedAt = Date.now();
    console.log("[ExecutiveDashboardService] getDashboard start");

    const [balanceSheetData, goals, monthlyReview, simulation] = await Promise.all([
      traceAsync("getBalanceSheetData", () => getBalanceSheetData()),
      traceAsync("goalService.listGoals(includeProgress=true)", () => goalService.listGoals({ includeProgress: true }))
        .catch((error) => {
          console.error("[ExecutiveDashboardService] goalService.listGoals fallback to []", { error });
          return [];
        }),
      traceAsync("monthlyReviewService.getMonthlyReviewWorkspace", () => monthlyReviewService.getMonthlyReviewWorkspace())
        .catch((error) => {
          console.error("[ExecutiveDashboardService] monthlyReviewService.getMonthlyReviewWorkspace fallback to null", { error });
          return null;
        }),
      traceAsync("loadSimulation", () => loadSimulation())
        .catch((error) => {
          console.error("[ExecutiveDashboardService] loadSimulation fallback to null", { error });
          return null;
        }),
    ]);

    console.log("[ExecutiveDashboardService] base data loaded", {
      durationMs: Date.now() - startedAt,
      goalsCount: goals.length,
      hasMonthlyReview: Boolean(monthlyReview),
      hasSimulation: Boolean(simulation),
    });

    const health = await traceAsync("healthScoreService.calculateHealthScore", () =>
      healthScoreService.calculateHealthScore({
        summary: balanceSheetData.summary,
        goals,
        simulation: simulation ?? undefined,
        monthlyReviewVariance: Number(monthlyReview?.summary?.projectionVariance ?? 0),
      }),
    );

    const decisions = await traceAsync("loadDecisionPreview", () =>
      loadDecisionPreview({
        balanceSheet: balanceSheetData,
        health,
        goals,
        monthlyReview,
        simulation,
      }),
    );

    const totalAssetBase = Number(balanceSheetData.summary.totalBalanceSheetAssets ?? 0);
    const totalLiabilities = Number(balanceSheetData.summary.totalLiabilities ?? 0);
    const openDecisions = decisions.filter((item) => item.status === "Open");
    const goalItems = buildGoalProgressItems(goals);
    const goalsOnTrack = goals.filter((goal) => goal.status === "ON_TRACK" || goal.status === "COMPLETED").length;
    const atRiskGoals = goals.filter((goal) => goal.status === "AT_RISK").length;
    const completedGoals = goals.filter((goal) => goal.status === "COMPLETED").length;
    const projectedCashPoints = (simulation?.cashFlowForecast.points ?? []).slice(-6);
    const averageMonthlyDelta = projectedCashPoints.length > 0
      ? projectedCashPoints.reduce((sum, point) => sum + Number(point.delta ?? 0), 0) / projectedCashPoints.length
      : 0;
    const negativeMonths = projectedCashPoints.filter((point) => Number(point.delta ?? 0) < 0).length;

    const output: ExecutiveDashboardData = {
      asOfLabel: monthlyReview?.selectedPeriod?.label ?? monthToLabel(simulation?.summary.projectionEnd ?? ""),
      emptyState: totalAssetBase <= 0 && totalLiabilities <= 0,
      health,
      kpis: {
        netWorth: Number(balanceSheetData.summary.netWorth ?? 0),
        totalGoals: goals.length,
        goalsOnTrack,
        openDecisions: openDecisions.length,
        criticalDecisions: openDecisions.filter((item) => item.priority === "Critical").length,
        retirementCoveragePercent: shareOf(Number(balanceSheetData.summary.categoryTotals.retirement ?? 0), Math.max(totalAssetBase, 1)),
        retirementAssets: Number(balanceSheetData.summary.categoryTotals.retirement ?? 0),
      },
      decisionCenter: {
        openCount: openDecisions.length,
        criticalCount: openDecisions.filter((item) => item.priority === "Critical").length,
        items: openDecisions.slice(0, 4),
      },
      goals: {
        total: goals.length,
        onTrack: goalsOnTrack,
        atRisk: atRiskGoals,
        completed: completedGoals,
        items: goalItems,
      },
      wealthAllocation: {
        assets: balanceSheetData.summary.assetAllocation.map((item) => ({
          name: item.name,
          value: item.value,
          sharePercent: shareOf(item.value, Math.max(totalAssetBase, 1)),
        })),
        liabilities: balanceSheetData.summary.liabilityAllocation.map((item) => ({
          name: item.name,
          value: item.value,
          sharePercent: shareOf(item.value, Math.max(totalLiabilities, 1)),
        })),
      },
      cashFlow: {
        currentCash: Number(balanceSheetData.summary.cashHoldings ?? 0),
        averageMonthlyDelta,
        negativeMonths,
        projectedNetWorthChange: Number(simulation?.summary.netWorthChange ?? 0),
        points: projectedCashPoints.map((point) => ({
          month: monthToLabel(point.month),
          value: Number(point.value ?? 0),
          delta: Number(point.delta ?? 0),
        })),
      },
      recentActivity: buildRecentActivity({
        goals,
        decisions,
        monthlyReview,
        simulation,
      }),
    };

    console.log("[ExecutiveDashboardService] getDashboard complete", {
      durationMs: Date.now() - startedAt,
      emptyState: output.emptyState,
      decisions: output.decisionCenter.openCount,
    });

    return output;
  }
}

export const executiveDashboardService = new ExecutiveDashboardService();
