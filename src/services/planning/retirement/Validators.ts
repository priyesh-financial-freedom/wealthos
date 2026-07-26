import type { FinancialPlanningValidationIssue } from "../shared";
import { validateFinancialPlanningPayload } from "../shared";

import { RETIREMENT_MODULE_KEY } from "./Types";

export function validateRetirementPayload(payload: unknown): FinancialPlanningValidationIssue[] {
  return validateFinancialPlanningPayload(RETIREMENT_MODULE_KEY, payload);
}
