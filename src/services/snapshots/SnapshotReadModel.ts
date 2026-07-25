import { supabase } from "@/lib/supabase/client";
import { getMonthlyHistory } from "@/services/monthlySnapshots";

export type SnapshotHistorySource = "month-end-close" | "legacy-monthly-snapshot";

export interface SnapshotHistoryRecord {
  monthKey: string;
  monthLabel: string;
  totals: {
    assets: number;
    liabilities: number;
    investments: number;
    netWorth: number;
  };
  source: SnapshotHistorySource;
  metadata: {
    closeId?: string;
    snapshotId?: string;
    versionNumber?: number;
    status?: string;
    closedAt?: string | null;
  };
}

export interface SnapshotReadModelInput {
  source: SnapshotHistorySource;
}

interface MonthEndCloseHeader {
  id: string;
  close_month: number;
  close_year: number;
  version_number: number;
  status: "draft" | "closed";
  closed_at: string | null;
}

interface MonthEndCloseItemRow {
  close_id: string;
  item_key: string;
  actual_value: number | string | null;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
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
    throw new Error("Authentication required.");
  }

  return { client, user };
}

function mapMonthlySnapshotHistory(records: Awaited<ReturnType<typeof getMonthlyHistory>>): SnapshotHistoryRecord[] {
  return records.map((record) => ({
    monthKey: monthKey(record.snapshot.snapshot_year, record.snapshot.snapshot_month),
    monthLabel: record.monthLabel,
    totals: {
      assets: Number(record.snapshot.assets_total ?? 0),
      liabilities: Number(record.snapshot.liabilities_total ?? 0),
      investments: Number(record.snapshot.investments_total ?? 0),
      netWorth: Number(record.snapshot.net_worth ?? 0),
    },
    source: "legacy-monthly-snapshot",
    metadata: {
      snapshotId: record.snapshot.id,
      status: record.snapshot.status,
    },
  }));
}

function summarizeMonthEndCloseItems(items: MonthEndCloseItemRow[]) {
  let cash = 0;
  let investments = 0;
  let realEstateAndOtherAssets = 0;
  let liabilities = 0;

  for (const item of items) {
    const value = toNumber(item.actual_value);

    if (item.item_key === "bank_accounts") {
      cash += value;
      continue;
    }

    if (
      item.item_key === "mutual_funds" ||
      item.item_key === "stocks" ||
      item.item_key === "gold" ||
      item.item_key === "silver" ||
      item.item_key === "fixed_deposits" ||
      item.item_key === "epf" ||
      item.item_key === "ppf" ||
      item.item_key === "nps"
    ) {
      investments += value;
      continue;
    }

    if (item.item_key === "real_estate" || item.item_key === "other_assets") {
      realEstateAndOtherAssets += value;
      continue;
    }

    if (item.item_key === "home_loans" || item.item_key === "car_loans" || item.item_key === "other_liabilities") {
      liabilities += value;
    }
  }

  const assets = cash + investments + realEstateAndOtherAssets;

  return {
    assets,
    liabilities,
    investments,
    netWorth: assets - liabilities,
  };
}

async function loadMonthEndCloseHistory(): Promise<SnapshotHistoryRecord[]> {
  const { client, user } = await requireAuthenticatedUser();
  const closeResponse = await client
    .from("month_end_closes")
    .select("id, close_month, close_year, version_number, status, closed_at")
    .eq("user_id", user.id)
    .eq("status", "closed")
    .order("close_year", { ascending: false })
    .order("close_month", { ascending: false })
    .order("version_number", { ascending: false });

  if (closeResponse.error) {
    throw new Error(closeResponse.error.message);
  }

  const closes = (closeResponse.data ?? []) as MonthEndCloseHeader[];
  if (closes.length === 0) {
    return [];
  }

  const closeIds = closes.map((close) => close.id);
  const itemsResponse = await client
    .from("month_end_close_items")
    .select("close_id, item_key, actual_value")
    .in("close_id", closeIds);

  if (itemsResponse.error) {
    throw new Error(itemsResponse.error.message);
  }

  const groupedItems = new Map<string, MonthEndCloseItemRow[]>();
  for (const row of (itemsResponse.data ?? []) as MonthEndCloseItemRow[]) {
    const current = groupedItems.get(row.close_id) ?? [];
    current.push(row);
    groupedItems.set(row.close_id, current);
  }

  return closes.map((close) => {
    const summary = summarizeMonthEndCloseItems(groupedItems.get(close.id) ?? []);
    return {
      monthKey: monthKey(close.close_year, close.close_month),
      monthLabel: monthLabel(close.close_year, close.close_month),
      totals: summary,
      source: "month-end-close" as const,
      metadata: {
        closeId: close.id,
        versionNumber: close.version_number,
        status: close.status,
        closedAt: close.closed_at,
      },
    };
  });
}

export class SnapshotReadModel {
  async loadHistory(input: SnapshotReadModelInput): Promise<SnapshotHistoryRecord[]> {
    if (input.source === "legacy-monthly-snapshot") {
      const history = await getMonthlyHistory();
      return mapMonthlySnapshotHistory(history);
    }

    return loadMonthEndCloseHistory();
  }
}

export const snapshotReadModel = new SnapshotReadModel();
