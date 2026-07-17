import type { Asset } from "@/types/asset";
import type { Liability } from "@/types/liability";

export interface AllocationItem {
  name: string;
  value: number;
}

export interface FinanceSummarySnapshot {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  debtRatio: number;
  assetAllocation: AllocationItem[];
  liabilityAllocation: AllocationItem[];
  largestAsset: Asset | null;
  largestLiability: Liability | null;
}

export function calculateAssets(assets: Asset[]): number {
  return assets.reduce((sum, asset) => sum + Number(asset.current_value ?? 0), 0);
}

export function calculateLiabilities(liabilities: Liability[]): number {
  return liabilities.reduce((sum, liability) => sum + Number(liability.outstanding_amount ?? 0), 0);
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

export function buildDashboardSummary(assets: Asset[], liabilities: Liability[]): FinanceSummarySnapshot {
  const totalAssets = calculateAssets(assets);
  const totalLiabilities = calculateLiabilities(liabilities);
  const netWorth = calculateNetWorth(totalAssets, totalLiabilities);
  const debtRatio = calculateDebtRatio(totalAssets, totalLiabilities);
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
    totalLiabilities,
    netWorth,
    debtRatio,
    assetAllocation,
    liabilityAllocation,
    largestAsset,
    largestLiability,
  };
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
