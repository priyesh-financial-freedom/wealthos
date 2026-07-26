import type {
  MonthlyLedger,
  MonthlyLedgerBuildInput,
  MonthlyLedgerCreateVersionInput,
  MonthlyLedgerRecord,
} from "./Types";

function nowIso(): string {
  return new Date().toISOString();
}

function withDefaults(input: MonthlyLedgerBuildInput): MonthlyLedgerRecord {
  const values = input.values ?? {};

  return {
    month: input.month,
    openingCash: values.openingCash ?? 0,
    openingAssets: values.openingAssets ?? 0,
    openingLiabilities: values.openingLiabilities ?? 0,
    openingNetWorth: values.openingNetWorth ?? 0,
    salary: values.salary ?? 0,
    bonus: values.bonus ?? 0,
    consultingIncome: values.consultingIncome ?? 0,
    rentalIncome: values.rentalIncome ?? 0,
    dividendIncome: values.dividendIncome ?? 0,
    interestIncome: values.interestIncome ?? 0,
    expenses: values.expenses ?? 0,
    inflation: values.inflation ?? 0,
    emi: values.emi ?? 0,
    tax: values.tax ?? 0,
    epfContribution: values.epfContribution ?? 0,
    ppfContribution: values.ppfContribution ?? 0,
    npsContribution: values.npsContribution ?? 0,
    mutualFundSip: values.mutualFundSip ?? 0,
    stockInvestment: values.stockInvestment ?? 0,
    fdInvestment: values.fdInvestment ?? 0,
    goldInvestment: values.goldInvestment ?? 0,
    investmentGrowth: values.investmentGrowth ?? 0,
    loanInterest: values.loanInterest ?? 0,
    loanPrincipal: values.loanPrincipal ?? 0,
    goalFunding: values.goalFunding ?? 0,
    retirementCorpus: values.retirementCorpus ?? 0,
    emergencyFund: values.emergencyFund ?? 0,
    closingCash: values.closingCash ?? 0,
    closingAssets: values.closingAssets ?? 0,
    closingLiabilities: values.closingLiabilities ?? 0,
    closingNetWorth: values.closingNetWorth ?? 0,
  };
}

export class LedgerBuilder {
  buildRecord(input: MonthlyLedgerBuildInput): MonthlyLedgerRecord {
    return withDefaults(input);
  }

  buildVersion(input: MonthlyLedgerCreateVersionInput): MonthlyLedger {
    const createdAt = nowIso();

    return {
      id: input.id,
      version: input.version,
      effectiveDate: input.effectiveDate,
      createdAt,
      updatedAt: createdAt,
      isActive: input.isActive ?? true,
      futureEffectiveDate: input.futureEffectiveDate ?? null,
      projectionContextId: input.projectionContextId ?? null,
      scenarioId: input.scenarioId ?? null,
      records: (input.records ?? []).map((record) => ({ ...record })),
    };
  }
}

export const ledgerBuilder = new LedgerBuilder();
