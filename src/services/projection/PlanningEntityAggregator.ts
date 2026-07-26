import type { Account } from "@/types/account";
import type { Asset } from "@/types/asset";
import type { FixedDeposit } from "@/types/fixedDeposit";
import type { GoldHolding } from "@/types/goldHolding";
import type { Investment } from "@/types/investment";
import type { Liability } from "@/types/liability";
import type { BankAccount } from "@/types/bankAccount";
import type { RealEstateProperty } from "@/types/realEstateProperty";
import type { RetirementAccount } from "@/types/retirementAccount";
import type { SilverHolding } from "@/types/silverHolding";
import type { ProjectionEntity, ProjectionEntityType, ProjectionMonthState } from "@/services/projection/ProjectionContext";

export interface LoadedProjectionData {
  assets: Asset[];
  liabilities: Liability[];
  bankAccounts: BankAccount[];
  investments: Investment[];
  realEstate: RealEstateProperty[];
  retirementAccounts: RetirementAccount[];
  fixedDeposits: FixedDeposit[];
  goldHoldings: GoldHolding[];
  silverHoldings: SilverHolding[];
  insuranceAccounts: Account[];
}

type BucketDefinition = {
  id: string;
  entityType: ProjectionEntityType;
  name: string;
  openingBalance: number;
  assumptionSource: string;
};

function roundCurrency(value: number): number {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

function createProjectionEntity(params: BucketDefinition): ProjectionEntity {
  const openingBalance = roundCurrency(params.openingBalance);

  return {
    id: params.id,
    entityType: params.entityType,
    name: params.name,
    openingBalance,
    scheduledContribution: 0,
    scheduledWithdrawal: 0,
    growth: 0,
    fees: 0,
    tax: 0,
    closingBalance: openingBalance,
    assumptionSource: params.assumptionSource,
  };
}

function cloneState(state: ProjectionMonthState): ProjectionMonthState {
  return {
    cash: roundCurrency(state.cash),
    investments: roundCurrency(state.investments),
    assets: roundCurrency(state.assets),
    liabilities: roundCurrency(state.liabilities),
    retirementCorpus: roundCurrency(state.retirementCorpus),
    projectionEntities: (state.projectionEntities ?? []).map((entity) => ({
      id: entity.id,
      entityType: entity.entityType,
      name: entity.name,
      openingBalance: roundCurrency(entity.openingBalance),
      scheduledContribution: roundCurrency(entity.scheduledContribution),
      scheduledWithdrawal: roundCurrency(entity.scheduledWithdrawal),
      growth: roundCurrency(entity.growth),
      fees: roundCurrency(entity.fees),
      tax: roundCurrency(entity.tax),
      closingBalance: roundCurrency(entity.closingBalance),
      expectedAnnualReturn: entity.expectedAnnualReturn,
      assumptionSource: entity.assumptionSource,
    })),
  };
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += Number(value ?? 0);
  }

  return roundCurrency(total);
}

function sumInvestmentCategories(investments: Investment[], categories: ReadonlySet<string>): number {
  return sum(investments.filter((investment) => categories.has(investment.category)).map((investment) => Number(investment.current_value ?? 0)));
}

function buildEntitiesFromState(state: ProjectionMonthState): ProjectionEntity[] {
  const entities: BucketDefinition[] = [];

  if (Number(state.cash ?? 0) !== 0) {
    entities.push({ id: "entity:cash:aggregate", entityType: "Cash", name: "Cash / Bank Accounts", openingBalance: Number(state.cash ?? 0), assumptionSource: "manual-opening-balances" });
  }

  if (Number(state.investments ?? 0) !== 0) {
    entities.push({ id: "entity:investments:aggregate", entityType: "MutualFund", name: "Planning Investments", openingBalance: Number(state.investments ?? 0), assumptionSource: "manual-opening-balances" });
  }

  if (Number(state.assets ?? 0) !== 0) {
    entities.push({ id: "entity:assets:aggregate", entityType: "OtherAsset", name: "Other Assets", openingBalance: Number(state.assets ?? 0), assumptionSource: "manual-opening-balances" });
  }

  if (Number(state.liabilities ?? 0) !== 0) {
    entities.push({ id: "entity:liabilities:aggregate", entityType: "OtherLiability", name: "Planning Liabilities", openingBalance: Number(state.liabilities ?? 0), assumptionSource: "manual-opening-balances" });
  }

  if (Number(state.retirementCorpus ?? 0) !== 0) {
    entities.push({ id: "entity:retirement:aggregate", entityType: "NPS", name: "Retirement Corpus", openingBalance: Number(state.retirementCorpus ?? 0), assumptionSource: "manual-opening-balances" });
  }

  if (entities.length === 0) {
    entities.push({ id: "entity:investments:aggregate", entityType: "MutualFund", name: "Planning Investments", openingBalance: 0, assumptionSource: "manual-opening-balances" });
  }

  return entities.map(createProjectionEntity);
}

function buildLiveEntities(data: LoadedProjectionData): ProjectionEntity[] {
  const cash = roundCurrency(
    sum([
      ...data.bankAccounts.filter((account) => account.status !== "closed").map((account) => Number(account.current_balance ?? 0)),
      ...data.assets.filter((asset) => ["cash", "checking", "savings"].includes(asset.asset_type)).map((asset) => Number(asset.current_value ?? 0)),
    ]),
  );

  const mutualFunds = sumInvestmentCategories(data.investments, new Set(["Mutual Funds"]));
  const stocks = sumInvestmentCategories(data.investments, new Set(["Stocks", "ETFs", "Bonds"]));
  const fixedDeposits = sum([
    ...data.fixedDeposits.map((deposit) => Number(deposit.current_value ?? 0)),
    ...data.investments.filter((investment) => investment.category === "Fixed Deposits").map((investment) => Number(investment.current_value ?? 0)),
  ]);
  const gold = sum([
    ...data.goldHoldings.map((holding) => Number(holding.current_value ?? 0)),
    ...data.investments.filter((investment) => investment.category === "Gold" || investment.category === "Sovereign Gold Bonds").map((investment) => Number(investment.current_value ?? 0)),
  ]);
  const silver = sum([
    ...data.silverHoldings.map((holding) => Number(holding.current_value ?? 0)),
    ...data.investments.filter((investment) => investment.category === "Silver").map((investment) => Number(investment.current_value ?? 0)),
  ]);
  const realEstate = sum([
    ...data.realEstate.map((property) => Number(property.current_market_value ?? 0)),
    ...data.assets.filter((asset) => asset.asset_type === "real_estate").map((asset) => Number(asset.current_value ?? 0)),
  ]);
  const epf = sum([
    ...data.retirementAccounts.filter((account) => account.account_type === "EPF").map((account) => Number(account.current_balance ?? 0)),
    ...data.investments.filter((investment) => investment.category === "EPF").map((investment) => Number(investment.current_value ?? 0)),
  ]);
  const ppf = sum([
    ...data.retirementAccounts.filter((account) => account.account_type === "PPF").map((account) => Number(account.current_balance ?? 0)),
    ...data.investments.filter((investment) => investment.category === "PPF").map((investment) => Number(investment.current_value ?? 0)),
  ]);
  const nps = sum([
    ...data.retirementAccounts.filter((account) => account.account_type === "NPS").map((account) => Number(account.current_balance ?? 0)),
    ...data.investments.filter((investment) => investment.category === "NPS").map((investment) => Number(investment.current_value ?? 0)),
  ]);
  const otherAssets = sum([
    ...data.assets.filter((asset) => ["vehicle", "business", "other"].includes(asset.asset_type)).map((asset) => Number(asset.current_value ?? 0)),
    ...data.investments
      .filter((investment) => !new Set(["Mutual Funds", "Stocks", "ETFs", "Bonds", "Fixed Deposits", "Gold", "Sovereign Gold Bonds", "Silver", "EPF", "PPF", "NPS"]).has(investment.category))
      .map((investment) => Number(investment.current_value ?? 0)),
  ]);

  function liabilityEntityType(liability: Liability): ProjectionEntityType {
    switch (liability.liability_type) {
      case "Home Loan":
        return "HomeLoan";
      case "Car Loan":
        return "CarLoan";
      case "Personal Loan":
        return "PersonalLoan";
      case "Education Loan":
        return "EducationLoan";
      case "Loan Against Property":
        return "LoanAgainstProperty";
      case "Credit Card":
        return "CreditCard";
      case "Overdraft / Line of Credit":
        return "BankOverdraft";
      case "Other Liability":
        return "OtherLiability";
      default:
        return "OtherLiability";
    }
  }

  const bucketDefinitions: BucketDefinition[] = [
    { id: "entity:cash:aggregate", entityType: "Cash", name: "Cash / Bank Accounts", openingBalance: cash, assumptionSource: "live-balance-sheet" },
    { id: "entity:mutual-funds:aggregate", entityType: "MutualFund", name: "Mutual Funds", openingBalance: mutualFunds, assumptionSource: "live-balance-sheet" },
    { id: "entity:stocks:aggregate", entityType: "Stock", name: "Stocks", openingBalance: stocks, assumptionSource: "live-balance-sheet" },
    { id: "entity:fixed-deposits:aggregate", entityType: "FixedDeposit", name: "Fixed Deposits", openingBalance: fixedDeposits, assumptionSource: "live-balance-sheet" },
    { id: "entity:gold:aggregate", entityType: "Gold", name: "Gold", openingBalance: gold, assumptionSource: "live-balance-sheet" },
    { id: "entity:silver:aggregate", entityType: "Silver", name: "Silver", openingBalance: silver, assumptionSource: "live-balance-sheet" },
    { id: "entity:real-estate:aggregate", entityType: "RealEstate", name: "Real Estate", openingBalance: realEstate, assumptionSource: "live-balance-sheet" },
    { id: "entity:epf:aggregate", entityType: "EPF", name: "EPF", openingBalance: epf, assumptionSource: "live-balance-sheet" },
    { id: "entity:ppf:aggregate", entityType: "PPF", name: "PPF", openingBalance: ppf, assumptionSource: "live-balance-sheet" },
    { id: "entity:nps:aggregate", entityType: "NPS", name: "NPS", openingBalance: nps, assumptionSource: "live-balance-sheet" },
    { id: "entity:other-assets:aggregate", entityType: "OtherAsset", name: "Other Assets", openingBalance: otherAssets, assumptionSource: "live-balance-sheet" },
  ];

  const liabilityGroups: Array<{ id: string; name: string; entityType: ProjectionEntityType; match: (liability: Liability) => boolean }> = [
    { id: "entity:home-loan:aggregate", name: "Home Loan", entityType: "HomeLoan", match: (liability) => liability.liability_type === "Home Loan" },
    { id: "entity:car-loan:aggregate", name: "Car Loan", entityType: "CarLoan", match: (liability) => liability.liability_type === "Car Loan" },
    { id: "entity:personal-loan:aggregate", name: "Personal Loan", entityType: "PersonalLoan", match: (liability) => liability.liability_type === "Personal Loan" },
    { id: "entity:lap:aggregate", name: "Loan Against Property", entityType: "LoanAgainstProperty", match: (liability) => liability.liability_type === "Loan Against Property" },
    { id: "entity:gold-loan:aggregate", name: "Gold Loan", entityType: "GoldLoan", match: (liability) => String(liability.liability_type) === "Gold Loan" },
    { id: "entity:education-loan:aggregate", name: "Education Loan", entityType: "EducationLoan", match: (liability) => liability.liability_type === "Education Loan" },
    { id: "entity:credit-cards:aggregate", name: "Credit Cards", entityType: "CreditCard", match: (liability) => liability.liability_type === "Credit Card" },
    { id: "entity:bank-overdraft:aggregate", name: "Bank Overdraft", entityType: "BankOverdraft", match: (liability) => liability.liability_type === "Overdraft / Line of Credit" },
    { id: "entity:other-liabilities:aggregate", name: "Other Liabilities", entityType: "OtherLiability", match: (liability) => liability.liability_type === "Other Liability" },
  ];

  for (const group of liabilityGroups) {
    bucketDefinitions.push({
      id: group.id,
      entityType: group.entityType,
      name: group.name,
      openingBalance: sum(data.liabilities.filter(group.match).map((liability) => Number(liability.outstanding_amount ?? 0))),
      assumptionSource: "live-balance-sheet",
    });
  }

  return bucketDefinitions.filter((bucket) => bucket.openingBalance !== 0).map(createProjectionEntity);
}

function buildMonthEndCloseEntities(values: Record<string, number>): ProjectionEntity[] {
  const bucketDefinitions: BucketDefinition[] = [
    { id: "entity:cash:aggregate", entityType: "Cash", name: "Cash / Bank Accounts", openingBalance: Number(values.bank_accounts ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:mutual-funds:aggregate", entityType: "MutualFund", name: "Mutual Funds", openingBalance: Number(values.mutual_funds ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:stocks:aggregate", entityType: "Stock", name: "Stocks", openingBalance: Number(values.stocks ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:fixed-deposits:aggregate", entityType: "FixedDeposit", name: "Fixed Deposits", openingBalance: Number(values.fixed_deposits ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:gold:aggregate", entityType: "Gold", name: "Gold", openingBalance: Number(values.gold ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:silver:aggregate", entityType: "Silver", name: "Silver", openingBalance: Number(values.silver ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:epf:aggregate", entityType: "EPF", name: "EPF", openingBalance: Number(values.epf ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:ppf:aggregate", entityType: "PPF", name: "PPF", openingBalance: Number(values.ppf ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:nps:aggregate", entityType: "NPS", name: "NPS", openingBalance: Number(values.nps ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:real-estate:aggregate", entityType: "RealEstate", name: "Real Estate", openingBalance: Number(values.real_estate ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:other-assets:aggregate", entityType: "OtherAsset", name: "Other Assets", openingBalance: Number(values.other_assets ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:home-loans:aggregate", entityType: "HomeLoan", name: "Home Loans", openingBalance: Number(values.home_loans ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:car-loans:aggregate", entityType: "CarLoan", name: "Car Loans", openingBalance: Number(values.car_loans ?? 0), assumptionSource: "month-end-close" },
    { id: "entity:other-liabilities:aggregate", entityType: "OtherLiability", name: "Other Liabilities", openingBalance: Number(values.other_liabilities ?? 0), assumptionSource: "month-end-close" },
  ];

  return bucketDefinitions.filter((bucket) => bucket.openingBalance !== 0).map(createProjectionEntity);
}

function buildOpeningStateFromLiveData(data: LoadedProjectionData): ProjectionMonthState {
  const liquidAssetCash = data.assets.reduce((sumValue, asset) => sumValue + (["cash", "checking", "savings"].includes(asset.asset_type) ? Number(asset.current_value ?? 0) : 0), 0);
  const investmentAssets = data.assets.reduce((sumValue, asset) => sumValue + (asset.asset_type === "investment" ? Number(asset.current_value ?? 0) : 0), 0);
  const legacyRealEstate = data.assets.reduce((sumValue, asset) => sumValue + (asset.asset_type === "real_estate" ? Number(asset.current_value ?? 0) : 0), 0);
  const nonInvestmentAssets = data.assets.reduce((sumValue, asset) => sumValue + (["vehicle", "business", "other"].includes(asset.asset_type) ? Number(asset.current_value ?? 0) : 0), 0);

  const bankCash = data.bankAccounts.filter((account) => account.status !== "closed").reduce((sumValue, account) => sumValue + Number(account.current_balance ?? 0), 0);
  const dedicatedRealEstate = data.realEstate.reduce((sumValue, property) => sumValue + Number(property.current_market_value ?? 0), 0);
  const retirementFromInvestments = sumInvestmentCategories(data.investments, new Set(["EPF", "PPF", "NPS"]));
  const coreInvestments = data.investments.reduce((sumValue, investment) => {
    if (["EPF", "PPF", "NPS"].includes(investment.category)) {
      return sumValue;
    }

    return sumValue + Number(investment.current_value ?? 0);
  }, 0);

  const retirementAccounts = data.retirementAccounts.reduce((sumValue, account) => sumValue + Number(account.current_balance ?? 0), 0);
  const fixedDeposits = data.fixedDeposits.reduce((sumValue, deposit) => sumValue + Number(deposit.current_value ?? 0), 0);
  const gold = data.goldHoldings.reduce((sumValue, item) => sumValue + Number(item.current_value ?? 0), 0);
  const silver = data.silverHoldings.reduce((sumValue, item) => sumValue + Number(item.current_value ?? 0), 0);
  const liabilities = data.liabilities.reduce((sumValue, liability) => sumValue + Number(liability.outstanding_amount ?? 0), 0);
  const totalInvestments = investmentAssets + coreInvestments + fixedDeposits + gold + silver;

  return cloneState({
    cash: liquidAssetCash + bankCash,
    investments: totalInvestments,
    assets: nonInvestmentAssets + (dedicatedRealEstate > 0 ? dedicatedRealEstate : legacyRealEstate),
    liabilities,
    retirementCorpus: retirementAccounts + retirementFromInvestments,
  });
}

function buildOpeningStateFromMonthEndClose(values: Record<string, number>): ProjectionMonthState {
  const investments = Number(values.mutual_funds ?? 0) + Number(values.stocks ?? 0) + Number(values.gold ?? 0) + Number(values.silver ?? 0) + Number(values.fixed_deposits ?? 0);

  return cloneState({
    cash: Number(values.bank_accounts ?? 0),
    investments,
    assets: Number(values.real_estate ?? 0) + Number(values.other_assets ?? 0),
    liabilities: Number(values.home_loans ?? 0) + Number(values.car_loans ?? 0) + Number(values.other_liabilities ?? 0),
    retirementCorpus: Number(values.epf ?? 0) + Number(values.ppf ?? 0) + Number(values.nps ?? 0),
  });
}

export class PlanningEntityAggregator {
  aggregateFromLiveData(data: LoadedProjectionData): ProjectionMonthState {
    const state = buildOpeningStateFromLiveData(data);
    state.projectionEntities = buildLiveEntities(data);
    return state;
  }

  aggregateFromMonthEndClose(values: Record<string, number>): ProjectionMonthState {
    const state = buildOpeningStateFromMonthEndClose(values);
    state.projectionEntities = buildMonthEndCloseEntities(values);
    return state;
  }

  normalizeProjectionState(state: ProjectionMonthState): ProjectionMonthState {
    const cloned = cloneState(state);
    if (cloned.projectionEntities && cloned.projectionEntities.length > 0) {
      return cloned;
    }

    cloned.projectionEntities = buildEntitiesFromState(cloned);
    return cloned;
  }
}

export const planningEntityAggregator = new PlanningEntityAggregator();