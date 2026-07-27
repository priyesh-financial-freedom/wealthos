import { calculateLoansForMonth } from "../loans";
import type { FinancialRule } from "../rules/contracts";
import type { ProjectionContext } from "../types";
import type { FinancialProduct, ProductValidationIssue, ProductValidationResult } from "./contracts";
import { clampNonNegative, isValidMonthKey } from "./helpers";

export interface LoanPrepaymentDefinition {
  monthKey: string;
  amount: number;
}

export interface HomeLoanProductData {
  useContextPrepaymentEvents?: boolean;
  prepayments?: readonly LoanPrepaymentDefinition[];
}

function contextLoanPrepayment(context: ProjectionContext, monthKey: string): number {
  return context.events
    .filter((event) => event.enabled && event.category === "Loan Prepayment" && event.startMonth === monthKey)
    .reduce((sum, event) => sum + clampNonNegative(event.amount), 0);
}

export class HomeLoanProduct implements FinancialProduct<HomeLoanProductData> {
  readonly id: string;

  readonly type = "home-loan";

  constructor(readonly data: HomeLoanProductData = {}, id = "product.home-loan") {
    this.id = id;
  }

  validate(): ProductValidationResult {
    const issues: ProductValidationIssue[] = [];

    for (const [index, prepayment] of (this.data.prepayments ?? []).entries()) {
      if (!isValidMonthKey(prepayment.monthKey)) {
        issues.push({ field: `prepayments[${index}].monthKey`, message: "Month key must follow YYYY-MM format." });
      }

      if (clampNonNegative(prepayment.amount) !== Number(prepayment.amount)) {
        issues.push({ field: `prepayments[${index}].amount`, message: "Prepayment amount must be non-negative." });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  getRules(): readonly FinancialRule[] {
    const emiRule: FinancialRule = {
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

    const prepaymentRule: FinancialRule = {
      id: "loan.prepayment",
      family: "loan",
      step: "loan-processing",
      priority: 20,
      appliesTo: ({ context }) => {
        const hasContextEvents = this.data.useContextPrepaymentEvents !== false
          && context.events.some((event) => event.enabled && event.category === "Loan Prepayment");
        const hasConfigured = (this.data.prepayments ?? []).length > 0;
        return hasContextEvents || hasConfigured;
      },
      execute: ({ context, monthKey, state }) => {
        let prepaymentAmount = 0;

        if (this.data.useContextPrepaymentEvents !== false) {
          prepaymentAmount += contextLoanPrepayment(context, monthKey);
        }

        prepaymentAmount += (this.data.prepayments ?? [])
          .filter((entry) => entry.monthKey === monthKey)
          .reduce((sum, entry) => sum + clampNonNegative(entry.amount), 0);

        if (prepaymentAmount > 0) {
          state.applyLoanPrepayment(prepaymentAmount);
          state.recordNote("Loan prepayment applied");
        }
      },
    };

    return [emiRule, prepaymentRule];
  }
}
