import { createFinancialPlanningModuleMapper } from "../shared";

import { RETIREMENT_MODULE_KEY } from "./Types";
import type { RetirementPlanningMapper } from "./Types";

export function createRetirementMapper<TInput = unknown, TOutput = TInput>(): RetirementPlanningMapper<TInput, TOutput> {
  return createFinancialPlanningModuleMapper<TInput, TOutput>(RETIREMENT_MODULE_KEY);
}

export const mapRetirementPayload = createRetirementMapper();
