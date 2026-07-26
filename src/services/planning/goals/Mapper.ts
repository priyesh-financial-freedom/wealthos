import { createFinancialPlanningModuleMapper } from "../shared";

import { GOALS_MODULE_KEY } from "./Types";
import type { GoalsPlanningMapper } from "./Types";

export function createGoalsMapper<TInput = unknown, TOutput = TInput>(): GoalsPlanningMapper<TInput, TOutput> {
  return createFinancialPlanningModuleMapper<TInput, TOutput>(GOALS_MODULE_KEY);
}

export const mapGoalsPayload = createGoalsMapper();
