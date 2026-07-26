import type { FinancialPlanningValidationIssue } from "../shared";
import { validateFinancialPlanningPayload } from "../shared";

import { REPORTS_MODULE_KEY } from "./Types";

export function validateReportsPayload(payload: unknown): FinancialPlanningValidationIssue[] {
  return validateFinancialPlanningPayload(REPORTS_MODULE_KEY, payload);
}
