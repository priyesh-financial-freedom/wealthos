import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";

import { roundCurrency } from "./step-helpers";

export class InsuranceStep implements ProjectionStep {
  readonly id = "insurance-step";

  execute(context: ProjectionContext): ProjectionContext {
    const insurancePremium = roundCurrency(
      context.insurancePolicies.reduce((sum, policy) => {
        const monthlyPremium = Number(policy.monthlyPremium ?? 0);
        const annualPremium = Number(policy.annualPremium ?? 0);
        return sum + (monthlyPremium > 0 ? monthlyPremium : annualPremium / 12);
      }, 0),
    );

    return updateProjectionRecord(
      context,
      { insurancePremium },
      {
        cash: roundCurrency(context.currentState.cash - insurancePremium),
      },
    );
  }
}