import type { FinancialPlanningValidationIssue } from "../shared";
import { validateFinancialPlanningPayload } from "../shared";

import { TAXES_MODULE_KEY } from "./Types";

export function validateTaxesPayload(payload: unknown): FinancialPlanningValidationIssue[] {
  return validateFinancialPlanningPayload(TAXES_MODULE_KEY, payload);
}
