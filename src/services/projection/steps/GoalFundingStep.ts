import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";

import { roundCurrency } from "./step-helpers";

export class GoalFundingStep implements ProjectionStep {
  readonly id = "goal-funding-step";

  execute(context: ProjectionContext): ProjectionContext {
    const essentialOutflows =
      Number(context.currentRecord.livingExpenses ?? 0) +
      Number(context.currentRecord.insurancePremium ?? 0) +
      Number(context.currentRecord.emis ?? 0);
    const emergencyTarget = roundCurrency(essentialOutflows * Number(context.effectiveAssumptions.emergencyCorpusMonths ?? 0));
    const availableCash = Math.max(0, context.currentState.cash - emergencyTarget);
    const goalFunding = context.goals.length > 0 ? roundCurrency(availableCash * 0.1) : 0;

    return updateProjectionRecord(
      context,
      {
        goalFunding,
        emergencyFund: roundCurrency(Math.min(Math.max(0, context.currentState.cash - goalFunding), emergencyTarget)),
      },
      {
        cash: roundCurrency(context.currentState.cash - goalFunding),
      },
    );
  }
}