import { updateProjectionRecord, type ProjectionContext } from "@/services/projection/ProjectionContext";
import type { ProjectionStep } from "@/services/projection/steps/ProjectionStep";

import { roundCurrency } from "./step-helpers";

export class NetWorthStep implements ProjectionStep {
  readonly id = "net-worth-step";

  execute(context: ProjectionContext): ProjectionContext {
    const closingCash = roundCurrency(context.currentState.cash);
    const closingInvestments = roundCurrency(context.currentState.investments);
    const closingAssets = roundCurrency(context.currentState.assets);
    const closingLiabilities = roundCurrency(context.currentState.liabilities);
    const retirementCorpus = roundCurrency(context.currentState.retirementCorpus);
    const closingNetWorth = roundCurrency(closingCash + closingInvestments + closingAssets + retirementCorpus - closingLiabilities);
    const liquidityDenominator =
      Number(context.currentRecord.livingExpenses ?? 0) +
      Number(context.currentRecord.insurancePremium ?? 0) +
      Number(context.currentRecord.emis ?? 0) +
      Number(context.currentRecord.taxes ?? 0);
    const liquidity = liquidityDenominator > 0 ? roundCurrency(closingCash / liquidityDenominator) : 0;

    return updateProjectionRecord(context, {
      closingCash,
      closingInvestments,
      closingAssets,
      closingLiabilities,
      closingNetWorth,
      liquidity,
      retirementCorpus,
    });
  }
}