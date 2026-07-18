import type { Asset } from "@/types/asset";
import type { Liability } from "@/types/liability";

export interface AllocationItem {
  name: string;
  value: number;
}

export interface DashboardTrendPoint {
  month: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  investments: number;
}

export interface ExecutiveInsight {
  title: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}

export interface FinanceSummarySnapshot {
  totalAssets: number;
  totalInvestments: number;
  totalLiabilities: number;
  netWorth: number;
  debtRatio: number;
  monthlyEmi: number;
  cashHoldings: number;
  cashRatio: number;
  assetAllocation: AllocationItem[];
  liabilityAllocation: AllocationItem[];
  largestAsset: Asset | null;
  largestLiability: Liability | null;
}

export interface FinancialHealthFactor {
  label: string;
  value: string;
  tone: "positive" | "warning" | "neutral";
}

export interface FinancialHealthSnapshot {
  score: number;
  label: string;
  detail: string;
  factors: FinancialHealthFactor[];
}

interface LiquidHoldingLike {
  current_value?: number | null;
  asset_type?: string | null;
  category?: string | null;
}

const liquidAssetTypes = new Set(["cash", "checking", "savings"]);
const liquidInvestmentCategories = new Set(["Cash Equivalents"]);

export function calculateAssets(assets: Asset[]): number {
  return assets.reduce((sum, asset) => sum + Number(asset.current_value ?? 0), 0);
}

export function calculateLiabilities(liabilities: Liability[]): number {
  return liabilities.reduce((sum, liability) => sum + Number(liability.outstanding_amount ?? 0), 0);
}

export function calculateMonthlyEmi(liabilities: Liability[]): number {
  return liabilities.reduce((sum, liability) => sum + Number(liability.emi ?? 0), 0);
}

export function calculateInvestments(investments: Array<LiquidHoldingLike>): number {
  return investments.reduce((sum, investment) => sum + Number(investment.current_value ?? 0), 0);
}

export function calculateCashHoldings(assets: Array<LiquidHoldingLike>, investments: Array<LiquidHoldingLike> = []): number {
  const assetCash = assets.reduce((sum, asset) => sum + (liquidAssetTypes.has(asset.asset_type ?? "") ? Number(asset.current_value ?? 0) : 0), 0);
  const investmentCash = investments.reduce((sum, investment) => sum + (liquidInvestmentCategories.has(investment.category ?? "") ? Number(investment.current_value ?? 0) : 0), 0);

  return assetCash + investmentCash;
}

export function calculateNetWorth(totalAssets: number, totalLiabilities: number): number {
  return totalAssets - totalLiabilities;
}

export function calculateDebtRatio(totalAssets: number, totalLiabilities: number): number {
  if (totalAssets <= 0) {
    return 0;
  }

  return totalLiabilities / totalAssets;
}

export function calculateAssetAllocation(assets: Asset[]): AllocationItem[] {
  const grouped = assets.reduce<Record<string, number>>((acc, asset) => {
    const key = asset.asset_type || "other";
    acc[key] = (acc[key] ?? 0) + Number(asset.current_value ?? 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, value]) => ({ name: formatAssetName(name), value }))
    .sort((left, right) => right.value - left.value);
}

export function calculateLiabilityAllocation(liabilities: Liability[]): AllocationItem[] {
  const grouped = liabilities.reduce<Record<string, number>>((acc, liability) => {
    const key = liability.liability_type || "Other";
    acc[key] = (acc[key] ?? 0) + Number(liability.outstanding_amount ?? 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

export function buildDashboardSummary(assets: Asset[], liabilities: Liability[], investments: Array<LiquidHoldingLike> = []): FinanceSummarySnapshot {
  const totalAssets = calculateAssets(assets);
  const totalInvestments = calculateInvestments(investments);
  const totalLiabilities = calculateLiabilities(liabilities);
  const netWorth = calculateNetWorth(totalAssets + totalInvestments, totalLiabilities);
  const debtRatio = calculateDebtRatio(totalAssets, totalLiabilities);
  const monthlyEmi = calculateMonthlyEmi(liabilities);
  const cashHoldings = calculateCashHoldings(assets, investments);
  const cashRatio = totalAssets + totalInvestments > 0 ? cashHoldings / (totalAssets + totalInvestments) : 0;
  const assetAllocation = calculateAssetAllocation(assets);
  const liabilityAllocation = calculateLiabilityAllocation(liabilities);

  const largestAsset = assets.reduce<Asset | null>((current, asset) => {
    if (!current || Number(asset.current_value) > Number(current.current_value)) {
      return asset;
    }
    return current;
  }, null);

  const largestLiability = liabilities.reduce<Liability | null>((current, liability) => {
    if (!current || Number(liability.outstanding_amount) > Number(current.outstanding_amount)) {
      return liability;
    }
    return current;
  }, null);

  return {
    totalAssets,
    totalInvestments,
    totalLiabilities,
    netWorth,
    debtRatio,
    monthlyEmi,
    cashHoldings,
    cashRatio,
    assetAllocation,
    liabilityAllocation,
    largestAsset,
    largestLiability,
  };
}

export function getTopAssets(assets: Asset[], limit = 10): Asset[] {
  return [...assets].sort((left, right) => Number(right.current_value ?? 0) - Number(left.current_value ?? 0)).slice(0, limit);
}

export function getRecentAssets(assets: Asset[], limit = 3): Asset[] {
  return [...assets].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()).slice(0, limit);
}

export function getRecentLiabilities(liabilities: Liability[], limit = 3): Liability[] {
  return [...liabilities].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()).slice(0, limit);
}

export function buildTrendData(assets: Asset[], liabilities: Liability[], investments: Array<LiquidHoldingLike> = []): DashboardTrendPoint[] {
  const baseAssets = calculateAssets(assets);
  const baseInvestments = calculateInvestments(investments);
  const baseLiabilities = calculateLiabilities(liabilities);
  const baseNetWorth = calculateNetWorth(baseAssets + baseInvestments, baseLiabilities);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

  return months.map((month, index) => {
    const modifier = 1 - (months.length - index - 1) * 0.04;
    const seasonalOffset = Math.max(0, (index - 1) * 0.02 * Math.max(baseAssets, 1));

    return {
      month,
      assets: Math.max(0, Math.round((baseAssets + baseInvestments) * modifier + seasonalOffset)),
      liabilities: Math.max(0, Math.round(baseLiabilities * (0.92 + index * 0.015))),
      netWorth: Math.max(0, Math.round(baseNetWorth * modifier + seasonalOffset / 2)),
      investments: Math.max(0, Math.round(baseInvestments * modifier + seasonalOffset / 3)),
    };
  });
}

export function buildExecutiveInsights(summary: FinanceSummarySnapshot, assets: Asset[], liabilities: Liability[], investments: Array<LiquidHoldingLike> = []): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = [];
  const realEstateShare = getShareForAllocation(summary.assetAllocation, "Real Estate");
  const cashShare = getShareForAllocation(summary.assetAllocation, "Cash & Bank") || getShareForAllocation(summary.assetAllocation, "Cash");
  const homeLoanShare = getShareForAllocation(summary.liabilityAllocation, "Home Loan");

  if (summary.debtRatio <= 0.35) {
    insights.push({ title: "Debt ratio is healthy", detail: `Your debt ratio is ${(summary.debtRatio * 100).toFixed(1)}%, leaving room for new capital deployment.`, tone: "positive" });
  } else {
    insights.push({ title: "Debt ratio needs attention", detail: `Your debt ratio is ${(summary.debtRatio * 100).toFixed(1)}%. Consider prioritizing repayment or refinancing.`, tone: "warning" });
  }

  if (realEstateShare >= 0.3) {
    insights.push({ title: "Real estate is a major pillar", detail: `Real estate represents ${(realEstateShare * 100).toFixed(0)}% of your wealth.`, tone: "neutral" });
  }

  if (cashShare < 0.1) {
    insights.push({ title: "Cash allocation is below target", detail: `Cash allocation is only ${(cashShare * 100).toFixed(0)}%, which may limit near-term flexibility.`, tone: "warning" });
  }

  if (summary.cashRatio >= 0.1) {
    insights.push({ title: "Liquidity is healthy", detail: `${(summary.cashRatio * 100).toFixed(0)}% of capital is parked in cash or cash equivalents.`, tone: "positive" });
  }

  if (summary.totalInvestments > 0) {
    insights.push({ title: "Investments are contributing to net worth", detail: `Investments now contribute $${summary.totalInvestments.toLocaleString()} to your balance sheet.`, tone: "neutral" });
  }

  if (investments.length > 0) {
    insights.push({ title: "Portfolio breadth is visible", detail: `You are tracking ${investments.length} live investment positions alongside your balance sheet.`, tone: "neutral" });
  }

  if (homeLoanShare >= 0.5) {
    insights.push({ title: "Home loan concentration", detail: `Home loan forms ${(homeLoanShare * 100).toFixed(0)}% of liabilities.`, tone: "neutral" });
  }

  if (summary.monthlyEmi > 0) {
    insights.push({ title: "Cash flow commitment", detail: `Monthly EMI obligations total $${summary.monthlyEmi.toLocaleString()} per month across ${liabilities.length} liabilities.`, tone: "neutral" });
  }

  if (assets.length === 0 && liabilities.length === 0) {
    insights.push({ title: "Start with a foundation", detail: "Add your first asset and liability to unlock dashboard insights.", tone: "neutral" });
  }

  return insights.slice(0, 4);
}

export function buildFinancialHealthScore({
  summary,
  latestMonthlyGrowth,
  largestAssetShare,
  largestInvestmentShare,
}: {
  summary: FinanceSummarySnapshot;
  latestMonthlyGrowth: number;
  largestAssetShare: number;
  largestInvestmentShare: number;
}): FinancialHealthSnapshot {
  const netWorthBase = Math.max(Math.abs(summary.netWorth), 1);
  const debtPenalty = Math.min(40, summary.debtRatio * 50);
  const cashPenalty = summary.cashRatio < 0.08 ? Math.min(18, (0.08 - summary.cashRatio) * 180) : 0;
  const growthBonus = latestMonthlyGrowth > 0 ? Math.min(8, latestMonthlyGrowth / netWorthBase * 12) : Math.max(-8, latestMonthlyGrowth / netWorthBase * 12);
  const concentrationPenalty = Math.min(18, Math.max(0, largestAssetShare - 0.35) * 80 + Math.max(0, largestInvestmentShare - 0.35) * 80);
  const liquidityBonus = summary.cashRatio >= 0.15 ? 6 : summary.cashRatio >= 0.1 ? 3 : 0;

  const rawScore = 82 - debtPenalty - cashPenalty - concentrationPenalty + growthBonus + liquidityBonus;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const label = score >= 85 ? "Strong" : score >= 70 ? "Stable" : score >= 55 ? "Watch" : "At risk";
  const detail =
    score >= 85
      ? "Balance sheet quality is strong with healthy liquidity and manageable concentration."
      : score >= 70
        ? "The balance sheet is stable, but one or two levers could improve resilience."
        : score >= 55
          ? "This profile needs active monitoring around debt, liquidity, or concentration."
          : "The family office should focus on liquidity, debt reduction, and diversification.";

  return {
    score,
    label,
    detail,
    factors: [
      {
        label: "Debt ratio",
        value: `${(summary.debtRatio * 100).toFixed(1)}%`,
        tone: summary.debtRatio <= 0.35 ? "positive" : "warning",
      },
      {
        label: "Cash coverage",
        value: `${(summary.cashRatio * 100).toFixed(1)}%`,
        tone: summary.cashRatio >= 0.1 ? "positive" : "warning",
      },
      {
        label: "Monthly momentum",
        value: `$${latestMonthlyGrowth.toLocaleString()}`,
        tone: latestMonthlyGrowth >= 0 ? "positive" : "warning",
      },
      {
        label: "Concentration",
        value: `${Math.max(largestAssetShare, largestInvestmentShare) * 100 > 35 ? "Elevated" : "Balanced"}`,
        tone: Math.max(largestAssetShare, largestInvestmentShare) * 100 > 35 ? "warning" : "neutral",
      },
    ],
  };
}

function getShareForAllocation(allocation: AllocationItem[], name: string): number {
  const total = allocation.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return 0;
  }

  const item = allocation.find((entry) => entry.name === name);
  return item ? item.value / total : 0;
}

function formatAssetName(value: string): string {
  const mapping: Record<string, string> = {
    cash: "Cash",
    checking: "Checking",
    savings: "Savings",
    investment: "Investments",
    real_estate: "Real Estate",
    vehicle: "Vehicle",
    business: "Business",
    other: "Other",
  };

  return mapping[value] ?? value;
}
