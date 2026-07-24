import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";

import { annualCompoundedValue, getMonthNumber, isSalaryActive, roundCurrency } from "./step-helpers";

export class IncomeStep implements ProjectionStep {
  readonly id = "income-step";

  execute(context: ProjectionContext): ProjectionContext {
    const salaryActive = isSalaryActive(context);
    const salaryBase = roundCurrency(context.assumptions.income.monthlyIncome);
    const salary = salaryActive ? roundCurrency(annualCompoundedValue(salaryBase, context.assumptions.income.salaryGrowthRate, context.monthIndex)) : 0;
    const bonusBase = roundCurrency(context.assumptions.income.bonusAmount);
    const bonusMonth = Number(context.assumptions.income.bonusMonth ?? 0);
    const bonus = salaryActive && bonusMonth === getMonthNumber(context.currentMonth)
      ? roundCurrency(annualCompoundedValue(bonusBase, context.assumptions.income.annualIncrementRate, context.monthIndex))
      : 0;
    const rentalIncome = roundCurrency(context.incomeSources.reduce((sum, source) => sum + Number(source.rentalIncome ?? 0), 0));
    const businessIncome = roundCurrency(context.incomeSources.reduce((sum, source) => sum + Number(source.businessIncome ?? 0), 0));
    const otherIncome = roundCurrency(
      Number(context.assumptions.income.otherMonthlyIncome ?? 0) + context.incomeSources.reduce((sum, source) => sum + Number(source.otherIncome ?? 0), 0),
    );

    const totalIncome = salary + bonus + rentalIncome + businessIncome + otherIncome;

    return updateProjectionRecord(
      context,
      {
        salary,
        bonus,
        rentalIncome,
        businessIncome,
        otherIncome,
      },
      {
        cash: roundCurrency(context.currentState.cash + totalIncome),
      },
    );
  }
}