import { createFinancialPlanningRepositoryContract } from "../shared";

import { ASSUMPTIONS_MODULE_KEY } from "./Types";
import type { AssumptionsPlanningRepository } from "./Types";

export function createAssumptionsPlanningRepository(): AssumptionsPlanningRepository {
  return createFinancialPlanningRepositoryContract(ASSUMPTIONS_MODULE_KEY);
}

export const assumptionsPlanningRepository = createAssumptionsPlanningRepository();
