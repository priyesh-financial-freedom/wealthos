import { createFinancialPlanningServiceContract } from "../shared";
import { projectionContextFactory, type ProjectionContext } from "../projectionContext";

import { GOALS_MODULE_KEY } from "./Types";
import type { GoalsPlanningService } from "./Types";

export function createGoalsPlanningService(context: ProjectionContext): GoalsPlanningService {
  return createFinancialPlanningServiceContract(GOALS_MODULE_KEY, context);
}

export const goalsPlanningService = createGoalsPlanningService(projectionContextFactory.createEmpty());
