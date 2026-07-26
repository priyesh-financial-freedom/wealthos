import { createRuleContext } from "./RuleContext";
import { createRuleResult } from "./RuleResult";
import type { RuleDefinition, RuleTraceMetadata, RuleContext, RuleOperator } from "./Types";

type LeafPredicate = (context: RuleContext) => { applied: boolean; reason: string; traceMetadata?: Partial<RuleTraceMetadata> };

function buildTraceMetadata(
  evaluationFunctionName: string,
  operator: RuleOperator | null,
  childRuleIds: readonly string[],
  traceMetadata?: Partial<RuleTraceMetadata>,
): RuleTraceMetadata {
  return {
    sourceModule: traceMetadata?.sourceModule ?? "RuleEngine",
    evaluationFunctionName,
    evaluationStrategy: childRuleIds.length > 0 ? "composite" : "leaf",
    operator,
    childRuleIds: [...childRuleIds],
    timestamp: traceMetadata?.timestamp ?? new Date().toISOString(),
  };
}

export class RuleBuilder {
  createLeafRule(metadata: Omit<RuleDefinition, "evaluate">, predicate: LeafPredicate): RuleDefinition {
    return {
      ...metadata,
      dependencies: [...metadata.dependencies],
      evaluate: (context) => {
        const outcome = predicate(context);
        return createRuleResult({
          ruleId: metadata.ruleId,
          applied: outcome.applied,
          reason: outcome.reason,
          formulaReference: metadata.formulaReference,
          effectiveVersion: metadata.version,
          projectionMonth: context.projectionMonth.monthKey,
          traceMetadata: buildTraceMetadata(metadata.evaluationFunctionName, null, metadata.dependencies, outcome.traceMetadata),
        });
      },
    };
  }

  createAndRule(metadata: Omit<RuleDefinition, "evaluate">, childRuleIds: readonly string[]): RuleDefinition {
    return {
      ...metadata,
      dependencies: [...childRuleIds],
      evaluate: (context, evaluator, trail) => {
        const childResults = childRuleIds.map((ruleId) => evaluator.evaluateRule(ruleId, context, trail));
        const applied = childResults.every((result) => result.applied);
        const reason = applied
          ? `All nested rules applied: ${childRuleIds.join(", ")}`
          : childResults.find((result) => !result.applied)?.reason ?? `One or more nested rules did not apply: ${childRuleIds.join(", ")}`;

        return createRuleResult({
          ruleId: metadata.ruleId,
          applied,
          reason,
          formulaReference: metadata.formulaReference,
          effectiveVersion: metadata.version,
          projectionMonth: context.projectionMonth.monthKey,
          traceMetadata: buildTraceMetadata(metadata.evaluationFunctionName, "AND", childRuleIds, {
            sourceModule: "RuleEngine",
            timestamp: new Date().toISOString(),
          }),
        });
      },
    };
  }

  createOrRule(metadata: Omit<RuleDefinition, "evaluate">, childRuleIds: readonly string[]): RuleDefinition {
    return {
      ...metadata,
      dependencies: [...childRuleIds],
      evaluate: (context, evaluator, trail) => {
        const childResults = childRuleIds.map((ruleId) => evaluator.evaluateRule(ruleId, context, trail));
        const appliedResult = childResults.find((result) => result.applied) ?? null;
        const applied = Boolean(appliedResult);

        return createRuleResult({
          ruleId: metadata.ruleId,
          applied,
          reason: appliedResult?.reason ?? `No nested rules applied: ${childRuleIds.join(", ")}`,
          formulaReference: metadata.formulaReference,
          effectiveVersion: metadata.version,
          projectionMonth: context.projectionMonth.monthKey,
          traceMetadata: buildTraceMetadata(metadata.evaluationFunctionName, "OR", childRuleIds, {
            sourceModule: "RuleEngine",
            timestamp: new Date().toISOString(),
          }),
        });
      },
    };
  }

  createNotRule(metadata: Omit<RuleDefinition, "evaluate">, childRuleId: string): RuleDefinition {
    return {
      ...metadata,
      dependencies: [childRuleId],
      evaluate: (context, evaluator, trail) => {
        const childResult = evaluator.evaluateRule(childRuleId, context, trail);
        return createRuleResult({
          ruleId: metadata.ruleId,
          applied: !childResult.applied,
          reason: childResult.applied ? `NOT(${childRuleId}) inverted an applied rule.` : `NOT(${childRuleId}) kept the rule inactive.`,
          formulaReference: metadata.formulaReference,
          effectiveVersion: metadata.version,
          projectionMonth: context.projectionMonth.monthKey,
          traceMetadata: buildTraceMetadata(metadata.evaluationFunctionName, "NOT", [childRuleId], {
            sourceModule: "RuleEngine",
            timestamp: new Date().toISOString(),
          }),
        });
      },
    };
  }

  buildRuleContext(input: Parameters<typeof createRuleContext>[0]) {
    return createRuleContext(input);
  }
}

export const ruleBuilder = new RuleBuilder();
