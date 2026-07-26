import { createFinancialPlanningModuleMapper } from "../shared";

import { PROJECTIONS_MODULE_KEY } from "./Types";
import type { ProjectionsPlanningMapper } from "./Types";

export function createProjectionsMapper<TInput = unknown, TOutput = TInput>(): ProjectionsPlanningMapper<TInput, TOutput> {
  return createFinancialPlanningModuleMapper<TInput, TOutput>(PROJECTIONS_MODULE_KEY);
}

export const mapProjectionsPayload = createProjectionsMapper();
