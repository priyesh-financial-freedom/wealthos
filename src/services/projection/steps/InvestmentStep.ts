import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";

import { annualRateToMonthlyRate, roundCurrency } from "./step-helpers";

export class InvestmentStep implements ProjectionStep {
  readonly id = "investment-step";

  execute(context: ProjectionContext): ProjectionContext {
    const openingInvestments = context.currentState.investments;
    const openingAssets = context.currentState.assets;
    const openingRetirementCorpus = context.currentState.retirementCorpus;
    const epfContributionRate = Number(context.assumptions.retirement.epfEmployeeContributionRate ?? 0) + Number(context.assumptions.retirement.epfEmployerContributionRate ?? 0);
    const npsContributionRate = Number(context.assumptions.retirement.npsContributionRate ?? 0);
    const salary = Number(context.currentRecord.salary ?? 0);
    const retirementContributions = roundCurrency(
      salary * ((epfContributionRate + npsContributionRate) / 100) + Number(context.assumptions.retirement.ppfMonthlyContribution ?? 0),
    );
    const investmentContributions = roundCurrency(
      Number(context.assumptions.investments.monthlySipAmount ?? 0) + Number(context.assumptions.investments.stockInvestmentAmount ?? 0) + retirementContributions,
    );

    const investmentReturns = roundCurrency(openingInvestments * annualRateToMonthlyRate(context.assumptions.investments.expectedReturnRate));
    const retirementReturns = roundCurrency(openingRetirementCorpus * annualRateToMonthlyRate(context.assumptions.investments.fixedDepositRate));
    const assetAppreciation = roundCurrency(openingAssets * annualRateToMonthlyRate(context.assumptions.investments.realEstateAppreciationRate));

    return updateProjectionRecord(
      context,
      {
        investmentContributions,
        investmentReturns: roundCurrency(investmentReturns + retirementReturns + assetAppreciation),
        retirementCorpus: roundCurrency(openingRetirementCorpus + retirementContributions + retirementReturns),
      },
      {
        cash: roundCurrency(context.currentState.cash - investmentContributions),
        investments: roundCurrency(openingInvestments + investmentContributions - retirementContributions + investmentReturns),
        assets: roundCurrency(openingAssets + assetAppreciation),
        retirementCorpus: roundCurrency(openingRetirementCorpus + retirementContributions + retirementReturns),
      },
    );
  }
}