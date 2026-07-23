export type GoalStatus = "NOT_STARTED" | "ON_TRACK" | "NEEDS_ATTENTION" | "AT_RISK" | "COMPLETED";

export type GoalPriority = "LOW" | "MEDIUM" | "HIGH";

export type GoalType = "RETIREMENT" | "EDUCATION" | "HOME_PURCHASE" | "WEALTH_TARGET" | "CUSTOM";

export interface FinancialGoal {
  id: string;
  user_id: string;
  name: string;
  goal_type: GoalType;
  custom_goal_type: string | null;
  target_amount: number;
  target_date: string;
  priority: GoalPriority;
  status: GoalStatus;
  funding_source: string | null;
  linked_scenario_id: string | null;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialGoalInsert {
  name: string;
  goal_type: GoalType;
  custom_goal_type?: string | null;
  target_amount: number;
  target_date: string;
  priority: GoalPriority;
  funding_source?: string | null;
  linked_scenario_id?: string | null;
  notes?: string | null;
}

export interface FinancialGoalUpdate {
  id: string;
  name?: string;
  goal_type?: GoalType;
  custom_goal_type?: string | null;
  target_amount?: number;
  target_date?: string;
  priority?: GoalPriority;
  status?: GoalStatus;
  funding_source?: string | null;
  linked_scenario_id?: string | null;
  notes?: string | null;
  is_completed?: boolean;
}

export interface GoalProgress {
  goal_id: string;
  target_amount: number;
  projected_amount: number;
  progress_percent: number;
  status: GoalStatus;
  projection_month: string;
}

export interface FinancialGoalWithProgress extends FinancialGoal {
  progress: GoalProgress | null;
  linked_scenario_name: string | null;
}

export interface GoalSummary {
  totalGoals: number;
  completedGoals: number;
  onTrackGoals: number;
  atRiskGoals: number;
}
