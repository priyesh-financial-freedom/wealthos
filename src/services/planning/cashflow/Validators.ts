import type { FinancialPlanningValidationIssue } from "../shared";
import { validateFinancialPlanningPayload } from "../shared";

import { CASHFLOW_MODULE_KEY } from "./Types";

export function validateCashflowPayload(payload: unknown): FinancialPlanningValidationIssue[] {
  return validateFinancialPlanningPayload(CASHFLOW_MODULE_KEY, payload);
}
