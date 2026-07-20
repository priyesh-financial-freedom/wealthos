import type { SimulationResult } from "@/services/simulation";
import type { AssumptionsBundle } from "@/types/assumptions";

export type PlanningScenarioType = "BASE" | "CUSTOM" | "SYSTEM";

export type PlanningScenarioEditableKey =
  | "retirement_target_age"
  | "salary_growth_rate"
  | "inflation_rate"
  | "investment_return_rate"
  | "expense_inflation_rate";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface PlanningScenario {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  type: PlanningScenarioType;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanningScenarioOverride {
  id: string;
  user_id: string;
  scenario_id: string;
  assumption_key: PlanningScenarioEditableKey;
  override_value: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface PlanningScenarioWithOverrides extends PlanningScenario {
  overrides: PlanningScenarioOverride[];
}

export interface PlanningScenarioInsert {
  name: string;
  description?: string | null;
  type?: PlanningScenarioType;
  is_default?: boolean;
  is_active?: boolean;
}

export interface PlanningScenarioUpdate {
  id: string;
  name?: string;
  description?: string | null;
  type?: PlanningScenarioType;
  is_default?: boolean;
  is_active?: boolean;
}

export interface PlanningScenarioOverrideInput {
  assumption_key: PlanningScenarioEditableKey;
  override_value: JsonValue;
}

export interface PlanningScenarioComparisonScenario {
  scenario: PlanningScenarioWithOverrides;
  simulation: SimulationResult;
}

export interface PlanningScenarioComparison {
  left: PlanningScenarioComparisonScenario;
  right: PlanningScenarioComparisonScenario;
}

export interface PlanningScenarioSimulationInput {
  assumptions: AssumptionsBundle;
}
