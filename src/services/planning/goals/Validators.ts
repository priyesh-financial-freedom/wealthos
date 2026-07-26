import type { FinancialPlanningValidationIssue } from "../shared";
import { validateFinancialPlanningPayload } from "../shared";

import { GOALS_MODULE_KEY } from "./Types";

export function validateGoalsPayload(payload: unknown): FinancialPlanningValidationIssue[] {
  return validateFinancialPlanningPayload(GOALS_MODULE_KEY, payload);
}
