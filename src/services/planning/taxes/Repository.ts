import { createFinancialPlanningRepositoryContract } from "../shared";

import { TAXES_MODULE_KEY } from "./Types";
import type { TaxesPlanningRepository } from "./Types";

export function createTaxesPlanningRepository(): TaxesPlanningRepository {
  return createFinancialPlanningRepositoryContract(TAXES_MODULE_KEY);
}

export const taxesPlanningRepository = createTaxesPlanningRepository();
