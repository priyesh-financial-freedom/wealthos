import { supabase } from "@/lib/supabase/client";

export type ProjectionComparisonLineKey =
  | "cash"
  | "mutual_funds"
  | "stocks"
  | "epf"
  | "ppf"
  | "nps"
  | "financial_assets_total"
  | "non_financial_assets_total"
  | "liabilities"
  | "net_worth";

export interface ProjectionComparisonRow {
  line_key: ProjectionComparisonLineKey;
  label: string;
  fixed_value: number | null;
  rolling_value: number | null;
  actual_value: number | null;
  variance_vs_fixed: number | null;
  variance_vs_rolling: number | null;
  variance_vs_fixed_percent: number | null;
  variance_vs_rolling_percent: number | null;
}

export interface MonthlyReviewComparisonResult {
  user_id: string;
  review_month: string;
  actual_close_id: string | null;
  fixed_plan_version_id: string | null;
  rolling_plan_version_id: string | null;
  rows: ProjectionComparisonRow[];
}

interface MonthEndCloseRow {
  id: string;
  user_id: string;
  close_month: number;
  close_year: number;
}

interface MonthEndCloseItemRow {
  item_key: string;
  actual_value: number | string | null;
}

interface ProjectionPlanRow {
  id: string;
}

interface ProjectionMonthlyPositionRow {
  bucket_key: ProjectionComparisonLineKey;
  closing_value: number | string | null;
}

interface MonthlyReviewComparisonSource {
  getClosedMonthEndByMonth(params: { userId: string; reviewMonth: string; closeId?: string | null }): Promise<MonthEndCloseRow | null>;
  getCloseItems(closeId: string): Promise<MonthEndCloseItemRow[]>;
  getLatestLockedPlanForMonth(params: {
    userId: string;
    reviewMonth: string;
    planKind: "FIXED" | "ROLLING";
  }): Promise<ProjectionPlanRow | null>;
  getMonthlyPositions(params: {
    planVersionId: string;
    reviewMonth: string;
    bucketKeys: ProjectionComparisonLineKey[];
  }): Promise<ProjectionMonthlyPositionRow[]>;
}

const LINE_DEFINITIONS: Array<{ lineKey: ProjectionComparisonLineKey; label: string }> = [
  { lineKey: "cash", label: "Cash" },
  { lineKey: "mutual_funds", label: "Mutual Funds" },
  { lineKey: "stocks", label: "Stocks" },
  { lineKey: "epf", label: "EPF" },
  { lineKey: "ppf", label: "PPF" },
  { lineKey: "nps", label: "NPS" },
  { lineKey: "financial_assets_total", label: "Financial Assets Total" },
  { lineKey: "non_financial_assets_total", label: "Non-Financial Assets Total" },
  { lineKey: "liabilities", label: "Liabilities" },
  { lineKey: "net_worth", label: "Net Worth" },
];

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
    throw new Error("Authentication required.");
  }

  return { client, user };
}

function parseReviewMonth(reviewMonth: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(reviewMonth.trim());
  if (!match) {
    throw new Error(`Invalid review month: ${reviewMonth}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid review month: ${reviewMonth}`);
  }

  return { year, month };
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function variance(actual: number | null, projection: number | null): number | null {
  if (actual == null || projection == null) {
    return null;
  }

  return roundCurrency(actual - projection);
}

function variancePercent(varianceValue: number | null, projection: number | null): number | null {
  if (varianceValue == null || projection == null || projection === 0) {
    return null;
  }

  return roundCurrency((varianceValue / projection) * 100);
}

function actualValuesFromCloseItems(items: MonthEndCloseItemRow[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.item_key] = toNumber(item.actual_value);
    return acc;
  }, {});
}

function actualLineValue(lineKey: ProjectionComparisonLineKey, values: Record<string, number>): number {
  switch (lineKey) {
    case "cash":
      return toNumber(values.bank_accounts);
    case "mutual_funds":
      return toNumber(values.mutual_funds);
    case "stocks":
      return toNumber(values.stocks);
    case "epf":
      return toNumber(values.epf);
    case "ppf":
      return toNumber(values.ppf);
    case "nps":
      return toNumber(values.nps);
    case "financial_assets_total":
      return roundCurrency(
        toNumber(values.bank_accounts) +
          toNumber(values.mutual_funds) +
          toNumber(values.stocks) +
          toNumber(values.epf) +
          toNumber(values.ppf) +
          toNumber(values.nps),
      );
    case "non_financial_assets_total":
      return roundCurrency(toNumber(values.real_estate) + toNumber(values.gold) + toNumber(values.silver) + toNumber(values.other_assets));
    case "liabilities":
      return roundCurrency(toNumber(values.home_loans) + toNumber(values.car_loans) + toNumber(values.other_liabilities));
    case "net_worth": {
      const financial = roundCurrency(
        toNumber(values.bank_accounts) +
          toNumber(values.mutual_funds) +
          toNumber(values.stocks) +
          toNumber(values.epf) +
          toNumber(values.ppf) +
          toNumber(values.nps),
      );
      const nonFinancial = roundCurrency(toNumber(values.real_estate) + toNumber(values.gold) + toNumber(values.silver) + toNumber(values.other_assets));
      const liabilities = roundCurrency(toNumber(values.home_loans) + toNumber(values.car_loans) + toNumber(values.other_liabilities));
      return roundCurrency(financial + nonFinancial - liabilities);
    }
    default:
      return 0;
  }
}

function projectionValueForLine(
  lineKey: ProjectionComparisonLineKey,
  valuesByBucket: Map<ProjectionComparisonLineKey, number>,
  planAvailable: boolean,
): number | null {
  if (!planAvailable) {
    return null;
  }

  return valuesByBucket.has(lineKey) ? roundCurrency(valuesByBucket.get(lineKey) ?? 0) : null;
}

class SupabaseMonthlyReviewComparisonSource implements MonthlyReviewComparisonSource {
  async getClosedMonthEndByMonth(params: { userId: string; reviewMonth: string; closeId?: string | null }): Promise<MonthEndCloseRow | null> {
    const { client, user } = await requireAuthenticatedUser();
    if (user.id !== params.userId) {
      throw new Error("User mismatch for monthly review comparison request.");
    }

    if (params.closeId) {
      const { data, error } = await client
        .from("month_end_closes")
        .select("id, user_id, close_month, close_year")
        .eq("id", params.closeId)
        .eq("user_id", params.userId)
        .eq("status", "closed")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return (data as MonthEndCloseRow | null) ?? null;
    }

    const month = parseReviewMonth(params.reviewMonth);

    const { data, error } = await client
      .from("month_end_closes")
      .select("id, user_id, close_month, close_year, version_number")
      .eq("user_id", params.userId)
      .eq("status", "closed")
      .eq("close_year", month.year)
      .eq("close_month", month.month)
      .order("version_number", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return (data?.[0] as MonthEndCloseRow | undefined) ?? null;
  }

  async getCloseItems(closeId: string): Promise<MonthEndCloseItemRow[]> {
    const { client } = await requireAuthenticatedUser();
    const { data, error } = await client.from("month_end_close_items").select("item_key, actual_value").eq("close_id", closeId);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as MonthEndCloseItemRow[];
  }

  async getLatestLockedPlanForMonth(params: {
    userId: string;
    reviewMonth: string;
    planKind: "FIXED" | "ROLLING";
  }): Promise<ProjectionPlanRow | null> {
    const { client, user } = await requireAuthenticatedUser();
    if (user.id !== params.userId) {
      throw new Error("User mismatch for monthly review comparison request.");
    }

    const { data, error } = await client
      .from("projection_plan_versions")
      .select("id")
      .eq("user_id", params.userId)
      .eq("plan_kind", params.planKind)
      .eq("status", "LOCKED")
      .lte("start_month", params.reviewMonth)
      .gte("horizon_end_month", params.reviewMonth)
      .order("version_no", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return (data?.[0] as ProjectionPlanRow | undefined) ?? null;
  }

  async getMonthlyPositions(params: {
    planVersionId: string;
    reviewMonth: string;
    bucketKeys: ProjectionComparisonLineKey[];
  }): Promise<ProjectionMonthlyPositionRow[]> {
    const { client } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("projection_monthly_positions")
      .select("bucket_key, closing_value")
      .eq("projection_plan_version_id", params.planVersionId)
      .eq("month_key", params.reviewMonth)
      .in("bucket_key", params.bucketKeys);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as ProjectionMonthlyPositionRow[];
  }
}

export interface GetMonthlyReviewComparisonInput {
  user_id: string;
  review_month: string;
  close_id?: string | null;
}

export class MonthlyReviewComparisonService {
  constructor(private readonly source: MonthlyReviewComparisonSource = new SupabaseMonthlyReviewComparisonSource()) {}

  async getMonthlyReviewComparison(input: GetMonthlyReviewComparisonInput): Promise<MonthlyReviewComparisonResult> {
    const close = await this.source.getClosedMonthEndByMonth({
      userId: input.user_id,
      reviewMonth: input.review_month,
      closeId: input.close_id ?? null,
    });

    const fixedPlan = await this.source.getLatestLockedPlanForMonth({
      userId: input.user_id,
      reviewMonth: input.review_month,
      planKind: "FIXED",
    });

    const rollingPlan = await this.source.getLatestLockedPlanForMonth({
      userId: input.user_id,
      reviewMonth: input.review_month,
      planKind: "ROLLING",
    });

    const [closeItems, fixedRows, rollingRows] = await Promise.all([
      close ? this.source.getCloseItems(close.id) : Promise.resolve([]),
      fixedPlan
        ? this.source.getMonthlyPositions({
            planVersionId: fixedPlan.id,
            reviewMonth: input.review_month,
            bucketKeys: LINE_DEFINITIONS.map((line) => line.lineKey),
          })
        : Promise.resolve([]),
      rollingPlan
        ? this.source.getMonthlyPositions({
            planVersionId: rollingPlan.id,
            reviewMonth: input.review_month,
            bucketKeys: LINE_DEFINITIONS.map((line) => line.lineKey),
          })
        : Promise.resolve([]),
    ]);

    const actualValues = actualValuesFromCloseItems(closeItems);
    const fixedByBucket = new Map<ProjectionComparisonLineKey, number>(
      fixedRows.map((row) => [row.bucket_key, toNumber(row.closing_value)]),
    );
    const rollingByBucket = new Map<ProjectionComparisonLineKey, number>(
      rollingRows.map((row) => [row.bucket_key, toNumber(row.closing_value)]),
    );

    const rows: ProjectionComparisonRow[] = LINE_DEFINITIONS.map((line) => {
      const actualValue = close ? actualLineValue(line.lineKey, actualValues) : null;
      const fixedValue = projectionValueForLine(line.lineKey, fixedByBucket, fixedPlan != null);
      const rollingValue = projectionValueForLine(line.lineKey, rollingByBucket, rollingPlan != null);
      const varianceVsFixed = variance(actualValue, fixedValue);
      const varianceVsRolling = variance(actualValue, rollingValue);

      return {
        line_key: line.lineKey,
        label: line.label,
        fixed_value: fixedValue,
        rolling_value: rollingValue,
        actual_value: actualValue,
        variance_vs_fixed: varianceVsFixed,
        variance_vs_rolling: varianceVsRolling,
        variance_vs_fixed_percent: variancePercent(varianceVsFixed, fixedValue),
        variance_vs_rolling_percent: variancePercent(varianceVsRolling, rollingValue),
      };
    });

    return {
      user_id: input.user_id,
      review_month: input.review_month,
      actual_close_id: close?.id ?? null,
      fixed_plan_version_id: fixedPlan?.id ?? null,
      rolling_plan_version_id: rollingPlan?.id ?? null,
      rows,
    };
  }
}

export const monthlyReviewComparisonService = new MonthlyReviewComparisonService();
