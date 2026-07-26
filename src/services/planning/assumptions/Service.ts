import { createFinancialPlanningServiceContract } from "../shared";
import { projectionContextFactory, type ProjectionContext } from "../projectionContext";

import { ASSUMPTIONS_MODULE_KEY } from "./Types";
import type { AssumptionsPlanningService } from "./Types";

export function createAssumptionsPlanningService(context: ProjectionContext): AssumptionsPlanningService {
  return createFinancialPlanningServiceContract(ASSUMPTIONS_MODULE_KEY, context);
}

export const assumptionsPlanningService = createAssumptionsPlanningService(projectionContextFactory.createEmpty());
