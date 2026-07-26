import type { FinancialPlanningValidationIssue } from "../shared";
import { validateFinancialPlanningPayload } from "../shared";

import { PROJECTIONS_MODULE_KEY } from "./Types";

export function validateProjectionsPayload(payload: unknown): FinancialPlanningValidationIssue[] {
  return validateFinancialPlanningPayload(PROJECTIONS_MODULE_KEY, payload);
}
