import { createFinancialPlanningRepositoryContract } from "../shared";

import { CASHFLOW_MODULE_KEY } from "./Types";
import type { CashflowPlanningRepository } from "./Types";

export function createCashflowPlanningRepository(): CashflowPlanningRepository {
  return createFinancialPlanningRepositoryContract(CASHFLOW_MODULE_KEY);
}

export const cashflowPlanningRepository = createCashflowPlanningRepository();
