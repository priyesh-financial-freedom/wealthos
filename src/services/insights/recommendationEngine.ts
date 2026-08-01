import type { BalanceSheetSummary } from "@/services/balanceSheet";
import type { DecisionRecommendation, DecisionPriority } from "@/services/decision";
import type { FinancialGoalWithProgress } from "@/types/financialGoal";

export type DashboardRecommendationPriority = "High" | "Medium" | "Low";

export interface DashboardRecommendation {
  id: string;
  title: string;
  priority: DashboardRecommendationPriority;
  reason: string;
  nextStep: string;
}

export interface RecommendationEngineInput {
  decisionRecommendations: DecisionRecommendation[];
  balanceSheetSummary: BalanceSheetSummary;
  goals: FinancialGoalWithProgress[];
  monthlySavings: number;
  hasMonthlyReview: boolean;
  maxItems?: number;
}

function mapDecisionPriority(priority: DecisionPriority): DashboardRecommendationPriority {
  if (priority === "Critical" || priority === "High") {
    return "High";
  }

  if (priority === "Medium") {
    return "Medium";
  }

  return "Low";
}

function pushRule(
  actions: DashboardRecommendation[],
  id: string,
  title: string,
  priority: DashboardRecommendationPriority,
  reason: string,
  nextStep: string,
) {
  actions.push({ id, title, priority, reason, nextStep });
}

function buildFallbackRecommendations(input: RecommendationEngineInput): DashboardRecommendation[] {
  const actions: DashboardRecommendation[] = [];
  const debtRatio = Number(input.balanceSheetSummary.debtRatio ?? 0);
  const atRiskGoals = input.goals.filter((goal) => {
    const progress = Number(goal.progress?.progress_percent ?? 0);
    return goal.status === "AT_RISK" || progress < 40;
  }).length;

  if (input.monthlySavings < 0) {
    pushRule(
      actions,
      "fallback-cashflow",
      "Stabilize Monthly Cash Flow",
      "High",
      "Monthly savings is negative, which weakens short-term financial resilience.",
      "Review discretionary expenses and increase savings toward a positive monthly surplus.",
    );
  }

  if (debtRatio > 0.35) {
    pushRule(
      actions,
      "fallback-debt",
      "Track EMI Obligations",
      debtRatio > 0.5 ? "High" : "Medium",
      `Debt ratio is ${(debtRatio * 100).toFixed(1)}%, above the 35% threshold.`,
      "Prioritize repayment of high-interest liabilities and reassess refinance options.",
    );
  }

  if (atRiskGoals > 0) {
    pushRule(
      actions,
      "fallback-goals",
      "Recheck Goal Funding Gap",
      "Medium",
      `${atRiskGoals} goal(s) are below healthy funding progress.`,
      "Adjust monthly contributions or timelines for goals marked Watch/At Risk.",
    );
  }

  if (!input.hasMonthlyReview) {
    pushRule(
      actions,
      "fallback-monthly-review",
      "Update Monthly Actuals",
      "Medium",
      "Recent month-end actuals are missing, reducing planning accuracy.",
      "Complete Monthly Review to refresh actual balances and variance insights.",
    );
  }

  if (actions.length === 0) {
    pushRule(
      actions,
      "fallback-stable",
      "Review Asset Allocation Drift",
      "Low",
      "Tracked indicators are stable, but portfolio drift can accumulate over time.",
      "Review target allocation assumptions and rebalance if drift exceeds tolerance.",
    );
  }

  return actions;
}

export function buildDashboardRecommendations(input: RecommendationEngineInput): DashboardRecommendation[] {
  const maxItems = Math.max(3, Math.min(5, input.maxItems ?? 5));
  const priorityWeight: Record<DashboardRecommendationPriority, number> = {
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const mappedFromDecisionEngine = input.decisionRecommendations
    .filter((item) => item.status !== "Dismissed")
    .map((item) => ({
      id: item.id,
      title: item.title,
      priority: mapDecisionPriority(item.priority),
      reason: item.reason,
      nextStep: item.recommendedAction,
    } satisfies DashboardRecommendation));

  const recommendations = mappedFromDecisionEngine.length > 0
    ? mappedFromDecisionEngine
    : buildFallbackRecommendations(input);

  const deduped = new Map<string, DashboardRecommendation>();
  for (const recommendation of recommendations) {
    if (!deduped.has(recommendation.id)) {
      deduped.set(recommendation.id, recommendation);
    }
  }

  return [...deduped.values()]
    .sort((left, right) => {
      const diff = priorityWeight[right.priority] - priorityWeight[left.priority];
      if (diff !== 0) {
        return diff;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, maxItems);
}
