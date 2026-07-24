import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";

import { annualCompoundedValue, roundCurrency } from "./step-helpers";

export class ExpenseStep implements ProjectionStep {
  readonly id = "expense-step";

  execute(context: ProjectionContext): ProjectionContext {
    const baseExpenses = context.expenses.reduce((sum, expense) => sum + Number(expense.monthlyAmount ?? 0), 0);
    const livingExpenses = roundCurrency(annualCompoundedValue(baseExpenses, context.assumptions.inflation.generalInflationRate, context.monthIndex));

    return updateProjectionRecord(
      context,
      { livingExpenses },
      {
        cash: roundCurrency(context.currentState.cash - livingExpenses),
      },
    );
  }
}