import { createFinancialPlanningServiceContract } from "../shared";
import { projectionContextFactory, type ProjectionContext } from "../projectionContext";

import { RETIREMENT_MODULE_KEY } from "./Types";
import type { RetirementPlanningService } from "./Types";

export function createRetirementPlanningService(context: ProjectionContext): RetirementPlanningService {
  return createFinancialPlanningServiceContract(RETIREMENT_MODULE_KEY, context);
}

export const retirementPlanningService = createRetirementPlanningService(projectionContextFactory.createEmpty());
