import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";

import { annualRateToMonthlyRate, roundCurrency } from "./step-helpers";

function average(values: number[]): number {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (validValues.length === 0) {
    return 0;
  }

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

export class InvestmentStep implements ProjectionStep {
  readonly id = "investment-step";

  execute(context: ProjectionContext): ProjectionContext {
    const openingInvestments = context.currentState.investments;
    const openingAssets = context.currentState.assets;
    const openingCash = context.currentState.cash;
    const openingRetirementCorpus = context.currentState.retirementCorpus;
    const openingGoldHoldings = roundCurrency(context.goldHoldings.reduce((sum, holding) => sum + Number(holding.current_value ?? 0), 0));
    const nonGoldInvestments = roundCurrency(Math.max(0, openingInvestments - openingGoldHoldings));
    const epfContributionRate = Number(context.assumptions.retirement.epfEmployeeContributionRate ?? 0) + Number(context.assumptions.retirement.epfEmployerContributionRate ?? 0);
    const npsContributionRate = Number(context.assumptions.retirement.npsContributionRate ?? 0);
    const salary = Number(context.currentRecord.salary ?? 0);
    const epfContribution = roundCurrency(salary * (epfContributionRate / 100));
    const npsContribution = roundCurrency(salary * (npsContributionRate / 100));
    const ppfContribution = roundCurrency(Number(context.assumptions.retirement.ppfMonthlyContribution ?? 0));
    const retirementContributions = roundCurrency(epfContribution + npsContribution + ppfContribution);
    const investmentContributions = roundCurrency(
      Number(context.assumptions.investments.monthlySipAmount ?? 0) + Number(context.assumptions.investments.stockInvestmentAmount ?? 0) + retirementContributions,
    );

    const investmentReturns = roundCurrency(
      nonGoldInvestments * annualRateToMonthlyRate(context.effectiveAssumptions.equityReturn) +
      openingGoldHoldings * annualRateToMonthlyRate(context.effectiveAssumptions.goldReturn),
    );
    const retirementAnnualRate = average([
      context.effectiveAssumptions.epfReturn,
      context.effectiveAssumptions.ppfReturn,
      average([context.effectiveAssumptions.npsEquityReturn, context.effectiveAssumptions.npsDebtReturn]),
    ]);
    const retirementReturns = roundCurrency(openingRetirementCorpus * annualRateToMonthlyRate(retirementAnnualRate));
    const cashReturns = roundCurrency(openingCash * annualRateToMonthlyRate(context.effectiveAssumptions.cashReturn));
    const assetAppreciation = roundCurrency(openingAssets * annualRateToMonthlyRate(context.assumptions.investments.realEstateAppreciationRate));

    return updateProjectionRecord(
      context,
      {
        investmentContributions,
        investmentReturns: roundCurrency(investmentReturns + retirementReturns + assetAppreciation),
        retirementCorpus: roundCurrency(openingRetirementCorpus + retirementContributions + retirementReturns),
      },
      {
        cash: roundCurrency(openingCash - investmentContributions + cashReturns),
        investments: roundCurrency(openingInvestments + investmentContributions - retirementContributions + investmentReturns),
        assets: roundCurrency(openingAssets + assetAppreciation),
        retirementCorpus: roundCurrency(openingRetirementCorpus + retirementContributions + retirementReturns),
      },
    );
  }
}