import type { FinancialPlanningValidationIssue } from "../shared";
import { validateFinancialPlanningPayload } from "../shared";

import { ASSUMPTIONS_MODULE_KEY } from "./Types";

export function validateAssumptionsPayload(payload: unknown): FinancialPlanningValidationIssue[] {
  return validateFinancialPlanningPayload(ASSUMPTIONS_MODULE_KEY, payload);
}
