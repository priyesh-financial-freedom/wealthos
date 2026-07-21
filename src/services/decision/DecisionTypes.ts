import type { FinancialGoalWithProgress } from "@/types/financialGoal";
import type { HealthScore } from "@/types/healthScore";
import type { BalanceSheetSummary } from "@/services/balanceSheet";
import type { MonthlyReviewWorkspace } from "@/services/projection";
import type { PlanningScenarioWithOverrides } from "@/types/planningScenario";
import type { SimulationResult } from "@/services/simulation";

export type DecisionCategory =
  | "Retirement"
  | "Investment"
  | "Debt"
  | "Liquidity"
  | "Goals"
  | "Insurance"
  | "Estate"
  | "Tax"
  | "Portfolio"
  | "Cash Flow";

export type DecisionPriority = "Critical" | "High" | "Medium" | "Low";

export type DecisionSeverity = "Red" | "Amber" | "Green";

export type DecisionStatus = "Open" | "Dismissed";

export interface DecisionRecommendation {
  id: string;
  title: string;
  category: DecisionCategory;
  priority: DecisionPriority;
  severity: DecisionSeverity;
  reason: string;
  recommendedAction: string;
  expectedBenefit: string;
  confidence: number;
  status: DecisionStatus;
  createdAt: string;
}

export interface DecisionRuleResult extends Omit<DecisionRecommendation, "status" | "createdAt"> {
  ruleId: string;
}

export interface DecisionEngineContext {
  healthScore: HealthScore;
  goals: FinancialGoalWithProgress[];
  scenarios: PlanningScenarioWithOverrides[];
  balanceSheetSummary: BalanceSheetSummary;
  monthlyReview: MonthlyReviewWorkspace | null;
  activeScenarioSimulation: SimulationResult | null;
  baselineSimulation: SimulationResult;
}

export interface DecisionRepositoryRecord {
  id: string;
  user_id: string;
  title: string;
  category: DecisionCategory;
  priority: DecisionPriority;
  severity: DecisionSeverity;
  reason: string;
  recommended_action: string;
  expected_benefit: string;
  confidence: number;
  status: DecisionStatus;
  created_at: string;
  updated_at: string;
}
