import { createFinancialPlanningRepositoryContract } from "../shared";

import { PROJECTIONS_MODULE_KEY } from "./Types";
import type { ProjectionsPlanningRepository } from "./Types";

export function createProjectionsPlanningRepository(): ProjectionsPlanningRepository {
  return createFinancialPlanningRepositoryContract(PROJECTIONS_MODULE_KEY);
}

export const projectionsPlanningRepository = createProjectionsPlanningRepository();
