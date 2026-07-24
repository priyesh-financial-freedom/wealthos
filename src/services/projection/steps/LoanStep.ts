import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";

import { annualCompoundedValue, roundCurrency } from "./step-helpers";

function monthlyInterestRate(annualRatePercent: number): number {
  const annualRate = Number(annualRatePercent ?? 0) / 100;
  if (!Number.isFinite(annualRate) || annualRate <= 0) {
    return 0;
  }

  return annualRate / 12;
}

export class LoanStep implements ProjectionStep {
  readonly id = "loan-step";

  execute(context: ProjectionContext): ProjectionContext {
    const activeLiabilities = context.liabilities.filter((liability) => liability.status !== "closed" && liability.status !== "paid_off");
    const baseEmis = activeLiabilities.reduce((sum, liability) => sum + Number(liability.emi ?? 0), 0);
    const emis = roundCurrency(annualCompoundedValue(baseEmis, context.assumptions.loans.emiIncrementRate, context.monthIndex));

    const totalOutstanding = activeLiabilities.reduce((sum, liability) => sum + Number(liability.outstanding_amount ?? 0), 0);
    const weightedAnnualRate = totalOutstanding > 0
      ? activeLiabilities.reduce((sum, liability) => {
          const outstanding = Number(liability.outstanding_amount ?? 0);
          const annualRate = Number(liability.interest_rate ?? context.assumptions.loans.averageInterestRate ?? 0);
          return sum + outstanding * annualRate;
        }, 0) / totalOutstanding
      : Number(context.assumptions.loans.averageInterestRate ?? 0);

    const loanInterest = roundCurrency(context.currentState.liabilities * monthlyInterestRate(weightedAnnualRate));
    const loanPrincipal = roundCurrency(Math.min(Math.max(0, emis - loanInterest), context.currentState.liabilities));
    const closingLiabilities = roundCurrency(Math.max(0, context.currentState.liabilities - loanPrincipal));

    return updateProjectionRecord(
      context,
      {
        emis,
        loanInterest,
        loanPrincipal,
      },
      {
        cash: roundCurrency(context.currentState.cash - emis),
        liabilities: closingLiabilities,
      },
    );
  }
}