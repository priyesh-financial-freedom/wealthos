import { createFinancialPlanningModuleMapper } from "../shared";

import { REPORTS_MODULE_KEY } from "./Types";
import type { ReportsPlanningMapper } from "./Types";

export function createReportsMapper<TInput = unknown, TOutput = TInput>(): ReportsPlanningMapper<TInput, TOutput> {
  return createFinancialPlanningModuleMapper<TInput, TOutput>(REPORTS_MODULE_KEY);
}

export const mapReportsPayload = createReportsMapper();
