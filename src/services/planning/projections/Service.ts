import { createFinancialPlanningServiceContract } from "../shared";
import { projectionContextFactory, type ProjectionContext } from "../projectionContext";

import { PROJECTIONS_MODULE_KEY } from "./Types";
import type { ProjectionsPlanningService } from "./Types";

export function createProjectionsPlanningService(context: ProjectionContext): ProjectionsPlanningService {
  return createFinancialPlanningServiceContract(PROJECTIONS_MODULE_KEY, context);
}

export const projectionsPlanningService = createProjectionsPlanningService(projectionContextFactory.createEmpty());
