import { deepFreeze } from "../shared";

import type { RuleContext, RuleContextInput } from "./Types";

export function createRuleContext(input: RuleContextInput): RuleContext {
  return deepFreeze({
    projectionContext: input.projectionContext,
    projectionMonth: input.projectionMonth,
    facts: deepFreeze({ ...(input.facts ?? {}) }),
  });
}
