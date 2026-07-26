import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";
import { calculateLoanMonth } from "@/services/planning/LoanCalculator";
import { isSupportedLoanType } from "@/services/planning/LoanTypes";

import { annualCompoundedValue, roundCurrency } from "./step-helpers";

export class LoanStep implements ProjectionStep {
  readonly id = "loan-step";

  execute(context: ProjectionContext): ProjectionContext {
    const activeLiabilities = context.liabilities.filter(
      (liability) => liability.status !== "closed" && liability.status !== "paid_off" && isSupportedLoanType(liability.liability_type),
    );

    const totalOutstanding = activeLiabilities.reduce((sum, liability) => sum + Number(liability.outstanding_amount ?? 0), 0);
    const annualPrepaymentAmount = context.assumptions.loans.useExtraCashForPrepayment && Number(context.assumptions.loans.annualPrepaymentMonth ?? 0) === Number(context.currentMonth.slice(5, 7))
      ? Number(context.assumptions.loans.annualPrepaymentAmount ?? 0)
      : 0;

    const loanRows = activeLiabilities.map((liability) => {
      const openingBalance = Number(liability.outstanding_amount ?? 0);
      const prepaymentShare = totalOutstanding > 0 ? annualPrepaymentAmount * (openingBalance / totalOutstanding) : 0;

      return calculateLoanMonth({
        loanId: liability.id,
        loanType: liability.liability_type,
        monthKey: context.currentMonth,
        openingBalance,
        annualInterestRate: Number(liability.interest_rate ?? context.assumptions.loans.averageInterestRate ?? 0),
        emi: Number(liability.emi ?? 0),
        monthsRemaining: Number(liability.tenure_months ?? 0) || null,
        prepaymentAmount: prepaymentShare,
        prepaymentMonth: annualPrepaymentAmount > 0 ? context.currentMonth : null,
        prepaymentMode: "REDUCE_TENURE",
      });
    });

    const baseEmis = loanRows.reduce((sum, row) => sum + Number(row.emi ?? 0), 0);
    const emis = roundCurrency(annualCompoundedValue(baseEmis, context.assumptions.loans.emiIncrementRate, context.monthIndex));
    const loanInterest = roundCurrency(loanRows.reduce((sum, row) => sum + Number(row.interest ?? 0), 0));
    const loanPrincipal = roundCurrency(loanRows.reduce((sum, row) => sum + Number(row.principal ?? 0), 0));
    const closingLiabilities = roundCurrency(loanRows.reduce((sum, row) => sum + Number(row.closingBalance ?? 0), 0));

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