import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { revalidatePath } from "next/cache";
import { formatCurrency } from "@/lib/formatters";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapRawInvestmentRowToInvestment } from "@/services/investments";
import { createMonthEndCloseServerService } from "@/services/monthEndClose/server";
import { RebuildDraftAction } from "./RebuildDraftAction";

const INCIDENT_CLOSE_ID = "f8df4b99-744f-4301-a6d4-e916df3abc78";
const CLOSED_JULY_CLOSE_ID = "c826b7f9-e0ab-4b31-96e3-6275a09e767c";
const AUTH_REQUIRED_MESSAGE = "Authentication required. Please refresh and sign in again.";
const CLOSE_OWNERSHIP_MESSAGE = "This close does not belong to the current user.";
const DRAFT_ONLY_MESSAGE = "Only draft closes can be rebuilt.";

type ItemKey =
  | "bank_accounts"
  | "mutual_funds"
  | "stocks"
  | "gold"
  | "silver"
  | "fixed_deposits"
  | "epf"
  | "ppf"
  | "nps"
  | "real_estate"
  | "other_assets"
  | "home_loans"
  | "car_loans"
  | "other_liabilities";

type DashboardBucket =
  | "Cash"
  | "Mutual Funds"
  | "Stocks"
  | "Fixed Deposits / Bonds"
  | "EPF"
  | "PPF"
  | "NPS"
  | "Property"
  | "Gold"
  | "Silver"
  | "Vehicles / Other Assets"
  | "Home Loans"
  | "Car Loans"
  | "Overdraft"
  | "Credit Cards"
  | "Other Liabilities";

type Row = Record<string, unknown>;

type DashboardItemRow = {
  bucket: DashboardBucket;
  itemName: string;
  sourceTable: string;
  sourceRecordId: string;
  owner: string;
  amountUsed: number;
  includedInNetWorth: boolean;
  notes: string;
};

type DashboardInvestmentRow = {
  investment: ReturnType<typeof mapRawInvestmentRowToInvestment>;
  sourceTable: "investment_holdings" | "investments";
};

type MonthlyCloseRow = {
  id: string;
  user_id: string;
  close_month: number;
  close_year: number;
  version_number: number;
  status: "draft" | "closed";
  created_at: string;
  updated_at: string;
};

type MonthlyCloseItemRow = {
  id: string;
  close_id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  item_key: ItemKey;
  item_label: string;
  opening_value: number;
  projected_value: number;
  actual_value: number;
  absolute_variance: number;
  percentage_variance: number | null;
};

type RollingPlanRow = {
  id: string;
  version_no: number;
  status: "DRAFT" | "LOCKED" | "ARCHIVED";
  plan_kind: "FIXED" | "ROLLING" | "WHAT_IF";
  base_close_id: string | null;
  parent_fixed_version_id: string | null;
  start_month: string;
  horizon_end_month: string;
  created_at: string;
  updated_at: string;
};

type RebaseRow = {
  id: string;
  rolling_version_id: string;
  parent_fixed_version_id: string;
  rebased_from_close_id: string;
  rebased_month: string;
  created_at: string;
};

type PositionRow = {
  id: string;
  projection_plan_version_id: string;
  month_key: string;
  bucket_key: string;
  opening_value: number;
  contribution: number;
  growth: number;
  withdrawal: number;
  closing_value: number;
  metadata: Record<string, unknown> | null;
};

type AssumptionSnapshotRow = {
  id: string;
  projection_plan_version_id: string;
  assumption_payload: {
    openingBalances?: {
      cash?: number;
      mutualFunds?: number;
      stocks?: number;
      epf?: number;
      ppf?: number;
      nps?: number;
      property?: number;
      gold?: number;
      otherNonFinancialAssets?: number;
      liabilities?: number;
    };
  };
};

type DuplicateGroupReport = {
  groupKey: string;
  itemKey: ItemKey;
  entityName: string;
  rowCount: number;
  entityTypes: string[];
  entityIds: string[];
  totalActualValue: number;
};

type RebuildDraftActionState = {
  ok: boolean;
  status: number;
  error?: string;
  result?: {
    closeId: string;
    closeYear: number;
    closeMonth: number;
    status: "draft";
    beforeItemCount: number;
    afterItemCount: number;
    beforeTotals: {
      totalAssets: number;
      totalLiabilities: number;
      netWorth: number;
      totalsByKey: Record<string, number>;
    };
    afterTotals: {
      totalAssets: number;
      totalLiabilities: number;
      netWorth: number;
      totalsByKey: Record<string, number>;
    };
    beforeDuplicateGroups: DuplicateGroupReport[];
    afterDuplicateGroups: DuplicateGroupReport[];
    duplicateGroupsRemoved: DuplicateGroupReport[];
  };
};

const RETIREMENT_INVESTMENT_CATEGORIES = new Set(["EPF", "PPF", "NPS"]);
const FIXED_DEPOSIT_INVESTMENT_CATEGORIES = new Set(["Fixed Deposits", "Bonds"]);
const GOLD_INVESTMENT_CATEGORIES = new Set(["Gold", "Sovereign Gold Bonds"]);
const SILVER_INVESTMENT_CATEGORIES = new Set(["Silver"]);
const MUTUAL_FUND_INVESTMENT_CATEGORIES = new Set(["Mutual Funds"]);
const STOCK_INVESTMENT_CATEGORIES = new Set(["Stocks", "ETFs", "Crypto", "Cash Equivalents"]);

const SIDE_BY_SIDE_BUCKETS = [
  "Cash",
  "Mutual funds",
  "Stocks",
  "Fixed deposits / bonds",
  "EPF",
  "PPF",
  "NPS",
  "Property",
  "Gold",
  "Silver",
  "Vehicle / other assets",
  "Total assets",
  "Home loans",
  "Car loans",
  "Overdraft",
  "Credit cards",
  "Other liabilities",
  "Total liabilities",
  "Net worth",
] as const;

type SideBySideBucket = (typeof SIDE_BY_SIDE_BUCKETS)[number];

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function monthKeyFromYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function normalizeMonthKey(raw: string): string {
  const trimmed = raw.trim();
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (monthMatch) {
    return `${monthMatch[1]}-${monthMatch[2]}`;
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}`;
  }

  return trimmed;
}

function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "N/A";
  }
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

function fmtDiff(value: number | null): string {
  if (value === null) {
    return "N/A";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatAmount(value)}`;
}

function sumBy<T>(rows: T[], mapper: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + asNumber(mapper(row)), 0);
}

async function selectRows<T extends Row>(
  client: any,
  table: string,
  columns: string,
  builder?: (query: any) => any,
): Promise<{ rows: T[]; error: string | null }> {
  let query = client.from(table).select(columns);
  query = builder ? builder(query) : query;
  const { data, error } = await query;

  if (error) {
    return { rows: [], error: `${table}: ${error.message}` };
  }

  return { rows: ((data ?? []) as T[]), error: null };
}

function liabilitySubBucket(type: string): "home" | "car" | "overdraft" | "credit" | "other" {
  if (type === "Home Loan" || type === "Loan Against Property") {
    return "home";
  }
  if (type === "Car Loan") {
    return "car";
  }
  if (type === "Credit Card") {
    return "credit";
  }
  if (type === "Bank Overdraft" || type === "Overdraft / Line of Credit") {
    return "overdraft";
  }
  return "other";
}

function monthlyReviewAggregates(items: MonthlyCloseItemRow[]) {
  const totalsByKey: Record<ItemKey, number> = {
    bank_accounts: 0,
    mutual_funds: 0,
    stocks: 0,
    gold: 0,
    silver: 0,
    fixed_deposits: 0,
    epf: 0,
    ppf: 0,
    nps: 0,
    real_estate: 0,
    other_assets: 0,
    home_loans: 0,
    car_loans: 0,
    other_liabilities: 0,
  };

  for (const item of items) {
    if (Object.prototype.hasOwnProperty.call(totalsByKey, item.item_key)) {
      totalsByKey[item.item_key] += asNumber(item.actual_value);
    }
  }

  const totalAssets =
    totalsByKey.bank_accounts +
    totalsByKey.mutual_funds +
    totalsByKey.stocks +
    totalsByKey.fixed_deposits +
    totalsByKey.epf +
    totalsByKey.ppf +
    totalsByKey.nps +
    totalsByKey.real_estate +
    totalsByKey.gold +
    totalsByKey.silver +
    totalsByKey.other_assets;

  const totalLiabilities = totalsByKey.home_loans + totalsByKey.car_loans + totalsByKey.other_liabilities;

  return {
    totalsByKey,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}

function normalizeDuplicateEntityName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function summarizeCurrentDuplicateGroups(items: MonthlyCloseItemRow[]): DuplicateGroupReport[] {
  const groups = new Map<string, DuplicateGroupReport>();

  for (const item of items) {
    const entityName = item.entity_name?.trim() || item.item_label?.trim() || item.entity_id;
    const groupKey = `${item.item_key}:${normalizeDuplicateEntityName(entityName)}`;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.rowCount += 1;
      existing.totalActualValue += asNumber(item.actual_value);
      if (!existing.entityTypes.includes(item.entity_type)) {
        existing.entityTypes.push(item.entity_type);
      }
      if (!existing.entityIds.includes(item.entity_id)) {
        existing.entityIds.push(item.entity_id);
      }
      continue;
    }

    groups.set(groupKey, {
      groupKey,
      itemKey: item.item_key,
      entityName,
      rowCount: 1,
      entityTypes: [item.entity_type],
      entityIds: [item.entity_id],
      totalActualValue: asNumber(item.actual_value),
    });
  }

  return [...groups.values()]
    .filter((group) => group.rowCount > 1)
    .sort((left, right) => {
      if (left.itemKey !== right.itemKey) {
        return left.itemKey.localeCompare(right.itemKey);
      }

      return left.entityName.localeCompare(right.entityName, "en", { sensitivity: "base" });
    });
}

function toSideBySideDashboard(rows: DashboardItemRow[]) {
  const by = (bucket: DashboardBucket) => sumBy(rows.filter((row) => row.bucket === bucket && row.includedInNetWorth), (row) => row.amountUsed);

  const assets =
    by("Cash") +
    by("Mutual Funds") +
    by("Stocks") +
    by("Fixed Deposits / Bonds") +
    by("EPF") +
    by("PPF") +
    by("NPS") +
    by("Property") +
    by("Gold") +
    by("Silver") +
    by("Vehicles / Other Assets");

  const liabilities = by("Home Loans") + by("Car Loans") + by("Overdraft") + by("Credit Cards") + by("Other Liabilities");

  return {
    "Cash": by("Cash"),
    "Mutual funds": by("Mutual Funds"),
    "Stocks": by("Stocks"),
    "Fixed deposits / bonds": by("Fixed Deposits / Bonds"),
    "EPF": by("EPF"),
    "PPF": by("PPF"),
    "NPS": by("NPS"),
    "Property": by("Property"),
    "Gold": by("Gold"),
    "Silver": by("Silver"),
    "Vehicle / other assets": by("Vehicles / Other Assets"),
    "Total assets": assets,
    "Home loans": by("Home Loans"),
    "Car loans": by("Car Loans"),
    "Overdraft": by("Overdraft"),
    "Credit cards": by("Credit Cards"),
    "Other liabilities": by("Other Liabilities"),
    "Total liabilities": liabilities,
    "Net worth": assets - liabilities,
  } satisfies Record<SideBySideBucket, number | null>;
}

function toSideBySideMonthly(items: MonthlyCloseItemRow[]) {
  const agg = monthlyReviewAggregates(items);
  const otherLiabilityRows = items.filter((row) => row.item_key === "other_liabilities");
  const overdraft = sumBy(
    otherLiabilityRows.filter((row) => {
      const name = row.entity_name.toLowerCase();
      return name.includes("overdraft") || name.includes("line of credit");
    }),
    (row) => row.actual_value,
  );
  const creditCards = sumBy(
    otherLiabilityRows.filter((row) => row.entity_name.toLowerCase().includes("credit")),
    (row) => row.actual_value,
  );
  const residualOther = agg.totalsByKey.other_liabilities - overdraft - creditCards;

  return {
    "Cash": agg.totalsByKey.bank_accounts,
    "Mutual funds": agg.totalsByKey.mutual_funds,
    "Stocks": agg.totalsByKey.stocks,
    "Fixed deposits / bonds": agg.totalsByKey.fixed_deposits,
    "EPF": agg.totalsByKey.epf,
    "PPF": agg.totalsByKey.ppf,
    "NPS": agg.totalsByKey.nps,
    "Property": agg.totalsByKey.real_estate,
    "Gold": agg.totalsByKey.gold,
    "Silver": agg.totalsByKey.silver,
    "Vehicle / other assets": agg.totalsByKey.other_assets,
    "Total assets": agg.totalAssets,
    "Home loans": agg.totalsByKey.home_loans,
    "Car loans": agg.totalsByKey.car_loans,
    "Overdraft": overdraft,
    "Credit cards": creditCards,
    "Other liabilities": residualOther,
    "Total liabilities": agg.totalLiabilities,
    "Net worth": agg.netWorth,
  } satisfies Record<SideBySideBucket, number | null>;
}

function toSideBySideRolling(params: {
  rollingRowsByBucket: Map<string, PositionRow>;
  nonFinancialSplitOpening: { property: number | null; gold: number | null; other: number | null };
}) {
  const row = (bucket: string) => params.rollingRowsByBucket.get(bucket)?.closing_value ?? null;
  const liabilities = row("liabilities");
  const nonFinancial = row("non_financial_assets_total");

  return {
    "Cash": row("cash"),
    "Mutual funds": row("mutual_funds"),
    "Stocks": row("stocks"),
    "Fixed deposits / bonds": null,
    "EPF": row("epf"),
    "PPF": row("ppf"),
    "NPS": row("nps"),
    "Property": params.nonFinancialSplitOpening.property,
    "Gold": params.nonFinancialSplitOpening.gold,
    "Silver": null,
    "Vehicle / other assets": params.nonFinancialSplitOpening.other,
    "Total assets": asNullableNumber(row("financial_assets_total")) === null || asNullableNumber(nonFinancial) === null
      ? null
      : asNumber(row("financial_assets_total")) + asNumber(nonFinancial),
    "Home loans": null,
    "Car loans": null,
    "Overdraft": null,
    "Credit cards": null,
    "Other liabilities": null,
    "Total liabilities": liabilities,
    "Net worth": row("net_worth"),
  } satisfies Record<SideBySideBucket, number | null>;
}

function likelyCause(bucket: SideBySideBucket, dashboard: number | null, monthly: number | null, rolling: number | null): string {
  if (dashboard === null || monthly === null) {
    return "Insufficient data";
  }

  const dm = dashboard - monthly;
  const rm = rolling === null ? null : rolling - monthly;

  if (bucket === "Net worth" && rm !== null && Math.abs(rm) > 1_00_00_000) {
    return "Rolling likely rebased from older close or stale locked rolling version";
  }

  if (["EPF", "PPF", "NPS", "Gold", "Silver", "Property"].includes(bucket) && Math.abs(dm) > 0) {
    return "Source mismatch: Dashboard uses live modules; Monthly uses month_end_close_items workspace snapshot";
  }

  if (["Overdraft", "Credit cards", "Other liabilities"].includes(bucket) && Math.abs(dm) > 0) {
    return "Monthly liability split comes from item rows; Dashboard split comes from live liability types";
  }

  if (rm !== null && Math.abs(rm) > 0 && ["Home loans", "Car loans", "Overdraft", "Credit cards", "Other liabilities"].includes(bucket)) {
    return "Rolling stores liabilities as single aggregate bucket";
  }

  if (Math.abs(dm) === 0 && (rm === null || Math.abs(rm) === 0)) {
    return "No difference";
  }

  return "Timing/version mismatch across live, workspace, and rolling sources";
}

function recommendedAction(bucket: SideBySideBucket, rollingValue: number | null): string {
  if (rollingValue === null && ["Fixed deposits / bonds", "Home loans", "Car loans", "Overdraft", "Credit cards", "Other liabilities", "Silver"].includes(bucket)) {
    return "Model limitation: bucket not stored separately in rolling monthly positions";
  }

  if (bucket === "Net worth") {
    return "Validate rolling base_close_id vs latest closed close_id, then regenerate preview in app if needed";
  }

  return "Verify source records for this bucket and align monthly close snapshot before comparing";
}

function jsonCompact(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

export async function rebuildAugustDraftAction(prevState: RebuildDraftActionState, formData: FormData): Promise<RebuildDraftActionState> {
  "use server";

  void prevState;

  const submittedCloseId = String(formData.get("closeId") ?? "").trim();

  if (submittedCloseId.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "closeId is required.",
    };
  }

  if (submittedCloseId === CLOSED_JULY_CLOSE_ID) {
    return {
      ok: false,
      status: 409,
      error: DRAFT_ONLY_MESSAGE,
    };
  }

  if (submittedCloseId !== INCIDENT_CLOSE_ID) {
    return {
      ok: false,
      status: 403,
      error: CLOSE_OWNERSHIP_MESSAGE,
    };
  }

  try {
    const client = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    const authUserId = user?.id ?? null;
    if (process.env.NODE_ENV !== "production") {
      console.info("[debug/rebuildAugustDraftAction] auth", {
        userId: authUserId,
        submittedCloseId,
      });
    }

    if (authError || !user) {
      return {
        ok: false,
        status: 401,
        error: AUTH_REQUIRED_MESSAGE,
      };
    }

    const { data: closeData, error: closeError } = await client
      .from("month_end_closes")
      .select("id,user_id,status")
      .eq("id", submittedCloseId)
      .maybeSingle();

    if (closeError) {
      throw new Error(closeError.message || "Failed to validate close ownership.");
    }

    const closeUserId = typeof closeData?.user_id === "string" ? closeData.user_id : null;
    const closeStatus = closeData?.status;

    if (process.env.NODE_ENV !== "production") {
      console.info("[debug/rebuildAugustDraftAction] close lookup", {
        submittedCloseId,
        closeUserId,
        closeStatus,
      });
    }

    if (!closeData || closeUserId !== user.id) {
      return {
        ok: false,
        status: 403,
        error: CLOSE_OWNERSHIP_MESSAGE,
      };
    }

    if (closeStatus !== "draft") {
      return {
        ok: false,
        status: 409,
        error: DRAFT_ONLY_MESSAGE,
      };
    }

    const service = createMonthEndCloseServerService();
    const result = await service.rebuildDraftCloseItemsFromCanonicalSources(submittedCloseId);

    revalidatePath("/debug/net-worth-reconciliation");

    return {
      ok: true,
      status: 200,
      result,
    };
  } catch (error) {
    const message = error instanceof Error && error.message.trim().length > 0 ? error.message : "Unexpected server error.";

    if (message.includes("Authentication required")) {
      return {
        ok: false,
        status: 401,
        error: AUTH_REQUIRED_MESSAGE,
      };
    }

    if (message.includes("Only draft month-end closes can be rebuilt")) {
      return {
        ok: false,
        status: 409,
        error: DRAFT_ONLY_MESSAGE,
      };
    }

    return {
      ok: false,
      status: 500,
      error: `Failed to rebuild draft close items. ${message}`,
    };
  }
}

export default async function NetWorthReconciliationPage() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return (
      <AppLayout>
        <PageContainer>
          <PageHeader
            title="Net Worth Reconciliation"
            description="Read-only reconciliation requires an authenticated app session."
            summary="No data was changed."
          />
          <DashboardCard>
            <p className="text-sm text-rose-700">Authentication required. Please log in and open this page again.</p>
          </DashboardCard>
        </PageContainer>
      </AppLayout>
    );
  }

  const errors: string[] = [];

  const [
    bankRes,
    invRes,
    legacyInvRes,
    fdRes,
    epfRes,
    ppfRes,
    npsRes,
    realEstateRes,
    goldRes,
    silverRes,
    assetsRes,
    liabilitiesRes,
    closesRes,
    rollingPlanRes,
    fixedPlanRes,
  ] = await Promise.all([
    selectRows<Row>(client, "bank_accounts", "id, account_name, bank, owner, current_balance, include_in_net_worth, status", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "investment_holdings", "id, user_id, owner, institution, investment_name, investment_type, cost_value, current_value, status, notes, created_at, updated_at", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "investments", "id, user_id, investment_name, category, units, nav_price, cost_basis, today_gain_loss, amc, region, purchase_date, notes, created_at, updated_at", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "fixed_deposit_accounts", "id, institution, account_number, owner, current_value", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "epf_accounts", "id, owner, institution, current_balance", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "ppf_accounts", "id, owner, institution, current_balance", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "nps_accounts", "id, owner, institution, current_balance", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "real_estate_properties", "id, property_name, owner, current_market_value", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "gold_holdings", "id, description, owner, current_value", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "silver_holdings", "id, description, owner, current_value", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "assets", "id, asset_type, asset_name, owner, current_value", (q) => q.eq("user_id", user.id)),
    selectRows<Row>(client, "liabilities", "id, liability_type, account_name, owner, primary_borrower, outstanding_amount, status", (q) => q.eq("user_id", user.id)),
    selectRows<MonthlyCloseRow>(client, "month_end_closes", "id, user_id, close_month, close_year, version_number, status, created_at, updated_at", (q) =>
      q.eq("user_id", user.id).order("close_year", { ascending: false }).order("close_month", { ascending: false }).order("version_number", { ascending: false }),
    ),
    selectRows<RollingPlanRow>(client, "projection_plan_versions", "id, version_no, status, plan_kind, base_close_id, parent_fixed_version_id, start_month, horizon_end_month, created_at, updated_at", (q) =>
      q.eq("user_id", user.id).eq("plan_kind", "ROLLING").order("version_no", { ascending: false }).order("created_at", { ascending: false }).limit(1),
    ),
    selectRows<RollingPlanRow>(client, "projection_plan_versions", "id, version_no, status, plan_kind", (q) => q.eq("user_id", user.id).eq("plan_kind", "FIXED")),
  ]);

  for (const res of [
    bankRes,
    invRes,
    legacyInvRes,
    fdRes,
    epfRes,
    ppfRes,
    npsRes,
    realEstateRes,
    goldRes,
    silverRes,
    assetsRes,
    liabilitiesRes,
    closesRes,
    rollingPlanRes,
    fixedPlanRes,
  ]) {
    if (res.error) {
      errors.push(res.error);
    }
  }

  const investments: DashboardInvestmentRow[] = invRes.rows.length > 0
    ? invRes.rows.map((row) => ({ investment: mapRawInvestmentRowToInvestment(row), sourceTable: "investment_holdings" as const }))
    : legacyInvRes.rows.map((row) => ({ investment: mapRawInvestmentRowToInvestment(row), sourceTable: "investments" as const }));

  const hasDedicatedRealEstate = realEstateRes.rows.length > 0;

  const dashboardRows: DashboardItemRow[] = [];

  for (const row of bankRes.rows) {
    const included = asText(row.status).toLowerCase() === "active" && Boolean(row.include_in_net_worth ?? true);
    dashboardRows.push({
      bucket: "Cash",
      itemName: `${asText(row.account_name)}${asText(row.bank) ? ` • ${asText(row.bank)}` : ""}`,
      sourceTable: "bank_accounts",
      sourceRecordId: asText(row.id),
      owner: asText(row.owner) || "N/A",
      amountUsed: asNumber(row.current_balance),
      includedInNetWorth: included,
      notes: included ? "Active and include_in_net_worth" : "Excluded by status/include_in_net_worth",
    });
  }

  for (const row of investments) {
    const category = row.investment.category;
    const base = {
      itemName: row.investment.investment_name,
      sourceTable: row.sourceTable,
      sourceRecordId: row.investment.id,
      owner: row.investment.owner ?? "N/A",
      amountUsed: row.investment.current_value,
      includedInNetWorth: true,
      notes: category,
    };

    if (MUTUAL_FUND_INVESTMENT_CATEGORIES.has(category)) {
      dashboardRows.push({ bucket: "Mutual Funds", ...base });
      continue;
    }
    if (STOCK_INVESTMENT_CATEGORIES.has(category)) {
      dashboardRows.push({ bucket: "Stocks", ...base });
      continue;
    }
    if (FIXED_DEPOSIT_INVESTMENT_CATEGORIES.has(category)) {
      dashboardRows.push({ bucket: "Fixed Deposits / Bonds", ...base });
      continue;
    }
    if (RETIREMENT_INVESTMENT_CATEGORIES.has(category)) {
      const bucket: DashboardBucket = category === "EPF" ? "EPF" : category === "PPF" ? "PPF" : "NPS";
      dashboardRows.push({ bucket, ...base, notes: `${category} from ${row.sourceTable}` });
      continue;
    }
    if (GOLD_INVESTMENT_CATEGORIES.has(category)) {
      dashboardRows.push({ bucket: "Gold", ...base });
      continue;
    }
    if (SILVER_INVESTMENT_CATEGORIES.has(category)) {
      dashboardRows.push({ bucket: "Silver", ...base });
      continue;
    }
  }

  for (const row of fdRes.rows) {
    dashboardRows.push({
      bucket: "Fixed Deposits / Bonds",
      itemName: `${asText(row.institution)} • ${asText(row.account_number)}`,
      sourceTable: "fixed_deposit_accounts",
      sourceRecordId: asText(row.id),
      owner: asText(row.owner) || "N/A",
      amountUsed: asNumber(row.current_value),
      includedInNetWorth: true,
      notes: "Dedicated fixed deposit module",
    });
  }

  for (const row of epfRes.rows) {
    dashboardRows.push({
      bucket: "EPF",
      itemName: `${asText(row.owner)} • ${asText(row.institution)}`,
      sourceTable: "epf_accounts",
      sourceRecordId: asText(row.id),
      owner: asText(row.owner) || "N/A",
      amountUsed: asNumber(row.current_balance),
      includedInNetWorth: true,
      notes: "Dedicated retirement module",
    });
  }

  for (const row of ppfRes.rows) {
    dashboardRows.push({
      bucket: "PPF",
      itemName: `${asText(row.owner)} • ${asText(row.institution)}`,
      sourceTable: "ppf_accounts",
      sourceRecordId: asText(row.id),
      owner: asText(row.owner) || "N/A",
      amountUsed: asNumber(row.current_balance),
      includedInNetWorth: true,
      notes: "Dedicated retirement module",
    });
  }

  for (const row of npsRes.rows) {
    dashboardRows.push({
      bucket: "NPS",
      itemName: `${asText(row.owner)} • ${asText(row.institution)}`,
      sourceTable: "nps_accounts",
      sourceRecordId: asText(row.id),
      owner: asText(row.owner) || "N/A",
      amountUsed: asNumber(row.current_balance),
      includedInNetWorth: true,
      notes: "Dedicated retirement module",
    });
  }

  for (const row of realEstateRes.rows) {
    dashboardRows.push({
      bucket: "Property",
      itemName: asText(row.property_name),
      sourceTable: "real_estate_properties",
      sourceRecordId: asText(row.id),
      owner: asText(row.owner) || "N/A",
      amountUsed: asNumber(row.current_market_value),
      includedInNetWorth: true,
      notes: "Dedicated property module",
    });
  }

  for (const row of goldRes.rows) {
    dashboardRows.push({
      bucket: "Gold",
      itemName: asText(row.description),
      sourceTable: "gold_holdings",
      sourceRecordId: asText(row.id),
      owner: asText(row.owner) || "N/A",
      amountUsed: asNumber(row.current_value),
      includedInNetWorth: true,
      notes: "Dedicated gold module",
    });
  }

  for (const row of silverRes.rows) {
    dashboardRows.push({
      bucket: "Silver",
      itemName: asText(row.description),
      sourceTable: "silver_holdings",
      sourceRecordId: asText(row.id),
      owner: asText(row.owner) || "N/A",
      amountUsed: asNumber(row.current_value),
      includedInNetWorth: true,
      notes: "Dedicated silver module",
    });
  }

  for (const row of assetsRes.rows) {
    const type = asText(row.asset_type);
    if (type === "vehicle" || type === "business" || type === "other") {
      dashboardRows.push({
        bucket: "Vehicles / Other Assets",
        itemName: asText(row.asset_name),
        sourceTable: "assets",
        sourceRecordId: asText(row.id),
        owner: asText(row.owner) || "N/A",
        amountUsed: asNumber(row.current_value),
        includedInNetWorth: true,
        notes: type,
      });
    }

    if (type === "real_estate") {
      dashboardRows.push({
        bucket: "Property",
        itemName: asText(row.asset_name),
        sourceTable: "assets",
        sourceRecordId: asText(row.id),
        owner: asText(row.owner) || "N/A",
        amountUsed: asNumber(row.current_value),
        includedInNetWorth: !hasDedicatedRealEstate,
        notes: hasDedicatedRealEstate ? "Excluded: dedicated real_estate_properties exists" : "Included as legacy real estate",
      });
    }
  }

  for (const row of liabilitiesRes.rows) {
    const type = asText(row.liability_type);
    const sub = liabilitySubBucket(type);
    const bucket: DashboardBucket =
      sub === "home" ? "Home Loans" : sub === "car" ? "Car Loans" : sub === "overdraft" ? "Overdraft" : sub === "credit" ? "Credit Cards" : "Other Liabilities";

    dashboardRows.push({
      bucket,
      itemName: asText(row.account_name),
      sourceTable: "liabilities",
      sourceRecordId: asText(row.id),
      owner: asText(row.owner || row.primary_borrower) || "N/A",
      amountUsed: asNumber(row.outstanding_amount),
      includedInNetWorth: true,
      notes: `${type}${asText(row.status) ? ` (${asText(row.status)})` : ""}`,
    });
  }

  const dashboardTotals = toSideBySideDashboard(dashboardRows);

  const latestClosed = closesRes.rows.find((row) => row.status === "closed") ?? null;
  const earliestDraft = [...closesRes.rows]
    .filter((row) => row.status === "draft")
    .sort((a, b) => {
      if (a.close_year !== b.close_year) {
        return a.close_year - b.close_year;
      }
      if (a.close_month !== b.close_month) {
        return a.close_month - b.close_month;
      }
      return a.version_number - b.version_number;
    })[0] ?? null;

  const workspaceClose = earliestDraft ?? latestClosed;

  const closeItemsRes = workspaceClose
    ? await selectRows<MonthlyCloseItemRow>(
      client,
      "month_end_close_items",
      "id, close_id, entity_type, entity_id, entity_name, item_key, item_label, opening_value, projected_value, actual_value, absolute_variance, percentage_variance",
      (q) => q.eq("close_id", workspaceClose.id).order("sort_order", { ascending: true }).order("entity_name", { ascending: true }),
    )
    : { rows: [] as MonthlyCloseItemRow[], error: null as string | null };

  if (closeItemsRes.error) {
    errors.push(closeItemsRes.error);
  }

  const monthlyAgg = monthlyReviewAggregates(closeItemsRes.rows);
  const monthlyTotals = toSideBySideMonthly(closeItemsRes.rows);
  const currentDuplicateGroups = summarizeCurrentDuplicateGroups(closeItemsRes.rows);
  const duplicateVerificationKeys: ItemKey[] = [
    "bank_accounts",
    "mutual_funds",
    "stocks",
    "epf",
    "ppf",
    "nps",
    "real_estate",
    "home_loans",
    "car_loans",
  ];

  const rollingPlan = rollingPlanRes.rows[0] ?? null;

  const [linkedFixedPlanRes, rebaseRes, augPosRes, snapshotRes] = rollingPlan
    ? await Promise.all([
      rollingPlan.parent_fixed_version_id
        ? selectRows<Row>(client, "projection_plan_versions", "id, version_no", (q) => q.eq("id", rollingPlan.parent_fixed_version_id).eq("user_id", user.id).limit(1))
        : Promise.resolve({ rows: [] as Row[], error: null as string | null }),
      selectRows<RebaseRow>(client, "projection_rebase_journal", "id, rolling_version_id, parent_fixed_version_id, rebased_from_close_id, rebased_month, created_at", (q) =>
        q.eq("rolling_version_id", rollingPlan.id).order("created_at", { ascending: false }).limit(1),
      ),
      selectRows<PositionRow>(client, "projection_monthly_positions", "id, projection_plan_version_id, month_key, bucket_key, opening_value, contribution, growth, withdrawal, closing_value, metadata", (q) =>
        q.eq("projection_plan_version_id", rollingPlan.id).in("month_key", ["2026-08", "2026-08-01"]).order("bucket_key", { ascending: true }),
      ),
      selectRows<AssumptionSnapshotRow>(client, "projection_assumption_snapshots", "id, projection_plan_version_id, assumption_payload", (q) =>
        q.eq("projection_plan_version_id", rollingPlan.id).limit(1),
      ),
    ])
    : [
      { rows: [] as Row[], error: null as string | null },
      { rows: [] as RebaseRow[], error: null as string | null },
      { rows: [] as PositionRow[], error: null as string | null },
      { rows: [] as AssumptionSnapshotRow[], error: null as string | null },
    ];

  for (const res of [linkedFixedPlanRes, rebaseRes, augPosRes, snapshotRes]) {
    if (res.error) {
      errors.push(res.error);
    }
  }

  const rebase = rebaseRes.rows[0] ?? null;
  const linkedFixedVersion = asNullableNumber(linkedFixedPlanRes.rows[0]?.version_no);
  const latestFixedVersion = fixedPlanRes.rows.reduce((acc, row) => Math.max(acc, asNumber(row.version_no)), 0);

  const rollingRowsByBucket = new Map(augPosRes.rows.map((row) => [asText(row.bucket_key), row]));
  const openingBalances = snapshotRes.rows[0]?.assumption_payload?.openingBalances;

  const nonFinancialSplitOpening = {
    property: asNullableNumber(openingBalances?.property),
    gold: asNullableNumber(openingBalances?.gold),
    other: asNullableNumber(openingBalances?.otherNonFinancialAssets),
  };

  const rollingTotals = toSideBySideRolling({
    rollingRowsByBucket,
    nonFinancialSplitOpening,
  });

  const rollingStatusLabel = !rollingPlan
    ? "Preview only or not generated"
    : rollingPlan.status === "LOCKED"
      ? "Locked/frozen rolling projection"
      : "Draft rolling projection";

  const rollingUsesOldClose = Boolean(rollingPlan && latestClosed && rollingPlan.base_close_id && rollingPlan.base_close_id !== latestClosed.id);
  const staleHeuristic = rollingUsesOldClose || Boolean(rollingPlan && rollingPlan.status === "LOCKED" && latestClosed && rollingPlan.base_close_id !== latestClosed.id);

  const qaDashboardVsMonthly = (() => {
    const diff = asNumber(dashboardTotals["Net worth"]) - asNumber(monthlyTotals["Net worth"]);
    if (Math.abs(diff) < 1) {
      return "Dashboard and Monthly Review are effectively aligned for current compared bucket totals.";
    }
    return "Dashboard is live-table based while Monthly Review is workspace month_end_close_items based; differences indicate snapshot/live timing and dedupe behavior differences.";
  })();

  const qaRolling12Cr = (() => {
    const rollingNetWorth = rollingTotals["Net worth"];
    if (rollingNetWorth === null) {
      return "Rolling Aug 2026 rows are unavailable for the latest rolling plan.";
    }

    if (rollingUsesOldClose) {
      return "Rolling appears rebased from an older close_id than latest closed month, which can produce a materially different Aug 2026 net worth.";
    }

    return "Rolling Aug 2026 value comes from projection_monthly_positions and can diverge from dashboard/monthly when assumptions and locked version timing differ.";
  })();

  const monthlyGoldRows = closeItemsRes.rows.filter((row) => row.item_key === "gold");
  const liveGoldRows = goldRes.rows;

  const qaGold = liveGoldRows.length === 0
    ? monthlyGoldRows.length === 0
      ? "Gold is absent in both live gold_holdings and month_end_close_items gold rows."
      : "Gold is absent in live gold_holdings but present in month_end_close_items."
    : monthlyGoldRows.length === 0
      ? "Gold exists in live gold_holdings but no gold row exists in current month_end_close_items workspace."
      : "Gold exists in both live holdings and month_end_close_items.";

  const qaEpfNps = closeItemsRes.rows.length === 0
    ? "Monthly workspace rows are unavailable, so EPF/NPS source cannot be verified here."
    : "Monthly Review values on this page come from month_end_close_items workspace rows; Dashboard EPF/NPS comes from live retirement modules and may also include investment-classified retirement rows.";

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Net Worth Reconciliation"
          description="Read-only item-wise reconciliation across Dashboard/Balance Sheet, Monthly Review workspace, and Rolling Projection for July/August diagnostics."
          summary="Read-only diagnostics with an explicit incident-scoped repair action for the August draft close."
        />

        <RebuildDraftAction closeId={INCIDENT_CLOSE_ID} action={rebuildAugustDraftAction} />

        <DashboardCard>
          <h2 className="text-lg font-semibold text-slate-900">Scope and Session</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p><span className="font-medium">User ID:</span> {user.id}</p>
            <p><span className="font-medium">Workspace Close ID:</span> {workspaceClose?.id ?? "N/A"}</p>
            <p><span className="font-medium">Workspace Month:</span> {workspaceClose ? monthKeyFromYearMonth(workspaceClose.close_year, workspaceClose.close_month) : "N/A"}</p>
            <p><span className="font-medium">Workspace Status:</span> {workspaceClose?.status ?? "N/A"}</p>
            <p><span className="font-medium">Latest Closed Close ID:</span> {latestClosed?.id ?? "N/A"}</p>
            <p><span className="font-medium">Latest Closed Month:</span> {latestClosed ? monthKeyFromYearMonth(latestClosed.close_year, latestClosed.close_month) : "N/A"}</p>
          </div>
          {errors.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium">Read warnings</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-lg font-semibold text-slate-900">1. Dashboard / Balance Sheet Source (Live Tables)</h2>
          <p className="mt-1 text-sm text-slate-600">Source: live modules (bank_accounts, investments, retirement, property, gold/silver, assets, liabilities).</p>
          <div className="mt-4 overflow-auto">
            <table className="min-w-[1080px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Bucket</th>
                  <th className="px-2 py-2">Item Name</th>
                  <th className="px-2 py-2">Source Table</th>
                  <th className="px-2 py-2">Source Record ID</th>
                  <th className="px-2 py-2">Owner</th>
                  <th className="px-2 py-2 text-right">Amount Used</th>
                  <th className="px-2 py-2">Included in Net Worth</th>
                  <th className="px-2 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {dashboardRows.map((row) => (
                  <tr key={`${row.sourceTable}:${row.sourceRecordId}:${row.bucket}`} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-2">{row.bucket}</td>
                    <td className="px-2 py-2">{row.itemName}</td>
                    <td className="px-2 py-2">{row.sourceTable}</td>
                    <td className="px-2 py-2 font-mono text-xs">{row.sourceRecordId}</td>
                    <td className="px-2 py-2">{row.owner}</td>
                    <td className="px-2 py-2 text-right">{formatAmount(row.amountUsed)}</td>
                    <td className="px-2 py-2">{row.includedInNetWorth ? "yes" : "no"}</td>
                    <td className="px-2 py-2 text-slate-600">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Assets</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{formatAmount(dashboardTotals["Total assets"])}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Liabilities</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{formatAmount(dashboardTotals["Total liabilities"])}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Net Worth</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{formatAmount(dashboardTotals["Net worth"])}</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-lg font-semibold text-slate-900">2. Monthly Review Source (Current Workspace)</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p><span className="font-medium">close_id:</span> {workspaceClose?.id ?? "N/A"}</p>
            <p><span className="font-medium">close_year:</span> {workspaceClose?.close_year ?? "N/A"}</p>
            <p><span className="font-medium">close_month:</span> {workspaceClose?.close_month ?? "N/A"}</p>
            <p><span className="font-medium">version_number:</span> {workspaceClose?.version_number ?? "N/A"}</p>
            <p><span className="font-medium">status:</span> {workspaceClose?.status ?? "N/A"}</p>
            <p><span className="font-medium">latest closed close_id:</span> {latestClosed?.id ?? "N/A"}</p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Duplicate Verification</p>
            <p className="mt-1 text-sm text-slate-600">These groups should be zero after rebuilding the August draft from canonical sources.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {duplicateVerificationKeys.map((itemKey) => {
                const matches = currentDuplicateGroups.filter((group) => group.itemKey === itemKey);
                return (
                  <div key={itemKey} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-medium text-slate-900">{itemKey}</p>
                    <p className={matches.length === 0 ? "mt-1 text-emerald-700" : "mt-1 text-rose-700"}>
                      {matches.length === 0 ? "No duplicate groups remaining" : `${matches.length} duplicate group(s) remain`}
                    </p>
                  </div>
                );
              })}
            </div>
            {currentDuplicateGroups.length > 0 ? (
              <div className="mt-4 overflow-auto">
                <table className="min-w-[880px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Item Key</th>
                      <th className="px-2 py-2">Entity Name</th>
                      <th className="px-2 py-2 text-right">Row Count</th>
                      <th className="px-2 py-2">Entity Types</th>
                      <th className="px-2 py-2">Entity IDs</th>
                      <th className="px-2 py-2 text-right">Total Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDuplicateGroups.map((group) => (
                      <tr key={group.groupKey} className="border-b border-slate-100 align-top">
                        <td className="px-2 py-2">{group.itemKey}</td>
                        <td className="px-2 py-2">{group.entityName}</td>
                        <td className="px-2 py-2 text-right">{group.rowCount}</td>
                        <td className="px-2 py-2">{group.entityTypes.join(", ")}</td>
                        <td className="px-2 py-2 font-mono text-xs">{group.entityIds.join(", ")}</td>
                        <td className="px-2 py-2 text-right">{formatAmount(group.totalActualValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-emerald-700">No duplicate economic groups are present in the current draft rows.</p>
            )}
          </div>

          <div className="mt-4 overflow-auto">
            <table className="min-w-[1180px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Entity Type</th>
                  <th className="px-2 py-2">Entity ID</th>
                  <th className="px-2 py-2">Entity Name</th>
                  <th className="px-2 py-2">Item Key</th>
                  <th className="px-2 py-2">Item Label</th>
                  <th className="px-2 py-2 text-right">Opening</th>
                  <th className="px-2 py-2 text-right">Projected</th>
                  <th className="px-2 py-2 text-right">Actual</th>
                  <th className="px-2 py-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {closeItemsRes.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-2 font-mono text-xs">{row.id}</td>
                    <td className="px-2 py-2">{row.entity_type}</td>
                    <td className="px-2 py-2 font-mono text-xs">{row.entity_id}</td>
                    <td className="px-2 py-2">{row.entity_name}</td>
                    <td className="px-2 py-2">{row.item_key}</td>
                    <td className="px-2 py-2">{row.item_label}</td>
                    <td className="px-2 py-2 text-right">{formatAmount(asNumber(row.opening_value))}</td>
                    <td className="px-2 py-2 text-right">{formatAmount(asNumber(row.projected_value))}</td>
                    <td className="px-2 py-2 text-right">{formatAmount(asNumber(row.actual_value))}</td>
                    <td className="px-2 py-2 text-right">{formatAmount(asNumber(row.absolute_variance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCell label="Cash" value={monthlyAgg.totalsByKey.bank_accounts} />
            <SummaryCell label="Mutual funds" value={monthlyAgg.totalsByKey.mutual_funds} />
            <SummaryCell label="Stocks" value={monthlyAgg.totalsByKey.stocks} />
            <SummaryCell label="EPF" value={monthlyAgg.totalsByKey.epf} />
            <SummaryCell label="PPF" value={monthlyAgg.totalsByKey.ppf} />
            <SummaryCell label="NPS" value={monthlyAgg.totalsByKey.nps} />
            <SummaryCell label="Property" value={monthlyAgg.totalsByKey.real_estate} />
            <SummaryCell label="Gold" value={monthlyAgg.totalsByKey.gold} />
            <SummaryCell label="Silver" value={monthlyAgg.totalsByKey.silver} />
            <SummaryCell label="Other assets" value={monthlyAgg.totalsByKey.other_assets} />
            <SummaryCell label="Liabilities" value={monthlyAgg.totalLiabilities} />
            <SummaryCell label="Net worth" value={monthlyAgg.netWorth} />
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-lg font-semibold text-slate-900">3. Rolling Projection Source</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p><span className="font-medium">Mode:</span> {rollingStatusLabel}</p>
            <p><span className="font-medium">Stale heuristic:</span> {staleHeuristic ? "yes" : "no"}</p>
            <p><span className="font-medium">Rolling plan version id:</span> {rollingPlan?.id ?? "N/A"}</p>
            <p><span className="font-medium">Version number:</span> {rollingPlan?.version_no ?? "N/A"}</p>
            <p><span className="font-medium">Status:</span> {rollingPlan?.status ?? "N/A"}</p>
            <p><span className="font-medium">Linked fixed projection version:</span> {linkedFixedVersion ?? "N/A"}{latestFixedVersion > 0 ? ` (latest fixed v${latestFixedVersion})` : ""}</p>
            <p><span className="font-medium">base_close_id:</span> {rollingPlan?.base_close_id ?? "N/A"}</p>
            <p><span className="font-medium">rebased_from_close_id:</span> {rebase?.rebased_from_close_id ?? "N/A"}</p>
            <p><span className="font-medium">rebased month:</span> {rebase ? normalizeMonthKey(rebase.rebased_month) : "N/A"}</p>
            <p><span className="font-medium">latest closed close_id:</span> {latestClosed?.id ?? "N/A"}</p>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="min-w-[1180px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Bucket</th>
                  <th className="px-2 py-2 text-right">Opening</th>
                  <th className="px-2 py-2 text-right">Contribution</th>
                  <th className="px-2 py-2 text-right">Growth</th>
                  <th className="px-2 py-2 text-right">Withdrawal</th>
                  <th className="px-2 py-2 text-right">Closing</th>
                  <th className="px-2 py-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "cash", label: "Cash" },
                  { key: "mutual_funds", label: "Mutual funds" },
                  { key: "stocks", label: "Stocks" },
                  { key: "epf", label: "EPF" },
                  { key: "ppf", label: "PPF" },
                  { key: "nps", label: "NPS" },
                  { key: "non_financial_assets_total", label: "Property + Gold + Other non-financial assets" },
                  { key: "liabilities", label: "Liabilities" },
                  { key: "net_worth", label: "Net worth" },
                ].map((entry) => {
                  const row = rollingRowsByBucket.get(entry.key);
                  return (
                    <tr key={entry.key} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-2">{entry.label}</td>
                      <td className="px-2 py-2 text-right">{formatAmount(row ? asNumber(row.opening_value) : null)}</td>
                      <td className="px-2 py-2 text-right">{formatAmount(row ? asNumber(row.contribution) : null)}</td>
                      <td className="px-2 py-2 text-right">{formatAmount(row ? asNumber(row.growth) : null)}</td>
                      <td className="px-2 py-2 text-right">{formatAmount(row ? asNumber(row.withdrawal) : null)}</td>
                      <td className="px-2 py-2 text-right">{formatAmount(row ? asNumber(row.closing_value) : null)}</td>
                      <td className="px-2 py-2 font-mono text-xs text-slate-600">{row ? jsonCompact(row.metadata ?? {}) : "N/A"}</td>
                    </tr>
                  );
                })}
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2">Property (opening split from snapshot)</td>
                  <td className="px-2 py-2 text-right">{formatAmount(nonFinancialSplitOpening.property)}</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-slate-600">Rolling V1 does not persist separate property monthly bucket.</td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2">Gold (opening split from snapshot)</td>
                  <td className="px-2 py-2 text-right">{formatAmount(nonFinancialSplitOpening.gold)}</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-slate-600">Rolling V1 combines gold + silver into non_financial_assets_total thereafter.</td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2">Other non-financial assets (opening split from snapshot)</td>
                  <td className="px-2 py-2 text-right">{formatAmount(nonFinancialSplitOpening.other)}</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-right">N/A</td>
                  <td className="px-2 py-2 text-slate-600">No dedicated monthly bucket for split values in projection_monthly_positions.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-lg font-semibold text-slate-900">4. Side-by-Side Comparison</h2>
          <div className="mt-4 overflow-auto">
            <table className="min-w-[1320px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Bucket</th>
                  <th className="px-2 py-2 text-right">Dashboard Value</th>
                  <th className="px-2 py-2 text-right">Monthly Review Value</th>
                  <th className="px-2 py-2 text-right">Rolling Value</th>
                  <th className="px-2 py-2 text-right">Dashboard vs Monthly</th>
                  <th className="px-2 py-2 text-right">Rolling vs Monthly</th>
                  <th className="px-2 py-2">Likely Cause</th>
                  <th className="px-2 py-2">Action Required</th>
                </tr>
              </thead>
              <tbody>
                {SIDE_BY_SIDE_BUCKETS.map((bucket) => {
                  const d = dashboardTotals[bucket] ?? null;
                  const m = monthlyTotals[bucket] ?? null;
                  const r = rollingTotals[bucket] ?? null;
                  const dm = d === null || m === null ? null : d - m;
                  const rm = r === null || m === null ? null : r - m;

                  return (
                    <tr key={bucket} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-2">{bucket}</td>
                      <td className="px-2 py-2 text-right">{formatAmount(d)}</td>
                      <td className="px-2 py-2 text-right">{formatAmount(m)}</td>
                      <td className="px-2 py-2 text-right">{formatAmount(r)}</td>
                      <td className="px-2 py-2 text-right">{fmtDiff(dm)}</td>
                      <td className="px-2 py-2 text-right">{fmtDiff(rm)}</td>
                      <td className="px-2 py-2 text-slate-600">{likelyCause(bucket, d, m, r)}</td>
                      <td className="px-2 py-2 text-slate-600">{recommendedAction(bucket, r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-lg font-semibold text-slate-900">5. Answers to Diagnostic Questions</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p><span className="font-medium">Why is Dashboard net worth different from Monthly Review net worth?</span> {qaDashboardVsMonthly}</p>
            <p><span className="font-medium">Why is Rolling Projection showing around Rs 12.02 Cr?</span> {qaRolling12Cr}</p>
            <p><span className="font-medium">Is Rolling using stale preview data?</span> {rollingPlan ? (staleHeuristic ? "Likely yes based on stale-close heuristic." : "No clear stale-close signal from persisted rolling metadata.") : "Cannot confirm preview state from server; client preview is in-memory only."}</p>
            <p><span className="font-medium">Is Rolling using old month-end close data?</span> {rollingPlan?.base_close_id ? (latestClosed && rollingPlan.base_close_id !== latestClosed.id ? "Yes, base_close_id differs from latest closed close_id." : "No, base_close_id matches latest closed close_id.") : "No base_close_id found."}</p>
            <p><span className="font-medium">Which close_id should Rolling use?</span> {latestClosed?.id ?? "N/A"}</p>
            <p><span className="font-medium">Which close_id is Rolling actually using?</span> {rollingPlan?.base_close_id ?? "N/A"}</p>
            <p><span className="font-medium">Has Monthly Review net worth been recalculated from cleaned draft rows?</span> {currentDuplicateGroups.length === 0 ? "Yes. The displayed Monthly Review totals are derived from the current draft month_end_close_items and no duplicate groups remain in the tracked incident buckets." : "Not yet fully clean. Duplicate groups still remain in current draft rows, so Monthly Review totals may still be inflated."}</p>
            <p><span className="font-medium">Are EPF / NPS values coming from retirement accounts or stale month_end_close_items?</span> {qaEpfNps}</p>
            <p><span className="font-medium">Is Gold missing because no live gold_holding exists or because month_end_close_items has no gold row?</span> {qaGold}</p>
          </div>
        </DashboardCard>
      </PageContainer>
    </AppLayout>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{formatAmount(value)}</p>
    </div>
  );
}
