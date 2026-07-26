import { createFinancialPlanningRepositoryContract } from "../shared";

import { GOALS_MODULE_KEY } from "./Types";
import type { GoalsPlanningRepository } from "./Types";

export function createGoalsPlanningRepository(): GoalsPlanningRepository {
  return createFinancialPlanningRepositoryContract(GOALS_MODULE_KEY);
}

export const goalsPlanningRepository = createGoalsPlanningRepository();
