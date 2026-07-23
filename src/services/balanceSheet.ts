import { buildAssetsSummary, getAssets } from "@/services/assets";
import type { DashboardTrendPoint, FinanceSummarySnapshot } from "@/services/finance";
import { buildInvestmentBalanceSheetSummary, getInvestments } from "@/services/investments";
import { buildLiabilitiesSummary, getLiabilities } from "@/services/liabilities";
import { buildBankAccountsSummary, getBankAccounts } from "@/services/bankAccounts";
import { buildRetirementSummary, getRetirementAccounts } from "@/services/retirement";
import { buildFixedDepositsSummary, getFixedDeposits } from "@/services/fixedDeposits";
import { buildGoldHoldingsSummary, getGoldHoldings } from "@/services/goldHoldings";
import { buildSilverHoldingsSummary, getSilverHoldings } from "@/services/silverHoldings";
import { buildRealEstateSummary, getRealEstateProperties } from "@/services/realEstateProperties";
import type { Asset } from "@/types/asset";
import type { BankAccount } from "@/types/bankAccount";
import type { FixedDeposit } from "@/types/fixedDeposit";
import type { GoldHolding } from "@/types/goldHolding";
import type { Investment } from "@/types/investment";
import type { Liability } from "@/types/liability";
import type { RetirementAccount } from "@/types/retirementAccount";
import type { SilverHolding } from "@/types/silverHolding";
import type { RealEstateProperty } from "@/types/realEstateProperty";

export interface BalanceSheetSection {
  label: string;
  value: number;
  href: string;
  description: string;
}

export interface BalanceSheetCategoryTotals {
  cashAndBank: number;
  investments: number;
  retirement: number;
  fixedDeposits: number;
  goldAndSilver: number;
  realEstate: number;
  vehicles: number;
  otherAssets: number;
  homeLoan: number;
  carLoan: number;
  creditCards: number;
  personalLoan: number;
  otherLiabilities: number;
}

export interface BalanceSheetSummary extends FinanceSummarySnapshot {
  totalBalanceSheetAssets: number;
  liquidityRatio: number | null;
  investmentRatio: number;
  retirementRatio: number;
  realEstateRatio: number;
  categoryTotals: BalanceSheetCategoryTotals;
  assetSections: BalanceSheetSection[];
  liabilitySections: BalanceSheetSection[];
}

export interface BalanceSheetData {
  assets: Asset[];
  liabilities: Liability[];
  investments: Investment[];
  bankAccounts: BankAccount[];
  retirementAccounts: RetirementAccount[];
  fixedDeposits: FixedDeposit[];
  goldHoldings: GoldHolding[];
  silverHoldings: SilverHolding[];
  realEstateProperties: RealEstateProperty[];
  summary: BalanceSheetSummary;
}

export function buildBalanceSheetSummary(
  assets: Asset[],
  liabilities: Liability[],
  investments: Investment[],
  bankAccounts: BankAccount[],
  retirementAccounts: RetirementAccount[],
  fixedDeposits: FixedDeposit[],
  goldHoldings: GoldHolding[],
  silverHoldings: SilverHolding[],
  realEstateProperties: RealEstateProperty[],
): BalanceSheetSummary {
  const assetsSummary = buildAssetsSummary(assets);
  const liabilitiesSummary = buildLiabilitiesSummary(liabilities);
  const investmentsSummary = buildInvestmentBalanceSheetSummary(investments);
  const bankAccountsSummary = buildBankAccountsSummary(bankAccounts);
  const retirementSummary = buildRetirementSummary(retirementAccounts);
  const fixedDepositsSummary = buildFixedDepositsSummary(fixedDeposits);
  const goldSummary = buildGoldHoldingsSummary(goldHoldings);
  const silverSummary = buildSilverHoldingsSummary(silverHoldings);
  const realEstateSummary = buildRealEstateSummary(realEstateProperties);

  const cashAndBank = assetsSummary.totalCashLikeAssets + bankAccountsSummary.totalActiveBalance;
  const legacyRealEstate = assetsSummary.totalRealEstateAssets;
  const moduleRealEstate = realEstateSummary.totalCurrentMarketValue;
  const realEstate = moduleRealEstate > 0 ? moduleRealEstate : legacyRealEstate;
  const vehicles = assetsSummary.totalVehicleAssets;
  const otherAssets = assetsSummary.totalOtherAssets;

  const investmentBreakdown = {
    investments: assetsSummary.totalInvestmentAssets + investmentsSummary.coreInvestmentsValue,
    retirement: retirementSummary.totalRetirementAssets + investmentsSummary.retirementClassifiedValue,
    fixedDeposits: fixedDepositsSummary.totalCurrentValue + investmentsSummary.fixedDepositClassifiedValue,
    goldAndSilver: goldSummary.totalCurrentValue + silverSummary.totalCurrentValue + investmentsSummary.preciousMetalClassifiedValue,
  };

  const initialLiabilityTotals: BalanceSheetCategoryTotals = {
    cashAndBank,
    investments: investmentBreakdown.investments,
    retirement: investmentBreakdown.retirement,
    fixedDeposits: investmentBreakdown.fixedDeposits,
    goldAndSilver: investmentBreakdown.goldAndSilver,
    realEstate,
    vehicles,
    otherAssets,
    homeLoan: 0,
    carLoan: 0,
    creditCards: 0,
    personalLoan: 0,
    otherLiabilities: 0,
  };

  const categoryTotals = {
    ...initialLiabilityTotals,
    ...liabilitiesSummary.buckets,
  };

  const totalAssets = categoryTotals.cashAndBank + categoryTotals.realEstate + categoryTotals.vehicles + categoryTotals.otherAssets;
  const totalInvestments =
    categoryTotals.investments +
    categoryTotals.retirement +
    categoryTotals.fixedDeposits +
    categoryTotals.goldAndSilver;
  const totalBalanceSheetAssets = totalAssets + totalInvestments;
  const totalLiabilities = liabilitiesSummary.totalLiabilities;
  const netWorth = totalBalanceSheetAssets - totalLiabilities;
  const debtRatio = totalBalanceSheetAssets > 0 ? totalLiabilities / totalBalanceSheetAssets : 0;
  const monthlyEmi = liabilitiesSummary.totalMonthlyEmi;
  const cashHoldings = categoryTotals.cashAndBank;
  const cashRatio = totalBalanceSheetAssets > 0 ? cashHoldings / totalBalanceSheetAssets : 0;
  const liquidityRatio = totalLiabilities > 0 ? cashHoldings / totalLiabilities : null;
  const investmentRatio = totalBalanceSheetAssets > 0 ? (categoryTotals.investments + categoryTotals.fixedDeposits + categoryTotals.goldAndSilver) / totalBalanceSheetAssets : 0;
  const retirementRatio = totalBalanceSheetAssets > 0 ? categoryTotals.retirement / totalBalanceSheetAssets : 0;
  const realEstateRatio = totalBalanceSheetAssets > 0 ? categoryTotals.realEstate / totalBalanceSheetAssets : 0;

  const assetSections: BalanceSheetSection[] = [
    {
      label: "Cash & Bank",
      value: categoryTotals.cashAndBank,
      href: "/accounts",
      description: "Cash-like assets plus active bank balances.",
    },
    {
      label: "Investments",
      value: categoryTotals.investments,
      href: "/investments",
      description: "Market-linked holdings excluding retirement, fixed deposits, and precious metals.",
    },
    {
      label: "Retirement",
      value: categoryTotals.retirement,
      href: "/retirement",
      description: "Dedicated retirement accounts and retirement-classified investment holdings.",
    },
    {
      label: "Fixed Deposits",
      value: categoryTotals.fixedDeposits,
      href: "/fixed-deposits",
      description: "FD and RD values across dedicated deposits and investment-linked fixed deposits.",
    },
    {
      label: "Gold & Silver",
      value: categoryTotals.goldAndSilver,
      href: "/gold",
      description: "Precious metal holdings including gold, silver, and sovereign gold bonds.",
    },
    {
      label: "Real Estate",
      value: categoryTotals.realEstate,
      href: "/assets",
      description: "Property and land positions from the asset registry.",
    },
    {
      label: "Vehicles",
      value: categoryTotals.vehicles,
      href: "/assets",
      description: "Vehicles tracked on the balance sheet.",
    },
    {
      label: "Other Assets",
      value: categoryTotals.otherAssets,
      href: "/assets",
      description: "Residual business and other asset holdings.",
    },
  ];

  const liabilitySections: BalanceSheetSection[] = [
    {
      label: "Home Loan",
      value: categoryTotals.homeLoan,
      href: "/liabilities",
      description: "Housing debt obligations.",
    },
    {
      label: "Car Loan",
      value: categoryTotals.carLoan,
      href: "/liabilities",
      description: "Vehicle financing outstanding balances.",
    },
    {
      label: "Credit Cards",
      value: categoryTotals.creditCards,
      href: "/liabilities",
      description: "Revolving card balances.",
    },
    {
      label: "Personal Loan",
      value: categoryTotals.personalLoan,
      href: "/liabilities",
      description: "Personal loans and overdraft or line-of-credit exposures.",
    },
    {
      label: "Other Liabilities",
      value: categoryTotals.otherLiabilities,
      href: "/liabilities",
      description: "Education loans and all remaining liability obligations.",
    },
  ];

  const assetAllocation = assetSections.filter((item) => item.value > 0).map((item) => ({ name: item.label, value: item.value }));
  const liabilityAllocation = liabilitySections.filter((item) => item.value > 0).map((item) => ({ name: item.label, value: item.value }));

  const largestAsset = assetsSummary.largestAsset;
  const largestLiability = liabilitiesSummary.largestLiability;

  return {
    totalAssets,
    totalInvestments,
    totalLiabilities,
    totalBalanceSheetAssets,
    netWorth,
    debtRatio,
    monthlyEmi,
    cashHoldings,
    cashRatio,
    liquidityRatio,
    investmentRatio,
    retirementRatio,
    realEstateRatio,
    assetAllocation,
    liabilityAllocation,
    largestAsset,
    largestLiability,
    categoryTotals,
    assetSections,
    liabilitySections,
  };
}

export async function getBalanceSheetData(): Promise<BalanceSheetData> {
  const startedAt = Date.now();
  console.log("[balanceSheet] getBalanceSheetData start");

  const trace = async <T>(label: string, operation: () => Promise<T>, fallback?: T): Promise<T> => {
    const opStartedAt = Date.now();
    console.log(`[balanceSheet] ${label} start`);
    try {
      const value = await operation();
      console.log(`[balanceSheet] ${label} complete`, {
        durationMs: Date.now() - opStartedAt,
        count: Array.isArray(value) ? value.length : undefined,
      });
      return value;
    } catch (error) {
      console.error(`[balanceSheet] ${label} error`, {
        durationMs: Date.now() - opStartedAt,
        error,
      });
      if (typeof fallback !== "undefined") {
        console.log(`[balanceSheet] ${label} fallback used`);
        return fallback;
      }
      throw error;
    }
  };

  const [assets, liabilities, investments, bankAccounts, retirementAccounts, fixedDeposits, goldHoldings, silverHoldings, realEstateProperties] = await Promise.all([
    trace("getAssets", () => getAssets()),
    trace("getLiabilities", () => getLiabilities()),
    trace("getInvestments", () => getInvestments()),
    trace("getBankAccounts", () => getBankAccounts(), [] as BankAccount[]),
    trace("getRetirementAccounts", () => getRetirementAccounts(), [] as RetirementAccount[]),
    trace("getFixedDeposits", () => getFixedDeposits(), [] as FixedDeposit[]),
    trace("getGoldHoldings", () => getGoldHoldings(), [] as GoldHolding[]),
    trace("getSilverHoldings", () => getSilverHoldings(), [] as SilverHolding[]),
    trace("getRealEstateProperties", () => getRealEstateProperties(), [] as RealEstateProperty[]),
  ]);

  const payload: BalanceSheetData = {
    assets,
    liabilities,
    investments,
    bankAccounts,
    retirementAccounts,
    fixedDeposits,
    goldHoldings,
    silverHoldings,
    realEstateProperties,
    summary: buildBalanceSheetSummary(
      assets,
      liabilities,
      investments,
      bankAccounts,
      retirementAccounts,
      fixedDeposits,
      goldHoldings,
      silverHoldings,
      realEstateProperties,
    ),
  };

  console.log("[balanceSheet] getBalanceSheetData complete", {
    durationMs: Date.now() - startedAt,
    assets: payload.assets.length,
    liabilities: payload.liabilities.length,
    investments: payload.investments.length,
  });

  return payload;
}

export function buildBalanceSheetTrendFallback(summary: BalanceSheetSummary): DashboardTrendPoint[] {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const baseAssets = summary.totalAssets;
  const baseInvestments = summary.totalInvestments;
  const baseLiabilities = summary.totalLiabilities;
  const baseNetWorth = summary.netWorth;

  return months.map((month, index) => {
    const modifier = 1 - (months.length - index - 1) * 0.04;
    const seasonalOffset = Math.max(0, (index - 1) * 0.02 * Math.max(baseAssets + baseInvestments, 1));

    return {
      month,
      assets: Math.max(0, Math.round(baseAssets * modifier + seasonalOffset / 2)),
      liabilities: Math.max(0, Math.round(baseLiabilities * (0.92 + index * 0.015))),
      netWorth: Math.max(0, Math.round(baseNetWorth * modifier + seasonalOffset / 2)),
      investments: Math.max(0, Math.round(baseInvestments * modifier + seasonalOffset / 3)),
    };
  });
}