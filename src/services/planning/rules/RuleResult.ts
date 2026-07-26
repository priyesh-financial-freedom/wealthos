import type { FormulaReference } from "@/services/formulas";
import type { RuleTraceMetadata } from "./Types";

export interface RuleResult {
  ruleId: string;
  applied: boolean;
  reason: string;
  formulaReference: FormulaReference;
  effectiveVersion: string;
  projectionMonth: string;
  traceMetadata: Readonly<RuleTraceMetadata>;
}

export function createRuleResult(result: RuleResult): RuleResult {
  return {
    ...result,
    traceMetadata: { ...result.traceMetadata, childRuleIds: [...result.traceMetadata.childRuleIds] },
  };
}
