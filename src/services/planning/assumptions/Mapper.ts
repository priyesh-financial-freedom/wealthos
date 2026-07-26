import { createFinancialPlanningModuleMapper } from "../shared";

import { ASSUMPTIONS_MODULE_KEY } from "./Types";
import type { AssumptionsPlanningMapper } from "./Types";

export function createAssumptionsMapper<TInput = unknown, TOutput = TInput>(): AssumptionsPlanningMapper<TInput, TOutput> {
  return createFinancialPlanningModuleMapper<TInput, TOutput>(ASSUMPTIONS_MODULE_KEY);
}

export const mapAssumptionsPayload = createAssumptionsMapper();
