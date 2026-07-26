import type {
  FinancialPlanningModuleKey,
  FinancialPlanningValidationIssue,
} from "./Types";

export function validateFinancialPlanningPayload(
  _module: FinancialPlanningModuleKey,
  _payload: unknown,
): FinancialPlanningValidationIssue[] {
  return [];
}
