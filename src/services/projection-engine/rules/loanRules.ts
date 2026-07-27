import { calculateLoansForMonth } from "../loans";
import type { FinancialRule } from "./contracts";

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export const emiRule: FinancialRule = {
  id: "loan.emi",
  family: "loan",
  step: "loan-processing",
  priority: 10,
  appliesTo: ({ state }) => state.getLoans().length > 0,
  execute: ({ state }) => {
    const loanResult = calculateLoansForMonth(state.getLoans());
    state.applyLoanComputation({
      totalPayment: loanResult.totalPayment,
      totalInterest: loanResult.totalInterest,
      totalPrincipal: loanResult.totalPrincipal,
      nextLoans: loanResult.nextLoanStates,
    });
  },
};

export const prepaymentRule: FinancialRule = {
  id: "loan.prepayment",
  family: "loan",
  step: "loan-processing",
  priority: 20,
  appliesTo: ({ context }) => {
    return context.events.some((event) => event.enabled && event.category === "Loan Prepayment");
  },
  execute: ({ context, monthKey, state }) => {
    const prepaymentAmount = context.events
      .filter((event) => event.enabled && event.category === "Loan Prepayment" && event.startMonth === monthKey)
      .reduce((sum, event) => sum + Math.max(0, toFiniteNumber(event.amount)), 0);

    if (prepaymentAmount > 0) {
      state.applyLoanPrepayment(prepaymentAmount);
      state.recordNote("Loan prepayment applied");
    }
  },
};

export const loanRules: readonly FinancialRule[] = [
  emiRule,
  prepaymentRule,
];