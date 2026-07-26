import { createFinancialPlanningModuleMapper } from "../shared";

import { TAXES_MODULE_KEY } from "./Types";
import type { TaxesPlanningMapper } from "./Types";

export function createTaxesMapper<TInput = unknown, TOutput = TInput>(): TaxesPlanningMapper<TInput, TOutput> {
  return createFinancialPlanningModuleMapper<TInput, TOutput>(TAXES_MODULE_KEY);
}

export const mapTaxesPayload = createTaxesMapper();
