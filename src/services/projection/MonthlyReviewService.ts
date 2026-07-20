import { supabase } from "@/lib/supabase/client";
import { MONTH_END_CLOSE_ITEM_DEFINITIONS, type MonthEndCloseItem, type MonthEndCloseItemKey } from "@/types/monthEndClose";
import type { MonthlyActual, MonthlySnapshot, MonthlyVariance } from "@/types/projection";

export interface MonthlyReviewPeriod {
  closeId: string;
  month: number;
  year: number;
  monthKey: string;
  label: string;
  versionNumber: number;
}

export interface MonthlyReviewEntityComparison {
  rowKey: string;
  entityId: string;
  entityType: string;
  entityTypeLabel: string;
  entityName: string;
  itemKey: MonthEndCloseItemKey;
  itemLabel: string;
  itemType: "asset" | "liability";
  openingValue: number;
  projectedValue: number;
  actualValue: number;
  absoluteVariance: number;
  percentageVariance: number | null;
  netWorthChangeContribution: number;
}

export interface MonthlyReviewKpiComparison {
  key: string;
  label: string;
  projected: number;
  actual: number;
  absoluteVariance: number;
  percentageVariance: number | null;
}

export interface MonthlyReviewSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  projectionVariance: number;
  monthOverMonthChange: number;
  yearToDateChange: number;
  largestPositiveVariance: MonthlyReviewEntityComparison | null;
  largestNegativeVariance: MonthlyReviewEntityComparison | null;
  topContributors: MonthlyReviewEntityComparison[];
}

export interface MonthlyReviewWorkspace {
  periods: MonthlyReviewPeriod[];
  selectedPeriod: MonthlyReviewPeriod | null;
  entities: MonthlyReviewEntityComparison[];
  kpis: MonthlyReviewKpiComparison[];
  summary: MonthlyReviewSummary | null;
}

type ValueMap = Record<MonthEndCloseItemKey, number>;

interface MonthEndCloseHeader {
  id: string;
  user_id: string;
  close_month: number;
  close_year: number;
  version_number: number;
  status: "draft" | "closed";
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

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function entityRowKey(entityType: string, entityId: string) {
  return `${entityType}:${entityId}`;
}

function emptyValueMap(): ValueMap {
  return MONTH_END_CLOSE_ITEM_DEFINITIONS.reduce((acc, item) => {
    acc[item.key] = 0;
    return acc;
  }, {} as ValueMap);
}

function calculatePercentageVariance(actual: number, projected: number) {
  if (projected === 0) {
    return actual === 0 ? 0 : null;
  }

  return ((actual - projected) / Math.abs(projected)) * 100;
}

function entityTypeLabel(entityType: string, itemLabel: string) {
  switch (entityType) {
    case "bank-account":
      return "Bank Account";
    case "investment":
      return itemLabel;
    case "gold-holding":
      return "Gold Holding";
    case "silver-holding":
      return "Silver Holding";
    case "fixed-deposit":
      return "Fixed Deposit";
    case "retirement-account":
      return itemLabel;
    case "real-estate-property":
      return "Real Estate Property";
    case "liability":
      return itemLabel;
    case "asset":
      return "Asset";
    case "legacy-bucket":
      return "Legacy Snapshot";
    default:
      return itemLabel;
  }
}

function kpiLabel(key: MonthEndCloseItemKey) {
  switch (key) {
    case "bank_accounts":
      return "Cash";
    case "mutual_funds":
      return "Mutual Funds";
    case "stocks":
      return "Stocks";
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    case "fixed_deposits":
      return "Fixed Deposits";
    case "epf":
      return "EPF";
    case "ppf":
      return "PPF";
    case "nps":
      return "NPS";
    case "real_estate":
      return "Real Estate";
    case "other_assets":
      return "Other Assets";
    case "home_loans":
      return "Home Loans";
    case "car_loans":
      return "Car Loans";
    case "other_liabilities":
    default:
      return "Other Liabilities";
  }
}

function summarize(values: ValueMap) {
  const totalAssets =
    values.bank_accounts +
    values.mutual_funds +
    values.stocks +
    values.gold +
    values.silver +
    values.fixed_deposits +
    values.epf +
    values.ppf +
    values.nps +
    values.real_estate +
    values.other_assets;
  const totalLiabilities = values.home_loans + values.car_loans + values.other_liabilities;

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}

function normalizeCloseItem(row: MonthEndCloseItem): MonthEndCloseItem {
  return {
    ...row,
    entity_id: String(row.entity_id),
    opening_value: toNumber(row.opening_value),
    projected_value: toNumber(row.projected_value),
    actual_value: toNumber(row.actual_value),
    absolute_variance: toNumber(row.absolute_variance),
    percentage_variance: row.percentage_variance === null ? null : toNumber(row.percentage_variance),
  };
}

function buildEntityComparisons(items: MonthEndCloseItem[]): MonthlyReviewEntityComparison[] {
  return [...items]
    .map((item) => {
      const openingValue = Number(item.opening_value ?? 0);
      const projectedValue = Number(item.projected_value ?? 0);
      const actualValue = Number(item.actual_value ?? 0);
      const absoluteVariance = actualValue - projectedValue;
      const netWorthChangeContribution = item.item_type === "asset"
        ? actualValue - openingValue
        : openingValue - actualValue;

      return {
        rowKey: entityRowKey(item.entity_type, item.entity_id),
        entityId: item.entity_id,
        entityType: item.entity_type,
        entityTypeLabel: entityTypeLabel(item.entity_type, item.item_label),
        entityName: item.entity_name,
        itemKey: item.item_key,
        itemLabel: item.item_label,
        itemType: item.item_type,
        openingValue,
        projectedValue,
        actualValue,
        absoluteVariance,
        percentageVariance: calculatePercentageVariance(actualValue, projectedValue),
        netWorthChangeContribution,
      };
    })
    .sort((left, right) => left.itemLabel.localeCompare(right.itemLabel, "en", { sensitivity: "base" }) || left.entityName.localeCompare(right.entityName, "en", { sensitivity: "base" }));
}

function buildKpiComparisons(entities: MonthlyReviewEntityComparison[]): MonthlyReviewKpiComparison[] {
  const projectedValues = entities.reduce((acc, entity) => {
    acc[entity.itemKey] += entity.projectedValue;
    return acc;
  }, emptyValueMap());
  const actualValues = entities.reduce((acc, entity) => {
    acc[entity.itemKey] += entity.actualValue;
    return acc;
  }, emptyValueMap());
  const projectedTotals = summarize(projectedValues);
  const actualTotals = summarize(actualValues);

  const rows: MonthlyReviewKpiComparison[] = MONTH_END_CLOSE_ITEM_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: kpiLabel(definition.key),
    projected: projectedValues[definition.key],
    actual: actualValues[definition.key],
    absoluteVariance: actualValues[definition.key] - projectedValues[definition.key],
    percentageVariance: calculatePercentageVariance(actualValues[definition.key], projectedValues[definition.key]),
  }));

  rows.push(
    {
      key: "total_assets",
      label: "Total Assets",
      projected: projectedTotals.totalAssets,
      actual: actualTotals.totalAssets,
      absoluteVariance: actualTotals.totalAssets - projectedTotals.totalAssets,
      percentageVariance: calculatePercentageVariance(actualTotals.totalAssets, projectedTotals.totalAssets),
    },
    {
      key: "total_liabilities",
      label: "Total Liabilities",
      projected: projectedTotals.totalLiabilities,
      actual: actualTotals.totalLiabilities,
      absoluteVariance: actualTotals.totalLiabilities - projectedTotals.totalLiabilities,
      percentageVariance: calculatePercentageVariance(actualTotals.totalLiabilities, projectedTotals.totalLiabilities),
    },
    {
      key: "net_worth",
      label: "Net Worth",
      projected: projectedTotals.netWorth,
      actual: actualTotals.netWorth,
      absoluteVariance: actualTotals.netWorth - projectedTotals.netWorth,
      percentageVariance: calculatePercentageVariance(actualTotals.netWorth, projectedTotals.netWorth),
    },
  );

  return rows;
}

async function listClosedPeriods(client: ReturnType<typeof assertSupabaseClient>, userId: string): Promise<MonthlyReviewPeriod[]> {
  const { data, error } = await client
    .from("month_end_closes")
    .select("id, close_month, close_year, version_number, status")
    .eq("user_id", userId)
    .eq("status", "closed")
    .order("close_year", { ascending: false })
    .order("close_month", { ascending: false })
    .order("version_number", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const periods = new Map<string, MonthlyReviewPeriod>();

  for (const row of (data ?? []) as MonthEndCloseHeader[]) {
    const key = monthKey(row.close_year, row.close_month);
    if (!periods.has(key)) {
      periods.set(key, {
        closeId: row.id,
        month: row.close_month,
        year: row.close_year,
        monthKey: key,
        label: monthLabel(row.close_year, row.close_month),
        versionNumber: row.version_number,
      });
    }
  }

  return [...periods.values()];
}

async function getCloseItems(client: ReturnType<typeof assertSupabaseClient>, closeId: string): Promise<MonthEndCloseItem[]> {
  const { data, error } = await client
    .from("month_end_close_items")
    .select("*")
    .eq("close_id", closeId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as MonthEndCloseItem[]).map((row) => normalizeCloseItem(row));
}

function findPreviousPeriod(periods: MonthlyReviewPeriod[], selected: MonthlyReviewPeriod) {
  const index = periods.findIndex((period) => period.closeId === selected.closeId);
  return index >= 0 ? periods[index + 1] ?? null : null;
}

function startOfYearMonthKey(year: number) {
  return `${year}-01`;
}

function monthKeyCompare(left: string, right: string) {
  return left.localeCompare(right);
}

async function getYearToDateBaselineItems(
  client: ReturnType<typeof assertSupabaseClient>,
  periods: MonthlyReviewPeriod[],
  selected: MonthlyReviewPeriod,
): Promise<MonthEndCloseItem[] | null> {
  const preYearPeriod = periods.find((period) => monthKeyCompare(period.monthKey, startOfYearMonthKey(selected.year)) < 0) ?? null;
  if (preYearPeriod) {
    return getCloseItems(client, preYearPeriod.closeId);
  }

  const sameYearPeriods = periods
    .filter((period) => period.year === selected.year && monthKeyCompare(period.monthKey, selected.monthKey) <= 0)
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey));

  if (sameYearPeriods.length === 0) {
    return null;
  }

  return getCloseItems(client, sameYearPeriods[0].closeId);
}

export interface MonthlyReviewReport {
  month: string;
  variance: MonthlyVariance;
  status: "on-track" | "watch" | "off-track";
}

export class MonthlyReviewService {
  compareProjectionVsActual(projected: MonthlySnapshot, actual: MonthlyActual): MonthlyVariance {
    return this.calculateVariance(projected, actual);
  }

  calculateVariance(projected: MonthlySnapshot, actual: MonthlyActual): MonthlyVariance {
    return {
      month: actual.month,
      projected,
      actual,
      closingBalanceVariance: Number(actual.closingBalance ?? 0) - Number(projected.closingBalance ?? 0),
      contributionVariance: Number(actual.contributions ?? 0) - Number(projected.contributions ?? 0),
      growthVariance: Number(actual.growth ?? 0) - Number(projected.growth ?? 0),
      loanPrincipalVariance: Number(actual.loanPrincipalReduction ?? 0) - Number(projected.loanPrincipalReduction ?? 0),
      goalFundingVariance: Number(actual.goalFunding ?? 0) - Number(projected.goalFunding ?? 0),
    };
  }

  generateMonthlyReview(projected: MonthlySnapshot, actual: MonthlyActual): MonthlyReviewReport {
    const variance = this.calculateVariance(projected, actual);
    const absoluteClosingVariance = Math.abs(variance.closingBalanceVariance);
    const status: MonthlyReviewReport["status"] = absoluteClosingVariance <= 5000 ? "on-track" : absoluteClosingVariance <= 25000 ? "watch" : "off-track";

    return {
      month: actual.month,
      variance,
      status,
    };
  }

  async getMonthlyReviewWorkspace(selectedCloseId?: string): Promise<MonthlyReviewWorkspace> {
    const { client, user } = await requireAuthenticatedUser();
    const periods = await listClosedPeriods(client, user.id);

    if (periods.length === 0) {
      return {
        periods: [],
        selectedPeriod: null,
        entities: [],
        kpis: [],
        summary: null,
      };
    }

    const selectedPeriod = periods.find((period) => period.closeId === selectedCloseId) ?? periods[0];
    const [selectedItems, previousItems, ytdBaselineItems] = await Promise.all([
      getCloseItems(client, selectedPeriod.closeId),
      (async () => {
        const previousPeriod = findPreviousPeriod(periods, selectedPeriod);
        return previousPeriod ? getCloseItems(client, previousPeriod.closeId) : Promise.resolve(null);
      })(),
      getYearToDateBaselineItems(client, periods, selectedPeriod),
    ]);

    const entities = buildEntityComparisons(selectedItems).sort((left, right) => {
      const definitionIndex = MONTH_END_CLOSE_ITEM_DEFINITIONS.findIndex((item) => item.key === left.itemKey) - MONTH_END_CLOSE_ITEM_DEFINITIONS.findIndex((item) => item.key === right.itemKey);
      if (definitionIndex !== 0) {
        return definitionIndex;
      }

      return left.entityName.localeCompare(right.entityName, "en", { sensitivity: "base" });
    });
    const kpis = buildKpiComparisons(entities);
    const actualValues = selectedItems.reduce((acc, item) => {
      acc[item.item_key] += Number(item.actual_value ?? 0);
      return acc;
    }, emptyValueMap());
    const projectedValues = selectedItems.reduce((acc, item) => {
      acc[item.item_key] += Number(item.projected_value ?? 0);
      return acc;
    }, emptyValueMap());
    const actualTotals = summarize(actualValues);
    const projectedTotals = summarize(projectedValues);
    const previousNetWorth = previousItems ? summarizePersistedItems(previousItems, "actual_value").netWorth : entities.reduce((sum, entity) => sum + entity.openingValue * (entity.itemType === "asset" ? 1 : -1), 0);
    const ytdBaselineNetWorth = ytdBaselineItems
      ? (ytdBaselineItems[0]?.close_id === selectedItems[0]?.close_id
          ? selectedItems.reduce((sum, entity) => sum + (entity.item_type === "asset" ? Number(entity.opening_value ?? 0) : -Number(entity.opening_value ?? 0)), 0)
          : summarizePersistedItems(ytdBaselineItems, "actual_value").netWorth)
      : entities.reduce((sum, entity) => sum + entity.openingValue * (entity.itemType === "asset" ? 1 : -1), 0);
    const largestPositiveVariance = entities.filter((entity) => entity.absoluteVariance > 0).sort((left, right) => right.absoluteVariance - left.absoluteVariance)[0] ?? null;
    const largestNegativeVariance = entities.filter((entity) => entity.absoluteVariance < 0).sort((left, right) => left.absoluteVariance - right.absoluteVariance)[0] ?? null;
    const topContributors = [...entities]
      .sort((left, right) => Math.abs(right.netWorthChangeContribution) - Math.abs(left.netWorthChangeContribution))
      .slice(0, 5);

    return {
      periods,
      selectedPeriod,
      entities,
      kpis,
      summary: {
        totalAssets: actualTotals.totalAssets,
        totalLiabilities: actualTotals.totalLiabilities,
        netWorth: actualTotals.netWorth,
        projectionVariance: actualTotals.netWorth - projectedTotals.netWorth,
        monthOverMonthChange: actualTotals.netWorth - previousNetWorth,
        yearToDateChange: actualTotals.netWorth - ytdBaselineNetWorth,
        largestPositiveVariance,
        largestNegativeVariance,
        topContributors,
      },
    };
  }
}

function summarizePersistedItems(items: MonthEndCloseItem[] | null, field: "opening_value" | "projected_value" | "actual_value") {
  const values = (items ?? []).reduce((acc, item) => {
    acc[item.item_key] += Number(item[field] ?? 0);
    return acc;
  }, emptyValueMap());

  return summarize(values);
}

export const monthlyReviewService = new MonthlyReviewService();