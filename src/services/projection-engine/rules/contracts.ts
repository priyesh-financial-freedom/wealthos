import type { ProjectionContext } from "../types";
import type { MonthlyProjectionDomainState } from "./state";

export type FinancialRuleFamily =
  | "income"
  | "expense"
  | "investment"
  | "loan"
  | "asset"
  | "event";

export type FinancialRuleStep =
  | "income"
  | "expenses"
  | "events"
  | "investment-contributions"
  | "investment-growth"
  | "loan-processing"
  | "asset-appreciation";

export interface FinancialRuleExecutionInput {
  context: ProjectionContext;
  monthKey: string;
  monthIndex: number;
  state: MonthlyProjectionDomainState;
}

export interface FinancialRule {
  id: string;
  family: FinancialRuleFamily;
  step: FinancialRuleStep;
  priority: number;
  appliesTo(input: FinancialRuleExecutionInput): boolean;
  execute(input: FinancialRuleExecutionInput): void;
}

export const FINANCIAL_RULE_STEP_ORDER: readonly FinancialRuleStep[] = [
  "income",
  "expenses",
  "events",
  "investment-contributions",
  "investment-growth",
  "loan-processing",
  "asset-appreciation",
] as const;