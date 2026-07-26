import type { SimulationTrace } from "../projections";
import { deepFreeze } from "../shared";

import { ruleTraceToSimulationTrace, type RuleTrace } from "./RuleTrace";
import type { RuleContext, RuleEngineResult, RuleResult } from "./Types";
import { RuleEvaluator } from "./RuleEvaluator";
import { RuleRegistry } from "./RuleRegistry";

export class RuleEngine {
  private readonly evaluator: RuleEvaluator;

  constructor(private readonly registry: RuleRegistry) {
    this.evaluator = new RuleEvaluator(registry);
  }

  evaluate(context: RuleContext, ruleIds?: readonly string[]): RuleEngineResult {
    const selectedRules = (ruleIds ? ruleIds.map((ruleId) => this.registry.get(ruleId)) : this.registry.list())
      .slice()
      .sort((left, right) => (left.priority - right.priority) || left.ruleId.localeCompare(right.ruleId));

    const results: RuleResult[] = [];
    const traces: RuleTrace[] = [];
    const simulationTraces: SimulationTrace[] = [];
    const seen = new Set<string>();

    for (const rule of selectedRules) {
      const result = this.evaluator.evaluateRule(rule.ruleId, context);
      if (!seen.has(result.ruleId)) {
        seen.add(result.ruleId);
        results.push(result);

        const trace: RuleTrace = {
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          category: rule.category,
          applied: result.applied,
          reason: result.reason,
          formulaReference: result.formulaReference,
          effectiveVersion: result.effectiveVersion,
          projectionMonth: result.projectionMonth,
          traceMetadata: result.traceMetadata,
          timestamp: result.traceMetadata.timestamp,
        };

        traces.push(trace);
        simulationTraces.push(ruleTraceToSimulationTrace(trace));
      }
    }

    return deepFreeze({
      results: deepFreeze(results.slice()),
      traces: deepFreeze(traces.slice()),
      simulationTraces: deepFreeze(simulationTraces.slice()),
    });
  }

  evaluateRule(ruleId: string, context: RuleContext): RuleResult {
    return this.evaluator.evaluateRule(ruleId, context);
  }
}
