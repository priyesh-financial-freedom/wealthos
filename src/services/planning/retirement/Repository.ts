import { createFinancialPlanningRepositoryContract } from "../shared";

import { RETIREMENT_MODULE_KEY } from "./Types";
import type { RetirementPlanningRepository } from "./Types";

export function createRetirementPlanningRepository(): RetirementPlanningRepository {
  return createFinancialPlanningRepositoryContract(RETIREMENT_MODULE_KEY);
}

export const retirementPlanningRepository = createRetirementPlanningRepository();
