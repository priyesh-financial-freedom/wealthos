import { createFinancialPlanningModuleMapper } from "../shared";

import { CASHFLOW_MODULE_KEY } from "./Types";
import type { CashflowPlanningMapper } from "./Types";

export function createCashflowMapper<TInput = unknown, TOutput = TInput>(): CashflowPlanningMapper<TInput, TOutput> {
  return createFinancialPlanningModuleMapper<TInput, TOutput>(CASHFLOW_MODULE_KEY);
}

export const mapCashflowPayload = createCashflowMapper();
