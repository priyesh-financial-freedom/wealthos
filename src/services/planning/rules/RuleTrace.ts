import type { SimulationTrace } from "../projections";

import type { RuleCategory, RuleResult } from "./Types";

export interface RuleTrace {
  ruleId: string;
  ruleName: string;
  category: RuleCategory;
  applied: boolean;
  reason: string;
  formulaReference: RuleResult["formulaReference"];
  effectiveVersion: string;
  projectionMonth: string;
  traceMetadata: RuleResult["traceMetadata"];
  timestamp: string;
}

export function createRuleTrace(input: RuleTrace): RuleTrace {
  return {
    ...input,
    traceMetadata: { ...input.traceMetadata, childRuleIds: [...input.traceMetadata.childRuleIds] },
  };
}

export function ruleTraceToSimulationTrace(trace: RuleTrace): SimulationTrace {
  return {
    ruleId: trace.ruleId,
    formula: trace.formulaReference,
    inputReferences: [trace.projectionMonth, ...trace.traceMetadata.childRuleIds],
    outputValues: { applied: trace.applied ? 1 : 0 },
    effectiveVersion: trace.effectiveVersion,
    timestamp: trace.timestamp,
    sourceModule: "RuleEngine",
  };
}
