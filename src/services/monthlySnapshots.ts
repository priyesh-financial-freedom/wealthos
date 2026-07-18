import { calculateDebtRatio } from "@/services/finance";
import { supabase } from "@/lib/supabase/client";
import type { MonthlyAssetSnapshot, MonthlyInvestmentSnapshot, MonthlyLiabilitySnapshot, MonthlySnapshot } from "@/types/monthlySnapshot";

const cashAssetTypes = new Set(["cash", "checking", "savings"]);

export interface MonthlyHistoryRecord {
  snapshot: MonthlySnapshot;
  assets: MonthlyAssetSnapshot[];
  investments: MonthlyInvestmentSnapshot[];
  liabilities: MonthlyLiabilitySnapshot[];
  monthLabel: string;
}

export interface MonthlyComparisonMetric {
  label: string;
  current: number;
  previous: number | null;
  delta: number;
  deltaPercent: number | null;
  tone: "positive" | "warning" | "neutral";
  inverse?: boolean;
}

export interface MonthlyComparisonWindow {
  title: string;
  subtitle: string;
  metrics: MonthlyComparisonMetric[];
}

export interface MonthlyTrendPoint {
  month: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  investments: number;
}

export interface MonthlyReviewInsight {
  title: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}

export interface MonthlyHistoryModel {
  records: MonthlyHistoryRecord[];
  latest: MonthlyHistoryRecord | null;
  previousMonth: MonthlyHistoryRecord | null;
  sameMonthLastYear: MonthlyHistoryRecord | null;
  comparisons: MonthlyComparisonWindow[];
  trendData: MonthlyTrendPoint[];
  review: MonthlyReviewInsight[];
  timeline: MonthlyHistoryRecord[];
}

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

async function requireAuthenticatedUser() {
  const client = assertSupabaseClient();

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
    throw new Error("Authentication required.");
  }

  return { client, user };
}

function formatMonthLabel(snapshotYear: number, snapshotMonth: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(snapshotYear, snapshotMonth - 1, 1));
}

function monthKey(snapshotYear: number, snapshotMonth: number) {
  return `${snapshotYear}-${String(snapshotMonth).padStart(2, "0")}`;
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function currentMonthYear(now = new Date()) {
  return {
    snapshot_month: now.getMonth() + 1,
    snapshot_year: now.getFullYear(),
  };
}

function getSnapshotValue(snapshot: MonthlyHistoryRecord | null, key: "netWorth" | "assets" | "liabilities" | "investments") {
  if (!snapshot) {
    return 0;
  }

  switch (key) {
    case "assets":
      return snapshot.snapshot.assets_total;
    case "liabilities":
      return snapshot.snapshot.liabilities_total;
    case "investments":
      return snapshot.snapshot.investments_total;
    case "netWorth":
    default:
      return snapshot.snapshot.net_worth;
  }
}

function buildMetric(label: string, current: number, previous: number | null, inverse = false): MonthlyComparisonMetric {
  const delta = previous === null ? 0 : current - previous;
  const deltaPercent = previous && previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  const direction = inverse ? -delta : delta;
  const tone: MonthlyComparisonMetric["tone"] = previous === null ? "neutral" : direction > 0 ? "positive" : direction < 0 ? "warning" : "neutral";

  return {
    label,
    current,
    previous,
    delta,
    deltaPercent,
    tone,
    inverse,
  };
}

function snapshotSort(left: MonthlyHistoryRecord, right: MonthlyHistoryRecord) {
  if (left.snapshot.snapshot_year !== right.snapshot.snapshot_year) {
    return right.snapshot.snapshot_year - left.snapshot.snapshot_year;
  }

  return right.snapshot.snapshot_month - left.snapshot.snapshot_month;
}

function compactRecent(records: MonthlyHistoryRecord[], limit = 12) {
  return [...records].sort((left, right) => (left.snapshot.snapshot_year - right.snapshot.snapshot_year) || (left.snapshot.snapshot_month - right.snapshot.snapshot_month)).slice(-limit);
}

export async function closeCurrentMonthSnapshot() {
  const { client } = await requireAuthenticatedUser();
  const { snapshot_month, snapshot_year } = currentMonthYear();

  const { data, error } = await client.rpc("close_monthly_snapshot", {
    p_snapshot_month: snapshot_month,
    p_snapshot_year: snapshot_year,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as MonthlySnapshot;
}

export async function getMonthlyHistory(): Promise<MonthlyHistoryRecord[]> {
  const { client, user } = await requireAuthenticatedUser();

  const [snapshotsResult, assetsResult, investmentsResult, liabilitiesResult] = await Promise.all([
    client.from("monthly_snapshots").select("*").eq("user_id", user.id).order("snapshot_year", { ascending: false }).order("snapshot_month", { ascending: false }),
    client.from("monthly_asset_snapshots").select("*").eq("user_id", user.id).order("snapshot_year", { ascending: false }).order("snapshot_month", { ascending: false }),
    client.from("monthly_investment_snapshots").select("*").eq("user_id", user.id).order("snapshot_year", { ascending: false }).order("snapshot_month", { ascending: false }),
    client.from("monthly_liability_snapshots").select("*").eq("user_id", user.id).order("snapshot_year", { ascending: false }).order("snapshot_month", { ascending: false }),
  ]);

  if (snapshotsResult.error) {
    throw new Error(snapshotsResult.error.message);
  }

  if (assetsResult.error) {
    throw new Error(assetsResult.error.message);
  }

  if (investmentsResult.error) {
    throw new Error(investmentsResult.error.message);
  }

  if (liabilitiesResult.error) {
    throw new Error(liabilitiesResult.error.message);
  }

  const records = new Map<string, MonthlyHistoryRecord>();

  for (const snapshot of (snapshotsResult.data ?? []) as MonthlySnapshot[]) {
    const normalizedSnapshot: MonthlySnapshot = {
      ...snapshot,
      assets_total: toNumber(snapshot.assets_total),
      liabilities_total: toNumber(snapshot.liabilities_total),
      investments_total: toNumber(snapshot.investments_total),
      net_worth: toNumber(snapshot.net_worth),
      growth_from_previous_month: toNumber(snapshot.growth_from_previous_month),
      growth_from_previous_year: toNumber(snapshot.growth_from_previous_year),
    };

    const key = monthKey(snapshot.snapshot_year, snapshot.snapshot_month);
    records.set(key, {
      snapshot: normalizedSnapshot,
      assets: [],
      investments: [],
      liabilities: [],
      monthLabel: formatMonthLabel(snapshot.snapshot_year, snapshot.snapshot_month),
    });
  }

  for (const row of (assetsResult.data ?? []) as MonthlyAssetSnapshot[]) {
    const key = monthKey(row.snapshot_year, row.snapshot_month);
    const record = records.get(key);
    if (record) {
      record.assets.push({
        ...row,
        current_value: toNumber(row.current_value),
        cost_basis: toNumber(row.cost_basis),
        gain_loss: toNumber(row.gain_loss),
      });
    }
  }

  for (const row of (investmentsResult.data ?? []) as MonthlyInvestmentSnapshot[]) {
    const key = monthKey(row.snapshot_year, row.snapshot_month);
    const record = records.get(key);
    if (record) {
      record.investments.push({
        ...row,
        current_value: toNumber(row.current_value),
        cost_basis: toNumber(row.cost_basis),
        gain_loss: toNumber(row.gain_loss),
      });
    }
  }

  for (const row of (liabilitiesResult.data ?? []) as MonthlyLiabilitySnapshot[]) {
    const key = monthKey(row.snapshot_year, row.snapshot_month);
    const record = records.get(key);
    if (record) {
      record.liabilities.push({
        ...row,
        current_value: toNumber(row.current_value),
        cost_basis: toNumber(row.cost_basis),
        gain_loss: toNumber(row.gain_loss),
        outstanding_balance: toNumber(row.outstanding_balance),
      });
    }
  }

  return [...records.values()].sort(snapshotSort);
}

export function buildMonthlyHistoryModel(records: MonthlyHistoryRecord[]): MonthlyHistoryModel {
  const ordered = [...records].sort(snapshotSort);
  const latest = ordered[0] ?? null;
  const previousMonth = latest ? ordered.find((record) => record !== latest && (record.snapshot.snapshot_year < latest.snapshot.snapshot_year || (record.snapshot.snapshot_year === latest.snapshot.snapshot_year && record.snapshot.snapshot_month < latest.snapshot.snapshot_month))) ?? null : null;
  const sameMonthLastYear = latest ? ordered.find((record) => record.snapshot.snapshot_year === latest.snapshot.snapshot_year - 1 && record.snapshot.snapshot_month === latest.snapshot.snapshot_month) ?? null : null;
  const recent = compactRecent(ordered, 12);
  const trendData = recent
    .slice()
    .sort((left, right) => (left.snapshot.snapshot_year - right.snapshot.snapshot_year) || (left.snapshot.snapshot_month - right.snapshot.snapshot_month))
    .map((record) => ({
      month: formatMonthLabel(record.snapshot.snapshot_year, record.snapshot.snapshot_month),
      netWorth: record.snapshot.net_worth,
      assets: record.snapshot.assets_total,
      liabilities: record.snapshot.liabilities_total,
      investments: record.snapshot.investments_total,
    }));

  const comparisons: MonthlyComparisonWindow[] = [
    {
      title: "Current vs Last Month",
      subtitle: latest ? `${latest.monthLabel} against the previous close` : "No closed month yet",
      metrics: [
        buildMetric("Net worth", getSnapshotValue(latest, "netWorth"), getSnapshotValue(previousMonth, "netWorth")),
        buildMetric("Assets", getSnapshotValue(latest, "assets"), getSnapshotValue(previousMonth, "assets")),
        buildMetric("Liabilities", getSnapshotValue(latest, "liabilities"), getSnapshotValue(previousMonth, "liabilities"), true),
        buildMetric("Investments", getSnapshotValue(latest, "investments"), getSnapshotValue(previousMonth, "investments")),
      ],
    },
    {
      title: "Current vs Same Month Last Year",
      subtitle: latest ? `${latest.monthLabel} year-over-year comparison` : "No closed month yet",
      metrics: [
        buildMetric("Net worth", getSnapshotValue(latest, "netWorth"), getSnapshotValue(sameMonthLastYear, "netWorth")),
        buildMetric("Assets", getSnapshotValue(latest, "assets"), getSnapshotValue(sameMonthLastYear, "assets")),
        buildMetric("Liabilities", getSnapshotValue(latest, "liabilities"), getSnapshotValue(sameMonthLastYear, "liabilities"), true),
        buildMetric("Investments", getSnapshotValue(latest, "investments"), getSnapshotValue(sameMonthLastYear, "investments")),
      ],
    },
  ];

  const review: MonthlyReviewInsight[] = [];

  if (!latest) {
    review.push({ title: "Start the closing cycle", detail: "Close the first month to begin recording historical performance, growth, and debt movement.", tone: "neutral" });
  } else {
    const netWorthDelta = latest.snapshot.growth_from_previous_month;
    const liabilityDelta = latest.snapshot.liabilities_total - (previousMonth?.snapshot.liabilities_total ?? latest.snapshot.liabilities_total);
    const investmentShare = latest.snapshot.assets_total + latest.snapshot.investments_total > 0 ? latest.snapshot.investments_total / (latest.snapshot.assets_total + latest.snapshot.investments_total) : 0;
    const previousInvestmentShare = previousMonth && previousMonth.snapshot.assets_total + previousMonth.snapshot.investments_total > 0
      ? previousMonth.snapshot.investments_total / (previousMonth.snapshot.assets_total + previousMonth.snapshot.investments_total)
      : investmentShare;
    const cashShare = latest.assets.reduce((sum, asset) => sum + (cashAssetTypes.has(asset.asset_type) ? asset.current_value : 0), 0) / Math.max(latest.snapshot.assets_total, 1);
    const debtRatio = calculateDebtRatio(latest.snapshot.assets_total + latest.snapshot.investments_total, latest.snapshot.liabilities_total);
    const previousDebtRatio = previousMonth ? calculateDebtRatio(previousMonth.snapshot.assets_total + previousMonth.snapshot.investments_total, previousMonth.snapshot.liabilities_total) : debtRatio;

    review.push({
      title: netWorthDelta >= 0 ? "Net worth improved" : "Net worth softened",
      detail: `${netWorthDelta >= 0 ? "Net worth increased by" : "Net worth declined by"} ${formatIndianCurrency(Math.abs(netWorthDelta))} since the last close.`,
      tone: netWorthDelta >= 0 ? "positive" : "warning",
    });

    if (liabilityDelta !== 0) {
      review.push({
        title: liabilityDelta < 0 ? "Debt balance reduced" : "Debt balance moved higher",
        detail: `${liabilityDelta < 0 ? "Liabilities reduced by" : "Liabilities increased by"} ${formatIndianCurrency(Math.abs(liabilityDelta))} versus the prior month.`,
        tone: liabilityDelta < 0 ? "positive" : "warning",
      });
    }

    if (investmentShare > previousInvestmentShare + 0.02) {
      review.push({
        title: "Investment allocation increased",
        detail: `Investments now represent ${(investmentShare * 100).toFixed(0)}% of combined assets and investments, up from ${(previousInvestmentShare * 100).toFixed(0)}% last month.`,
        tone: "positive",
      });
    }

    if (cashShare >= 0.25) {
      review.push({
        title: "Cash exceeds target",
        detail: `Liquid reserves sit at ${(cashShare * 100).toFixed(0)}% of total assets, which gives the board room for near-term flexibility.`,
        tone: "positive",
      });
    }

    if (debtRatio < previousDebtRatio) {
      review.push({
        title: "Debt ratio improved",
        detail: `Debt ratio moved from ${(previousDebtRatio * 100).toFixed(1)}% to ${(debtRatio * 100).toFixed(1)}%.`,
        tone: "positive",
      });
    }

    if (sameMonthLastYear) {
      const yearOverYearDelta = latest.snapshot.net_worth - sameMonthLastYear.snapshot.net_worth;
      review.push({
        title: "Year-over-year context",
        detail: `${yearOverYearDelta >= 0 ? "Net worth is up" : "Net worth is down"} ${formatIndianCurrency(Math.abs(yearOverYearDelta))} compared with the same month last year.`,
        tone: yearOverYearDelta >= 0 ? "positive" : "warning",
      });
    }
  }

  return {
    records: ordered,
    latest,
    previousMonth,
    sameMonthLastYear,
    comparisons,
    trendData,
    review: review.slice(0, 4),
    timeline: ordered.slice(0, 6),
  };
}

function formatIndianCurrency(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 10000000) {
    return `${sign}₹${(absolute / 10000000).toFixed(1)} crore`;
  }

  if (absolute >= 100000) {
    return `${sign}₹${(absolute / 100000).toFixed(1)} lakh`;
  }

  return `${sign}₹${absolute.toLocaleString("en-IN")}`;
}
