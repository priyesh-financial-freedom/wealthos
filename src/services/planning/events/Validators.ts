import type { FinancialPlanningValidationIssue } from "../shared";
import { validateFinancialPlanningPayload } from "../shared";

import { EVENTS_MODULE_KEY } from "./Types";

export function validateEventsPayload(payload: unknown): FinancialPlanningValidationIssue[] {
  return validateFinancialPlanningPayload(EVENTS_MODULE_KEY, payload);
}
