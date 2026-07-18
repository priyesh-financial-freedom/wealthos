import { getAssets } from "@/services/assets";
import type { DashboardTrendPoint, FinanceSummarySnapshot } from "@/services/finance";
import { getInvestments } from "@/services/investments";
import { getLiabilities } from "@/services/liabilities";
import { getBankAccounts } from "@/services/bankAccounts";
import { getRetirementAccounts } from "@/services/retirement";
import { getFixedDeposits } from "@/services/fixedDeposits";
import { getGoldHoldings } from "@/services/goldHoldings";
import { getSilverHoldings } from "@/services/silverHoldings";
import type { Asset } from "@/types/asset";
import type { BankAccount } from "@/types/bankAccount";
import type { FixedDeposit } from "@/types/fixedDeposit";
import type { GoldHolding } from "@/types/goldHolding";
import type { Investment, InvestmentCategory } from "@/types/investment";
import type { Liability, LiabilityType } from "@/types/liability";
import type { RetirementAccount } from "@/types/retirementAccount";
import type { SilverHolding } from "@/types/silverHolding";

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
  summary: BalanceSheetSummary;
}

const cashAssetTypes = new Set(["cash", "checking", "savings"]);
const retirementInvestmentCategories = new Set<InvestmentCategory>(["EPF", "PPF", "NPS"]);
const fixedDepositCategories = new Set<InvestmentCategory>(["Fixed Deposits"]);
const goldAndSilverCategories = new Set<InvestmentCategory>(["Gold", "Silver", "Sovereign Gold Bonds"]);

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function calculateInvestmentBreakdown(
  assets: Asset[],
  investments: Investment[],
  retirementAccounts: RetirementAccount[],
  fixedDeposits: FixedDeposit[],
  goldHoldings: GoldHolding[],
  silverHoldings: SilverHolding[],
) {
  const assetInvestmentValue = sum(
    assets.filter((asset) => asset.asset_type === "investment").map((asset) => Number(asset.current_value ?? 0)),
  );

  const investmentBreakdown = investments.reduce(
    (acc, investment) => {
      const currentValue = Number(investment.current_value ?? 0);

      if (retirementInvestmentCategories.has(investment.category)) {
        acc.retirement += currentValue;
      } else if (fixedDepositCategories.has(investment.category)) {
        acc.fixedDeposits += currentValue;
      } else if (goldAndSilverCategories.has(investment.category)) {
        acc.goldAndSilver += currentValue;
      } else {
        acc.investments += currentValue;
      }

      return acc;
    },
    {
      investments: assetInvestmentValue,
      retirement: sum(retirementAccounts.map((account) => Number(account.current_value ?? 0))),
      fixedDeposits: sum(fixedDeposits.map((account) => Number(account.current_value ?? 0))),
      goldAndSilver:
        sum(goldHoldings.map((holding) => Number(holding.current_value ?? 0))) +
        sum(silverHoldings.map((holding) => Number(holding.current_value ?? 0))),
    },
  );

  return investmentBreakdown;
}

function liabilityBucket(type: LiabilityType) {
  switch (type) {
    case "Home Loan":
      return "homeLoan" as const;
    case "Car Loan":
      return "carLoan" as const;
    case "Credit Card":
      return "creditCards" as const;
    case "Personal Loan":
      return "personalLoan" as const;
    case "Education Loan":
    case "Other":
    default:
      return "otherLiabilities" as const;
  }
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
): BalanceSheetSummary {
  const cashAndBank =
    sum(assets.filter((asset) => cashAssetTypes.has(asset.asset_type)).map((asset) => Number(asset.current_value ?? 0))) +
    sum(bankAccounts.filter((account) => account.status !== "closed").map((account) => Number(account.current_balance ?? 0)));

  const realEstate = sum(assets.filter((asset) => asset.asset_type === "real_estate").map((asset) => Number(asset.current_value ?? 0)));
  const vehicles = sum(assets.filter((asset) => asset.asset_type === "vehicle").map((asset) => Number(asset.current_value ?? 0)));
  const otherAssets = sum(
    assets
      .filter((asset) => asset.asset_type === "business" || asset.asset_type === "other")
      .map((asset) => Number(asset.current_value ?? 0)),
  );

  const investmentBreakdown = calculateInvestmentBreakdown(
    assets,
    investments,
    retirementAccounts,
    fixedDeposits,
    goldHoldings,
    silverHoldings,
  );

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

  const categoryTotals = liabilities.reduce((acc, liability) => {
    const bucket = liabilityBucket(liability.liability_type);
    acc[bucket] += Number(liability.outstanding_amount ?? 0);
    return acc;
  }, initialLiabilityTotals);

  const totalAssets = categoryTotals.cashAndBank + categoryTotals.realEstate + categoryTotals.vehicles + categoryTotals.otherAssets;
  const totalInvestments =
    categoryTotals.investments +
    categoryTotals.retirement +
    categoryTotals.fixedDeposits +
    categoryTotals.goldAndSilver;
  const totalBalanceSheetAssets = totalAssets + totalInvestments;
  const totalLiabilities =
    categoryTotals.homeLoan +
    categoryTotals.carLoan +
    categoryTotals.creditCards +
    categoryTotals.personalLoan +
    categoryTotals.otherLiabilities;
  const netWorth = totalBalanceSheetAssets - totalLiabilities;
  const debtRatio = totalBalanceSheetAssets > 0 ? totalLiabilities / totalBalanceSheetAssets : 0;
  const monthlyEmi = liabilities.reduce((total, liability) => total + Number(liability.emi ?? 0), 0);
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
      description: "Unsecured personal borrowing.",
    },
    {
      label: "Other Liabilities",
      value: categoryTotals.otherLiabilities,
      href: "/liabilities",
      description: "Education loans and all remaining liabilities.",
    },
  ];

  const assetAllocation = assetSections.filter((item) => item.value > 0).map((item) => ({ name: item.label, value: item.value }));
  const liabilityAllocation = liabilitySections.filter((item) => item.value > 0).map((item) => ({ name: item.label, value: item.value }));

  const largestAsset = assets.reduce<Asset | null>((current, asset) => {
    if (!current || Number(asset.current_value ?? 0) > Number(current.current_value ?? 0)) {
      return asset;
    }
    return current;
  }, null);

  const largestLiability = liabilities.reduce<Liability | null>((current, liability) => {
    if (!current || Number(liability.outstanding_amount ?? 0) > Number(current.outstanding_amount ?? 0)) {
      return liability;
    }
    return current;
  }, null);

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
  const [assets, liabilities, investments, bankAccounts, retirementAccounts, fixedDeposits, goldHoldings, silverHoldings] = await Promise.all([
    getAssets(),
    getLiabilities(),
    getInvestments(),
    getBankAccounts().catch(() => []),
    getRetirementAccounts().catch(() => []),
    getFixedDeposits().catch(() => []),
    getGoldHoldings().catch(() => []),
    getSilverHoldings().catch(() => []),
  ]);

  return {
    assets,
    liabilities,
    investments,
    bankAccounts,
    retirementAccounts,
    fixedDeposits,
    goldHoldings,
    silverHoldings,
    summary: buildBalanceSheetSummary(
      assets,
      liabilities,
      investments,
      bankAccounts,
      retirementAccounts,
      fixedDeposits,
      goldHoldings,
      silverHoldings,
    ),
  };
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