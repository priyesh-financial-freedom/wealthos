import type { FormulaReference } from "@/services/formulas";
import type { ProjectionContext } from "../projectionContext";
import type { ProjectionMonth } from "../projections";

export type RuleCategory =
  | "Employment"
  | "Income"
  | "Expenses"
  | "Loans"
  | "Investments"
  | "Retirement"
  | "Insurance"
  | "Goals"
  | "Taxes"
  | "Cash Flow"
  | "Life Events";

export type RuleOperator = "AND" | "OR" | "NOT";

export interface RuleTraceMetadata {
  sourceModule: string;
  evaluationFunctionName: string;
  evaluationStrategy: "leaf" | "composite";
  operator: RuleOperator | null;
  childRuleIds: readonly string[];
  timestamp: string;
}

export interface RuleContext {
  projectionContext: ProjectionContext;
  projectionMonth: ProjectionMonth;
  facts: Readonly<Record<string, unknown>>;
}

export interface RuleContextInput {
  projectionContext: ProjectionContext;
  projectionMonth: ProjectionMonth;
  facts?: Readonly<Record<string, unknown>>;
}

export interface RuleResult {
  ruleId: string;
  applied: boolean;
  reason: string;
  formulaReference: FormulaReference;
  effectiveVersion: string;
  projectionMonth: string;
  traceMetadata: Readonly<RuleTraceMetadata>;
}

export interface RuleEvaluatorLike {
  evaluateRule(ruleId: string, context: RuleContext, trail?: Set<string>): RuleResult;
}

export type RuleEvaluationFunction = (context: RuleContext, evaluator: RuleEvaluatorLike, trail: Set<string>) => RuleResult;

export interface RuleMetadata {
  ruleId: string;
  ruleName: string;
  description: string;
  category: RuleCategory;
  priority: number;
  effectiveDate: string;
  expiryDate: string | null;
  version: string;
  formulaReference: FormulaReference;
  dependencies: readonly string[];
  evaluationFunctionName: string;
  enabled: boolean;
}

export interface RuleDefinition extends RuleMetadata {
  evaluate: RuleEvaluationFunction;
}

export interface RuleEngineResult {
  results: readonly RuleResult[];
  traces: readonly import("./RuleTrace").RuleTrace[];
  simulationTraces: readonly import("@/services/planning/projections").SimulationTrace[];
}
