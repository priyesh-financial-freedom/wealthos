import type { AllocationItem } from "@/services/finance";
import { supabase } from "@/lib/supabase/client";
import type {
  Investment,
  InvestmentCategory,
  InvestmentExposure,
  InvestmentMonthlyHistory,
  InvestmentMonthlyHistoryInsert,
  InvestmentMonthlyHistoryUpdate,
  InvestmentInsert,
  InvestmentStatus,
  InvestmentUpdate,
} from "@/types/investment";

const HOLDINGS_TABLE = "investment_holdings";
const HISTORY_TABLE = "investment_monthly_history";
const LEGACY_TABLE = "investments";

const CORE_CATEGORY_ORDER: InvestmentCategory[] = [
  "Mutual Funds",
  "Stocks",
  "Bonds",
  "Fixed Deposits",
  "Gold",
  "ESOPs",
  "Startup Investments",
  "Other Investments",
];

const retirementInvestmentCategories = new Set<InvestmentCategory>(["EPF", "PPF", "NPS"]);
const fixedDepositCategories = new Set<InvestmentCategory>(["Fixed Deposits"]);
const preciousMetalCategories = new Set<InvestmentCategory>(["Gold", "Silver", "Sovereign Gold Bonds"]);

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

export interface InvestmentSummarySnapshot {
  totalInvestmentValue: number;
  monthlyChange: number;
  activeInvestmentsCount: number;
  costBasis: number;
  todaysGainLoss: number;
  overallGain: number;
  xirr: number | null;
  cagr: number | null;
  assetAllocation: AllocationItem[];
  categorySummaries: Array<{
    category: InvestmentCategory;
    totalValue: number;
    holdingsCount: number;
    monthlyChange: number;
  }>;
  sectorAllocation: AllocationItem[];
  amcAllocation: AllocationItem[];
  equityDebtAllocation: AllocationItem[];
  regionAllocation: AllocationItem[];
  largestHolding: Investment | null;
}

export interface InvestmentBalanceSheetSummary {
  coreInvestmentsValue: number;
  retirementClassifiedValue: number;
  fixedDepositClassifiedValue: number;
  preciousMetalClassifiedValue: number;
  totalInvestmentValue: number;
}

const debtCategories = new Set<InvestmentCategory>(["Bonds", "Fixed Deposits", "EPF", "PPF", "NPS", "Cash Equivalents", "Sovereign Gold Bonds"]);

function isMissingRelationError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("does not exist") || normalized.includes("relation") && normalized.includes("not found");
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeCategory(value: string | null | undefined): InvestmentCategory {
  const normalized = (value ?? "").trim();
  const exactMatch = CORE_CATEGORY_ORDER.find((item) => item === normalized);
  if (exactMatch) {
    return exactMatch;
  }

  const legacyCategories: InvestmentCategory[] = [
    "ETFs",
    "EPF",
    "PPF",
    "NPS",
    "Silver",
    "Sovereign Gold Bonds",
    "Crypto",
    "Cash Equivalents",
  ];
  const legacyMatch = legacyCategories.find((item) => item === normalized);
  if (legacyMatch) {
    return legacyMatch;
  }

  return "Other Investments";
}

function normalizeStatus(value: string | null | undefined): InvestmentStatus {
  if (value === "active" || value === "inactive" || value === "closed") {
    return value;
  }

  return "active";
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function mapHoldingRowToInvestment(params: {
  row: Record<string, unknown>;
  monthlyChange: number;
  currentMonthValue: number | null;
  previousMonthValue: number | null;
}): Investment {
  const row = params.row;
  const category = normalizeCategory(String((row.investment_type ?? row.category ?? "Other Investments") as string));
  const costValue = toNumber(row.cost_value ?? row.cost_basis);
  const currentValue = toNumber(row.current_value);
  const units = toNumber(row.units);
  const navPrice = toNumber(row.nav_price);

  const currentFromUnitsAndNav = Number((units * navPrice).toFixed(2));
  const fallbackCurrentValue =
    params.currentMonthValue !== null
      ? toNumber(params.currentMonthValue)
      : (currentFromUnitsAndNav > 0 ? currentFromUnitsAndNav : currentValue);
  const effectiveCurrentValue = Number.isFinite(fallbackCurrentValue) ? fallbackCurrentValue : 0;
  const effectiveCostValue = Number.isFinite(costValue) ? costValue : 0;
  const computedGainLoss = effectiveCurrentValue - effectiveCostValue;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    owner: row.owner ? String(row.owner) : null,
    institution: row.institution ? String(row.institution) : (row.amc ? String(row.amc) : null),
    investment_name: String(row.investment_name ?? "Untitled Investment"),
    investment_type: category,
    category,
    acquisition_date: normalizeDate((row.acquisition_date ?? row.purchase_date) as string | null | undefined),
    cost_value: effectiveCostValue,
    current_value: effectiveCurrentValue,
    status: normalizeStatus((row.status as string | null | undefined) ?? "active"),
    notes: row.notes ? String(row.notes) : null,
    documents_placeholder: row.documents_placeholder ? String(row.documents_placeholder) : null,
    monthly_change: toNumber(params.monthlyChange),
    current_month_value: params.currentMonthValue,
    previous_month_value: params.previousMonthValue,
    cost_basis: effectiveCostValue,
    purchase_date: normalizeDate((row.acquisition_date ?? row.purchase_date) as string | null | undefined),
    units,
    nav_price: navPrice,
    today_gain_loss: computedGainLoss,
    sector: row.sector ? String(row.sector) : null,
    amc: row.amc ? String(row.amc) : null,
    region: (row.region as "Domestic" | "International" | null) ?? "Domestic",
    folio_number: row.folio_number ? String(row.folio_number) : null,
    amfi_scheme_code: row.amfi_scheme_code ? String(row.amfi_scheme_code) : null,
    sip_amount: row.sip_amount === null || row.sip_amount === undefined ? null : toNumber(row.sip_amount),
    sip_date: row.sip_date === null || row.sip_date === undefined ? null : toNumber(row.sip_date),
    investment_mode: (row.investment_mode as "Direct" | "Regular" | null) ?? null,
    option_type: (row.option_type as "Growth" | "IDCW" | null) ?? null,
    broker_platform: row.broker_platform ? String(row.broker_platform) : null,
    nominee: row.nominee ? String(row.nominee) : null,
    broker: row.broker ? String(row.broker) : null,
    exchange: row.exchange ? String(row.exchange) : null,
    isin: row.isin ? String(row.isin) : null,
    average_purchase_price: row.average_purchase_price === null || row.average_purchase_price === undefined ? null : toNumber(row.average_purchase_price),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    gain_loss: computedGainLoss,
    cagr: null,
    xirr: null,
    exposure: classifyExposure(category),
  };
}

function classifyExposure(category: InvestmentCategory): InvestmentExposure {
  return debtCategories.has(category) ? "debt" : "equity";
}

function groupAllocation<T>(items: T[], getLabel: (item: T) => string, getValue: (item: T) => number): AllocationItem[] {
  const grouped = items.reduce<Record<string, number>>((acc, item) => {
    const key = getLabel(item) || "Unspecified";
    acc[key] = (acc[key] ?? 0) + Number(getValue(item) ?? 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);
}

export async function getInvestments(): Promise<Investment[]> {
  const { client, user } = await requireAuthenticatedUser();

  const holdingsResponse = await client.from(HOLDINGS_TABLE).select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  if (holdingsResponse.error && !isMissingRelationError(holdingsResponse.error.message)) {
    throw new Error(holdingsResponse.error.message);
  }

  const usingLegacyTable = Boolean(holdingsResponse.error && isMissingRelationError(holdingsResponse.error.message));

  const holdingsData = usingLegacyTable
    ? (await client.from(LEGACY_TABLE).select("*").eq("user_id", user.id).order("created_at", { ascending: false })).data ?? []
    : holdingsResponse.data ?? [];

  if (usingLegacyTable) {
    const legacyResponse = await client.from(LEGACY_TABLE).select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (legacyResponse.error) {
      throw new Error(legacyResponse.error.message);
    }

    return (legacyResponse.data ?? []).map((row) => mapHoldingRowToInvestment({
      row: row as Record<string, unknown>,
      monthlyChange: 0,
      currentMonthValue: null,
      previousMonthValue: null,
    }));
  }

  const ids = (holdingsData as Array<Record<string, unknown>>).map((row) => String(row.id));
  const historyByInvestment = new Map<string, Array<{ closingValue: number; monthEndDate: string }>>();

  if (ids.length > 0) {
    const historyResponse = await client
      .from(HISTORY_TABLE)
      .select("investment_id, month_end_date, closing_value")
      .eq("user_id", user.id)
      .in("investment_id", ids)
      .order("month_end_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (historyResponse.error && !isMissingRelationError(historyResponse.error.message)) {
      throw new Error(historyResponse.error.message);
    }

    if (!historyResponse.error) {
      for (const row of historyResponse.data ?? []) {
        const investmentId = String(row.investment_id);
        const list = historyByInvestment.get(investmentId) ?? [];
        if (list.length < 2) {
          list.push({
            monthEndDate: String(row.month_end_date),
            closingValue: toNumber(row.closing_value),
          });
          historyByInvestment.set(investmentId, list);
        }
      }
    }
  }

  return (holdingsData as Array<Record<string, unknown>>).map((row) => {
    const snapshots = historyByInvestment.get(String(row.id)) ?? [];
    const latest = snapshots[0] ?? null;
    const previous = snapshots[1] ?? null;
    const monthlyChange = latest && previous ? latest.closingValue - previous.closingValue : 0;

    return mapHoldingRowToInvestment({
      row,
      monthlyChange,
      currentMonthValue: latest?.closingValue ?? null,
      previousMonthValue: previous?.closingValue ?? null,
    });
  });
}

export async function createInvestment(input: InvestmentInsert): Promise<Investment> {
  const { client, user } = await requireAuthenticatedUser();

  const category = normalizeCategory(String(input.investment_type ?? input.category ?? "Other Investments"));
  const costValue = toNumber(input.cost_value ?? input.cost_basis);
  const units = toNumber(input.units);
  const navPrice = toNumber(input.nav_price);
  const computedCurrentValue = Number((units * navPrice).toFixed(2));
  const currentValue =
    category === "Mutual Funds"
      ? computedCurrentValue
      : toNumber(input.current_value ?? (computedCurrentValue || costValue));
  const payload = {
    user_id: user.id,
    owner: input.owner ?? null,
    institution: input.institution ?? input.amc ?? input.broker ?? null,
    amc: input.amc ?? input.institution ?? null,
    investment_name: input.investment_name,
    investment_type: category,
    acquisition_date: normalizeDate(input.acquisition_date ?? input.purchase_date),
    purchase_date: normalizeDate(input.acquisition_date ?? input.purchase_date),
    amfi_scheme_code: input.amfi_scheme_code ?? null,
    folio_number: input.folio_number ?? null,
    nominee: input.nominee ?? null,
    investment_mode: input.investment_mode ?? null,
    option_type: input.option_type ?? null,
    broker_platform: input.broker_platform ?? null,
    region: input.region ?? "Domestic",
    sector: input.sector ?? null,
    units,
    nav_price: navPrice,
    sip_amount: input.sip_amount ?? null,
    sip_date: input.sip_date ?? null,
    cost_value: costValue,
    current_value: currentValue,
    status: normalizeStatus(input.status),
    notes: input.notes ?? null,
    documents_placeholder: input.documents_placeholder ?? null,
  };

  const createResponse = await client.from(HOLDINGS_TABLE).insert(payload).select("*").single();

  if (createResponse.error) {
    if (!isMissingRelationError(createResponse.error.message)) {
      throw new Error(createResponse.error.message);
    }

    const legacyResponse = await client
      .from(LEGACY_TABLE)
      .insert({
        ...input,
        user_id: user.id,
        category,
        region: input.region ?? "Domestic",
        cost_basis: costValue,
        nav_price: toNumber(input.nav_price || 1),
        units: toNumber(input.units || (currentValue > 0 ? currentValue / Math.max(toNumber(input.nav_price || 1), 1) : 0)),
        purchase_date: normalizeDate(input.acquisition_date ?? input.purchase_date),
        today_gain_loss: input.today_gain_loss ?? 0,
      })
      .select("*")
      .single();

    if (legacyResponse.error) {
      throw new Error(legacyResponse.error.message);
    }

    return mapHoldingRowToInvestment({
      row: legacyResponse.data as Record<string, unknown>,
      monthlyChange: 0,
      currentMonthValue: null,
      previousMonthValue: null,
    });
  }

  return mapHoldingRowToInvestment({
    row: createResponse.data as Record<string, unknown>,
    monthlyChange: 0,
    currentMonthValue: null,
    previousMonthValue: null,
  });
}

export async function updateInvestment(input: InvestmentUpdate): Promise<Investment> {
  const { client, user } = await requireAuthenticatedUser();

  const { id, ...updates } = input;

  const existingHoldingResponse = await client
    .from(HOLDINGS_TABLE)
    .select("investment_type, units, nav_price")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const existingHolding =
    existingHoldingResponse.error || !existingHoldingResponse.data
      ? null
      : (existingHoldingResponse.data as Record<string, unknown>);

  const inferredCategory = normalizeCategory(
    String(updates.investment_type ?? updates.category ?? existingHolding?.investment_type ?? "Other Investments"),
  );

  const patch: Record<string, unknown> = {};
  if (updates.owner !== undefined) {
    patch.owner = updates.owner;
  }
  if (updates.institution !== undefined) {
    patch.institution = updates.institution;
  }
  if (updates.investment_name !== undefined) {
    patch.investment_name = updates.investment_name;
  }
  if (updates.investment_type !== undefined || updates.category !== undefined) {
    patch.investment_type = normalizeCategory(String(updates.investment_type ?? updates.category));
  }
  if (updates.acquisition_date !== undefined || updates.purchase_date !== undefined) {
    patch.acquisition_date = normalizeDate(updates.acquisition_date ?? updates.purchase_date);
    patch.purchase_date = normalizeDate(updates.acquisition_date ?? updates.purchase_date);
  }
  if (updates.amc !== undefined || updates.institution !== undefined) {
    patch.amc = updates.amc ?? updates.institution ?? null;
  }
  if (updates.folio_number !== undefined) {
    patch.folio_number = updates.folio_number;
  }
  if (updates.amfi_scheme_code !== undefined) {
    patch.amfi_scheme_code = updates.amfi_scheme_code;
  }
  if (updates.nominee !== undefined) {
    patch.nominee = updates.nominee;
  }
  if (updates.investment_mode !== undefined) {
    patch.investment_mode = updates.investment_mode;
  }
  if (updates.option_type !== undefined) {
    patch.option_type = updates.option_type;
  }
  if (updates.broker_platform !== undefined) {
    patch.broker_platform = updates.broker_platform;
  }
  if (updates.region !== undefined) {
    patch.region = updates.region;
  }
  if (updates.sector !== undefined) {
    patch.sector = updates.sector;
  }
  if (updates.sip_amount !== undefined) {
    patch.sip_amount = updates.sip_amount;
  }
  if (updates.sip_date !== undefined) {
    patch.sip_date = updates.sip_date;
  }
  if (updates.cost_value !== undefined || updates.cost_basis !== undefined) {
    patch.cost_value = toNumber(updates.cost_value ?? updates.cost_basis);
  }
  if (updates.units !== undefined) {
    patch.units = toNumber(updates.units);
  }
  if (updates.nav_price !== undefined) {
    patch.nav_price = toNumber(updates.nav_price);
  }
  if (inferredCategory === "Mutual Funds") {
    const nextUnits = toNumber(updates.units ?? existingHolding?.units ?? 0);
    const nextNavPrice = toNumber(updates.nav_price ?? existingHolding?.nav_price ?? 0);
    patch.current_value = Number((nextUnits * nextNavPrice).toFixed(2));
  } else if (updates.current_value !== undefined) {
    patch.current_value = toNumber(updates.current_value);
  }
  if (updates.status !== undefined) {
    patch.status = normalizeStatus(updates.status);
  }
  if (updates.notes !== undefined) {
    patch.notes = updates.notes;
  }
  if (updates.documents_placeholder !== undefined) {
    patch.documents_placeholder = updates.documents_placeholder;
  }

  const updateResponse = await client.from(HOLDINGS_TABLE).update(patch).eq("id", id).eq("user_id", user.id).select("*").single();

  if (updateResponse.error) {
    if (!isMissingRelationError(updateResponse.error.message)) {
      throw new Error(updateResponse.error.message);
    }

    const legacyPatch: Record<string, unknown> = {
      ...updates,
    };

    if (updates.investment_type || updates.category) {
      legacyPatch.category = normalizeCategory(String(updates.investment_type ?? updates.category));
    }

    if (updates.cost_value !== undefined || updates.cost_basis !== undefined) {
      legacyPatch.cost_basis = toNumber(updates.cost_value ?? updates.cost_basis);
    }

    if (updates.current_value !== undefined && updates.units !== undefined && updates.nav_price === undefined && toNumber(updates.units) > 0) {
      legacyPatch.nav_price = toNumber(updates.current_value) / Math.max(toNumber(updates.units), 1);
    }

    if (updates.acquisition_date !== undefined || updates.purchase_date !== undefined) {
      legacyPatch.purchase_date = normalizeDate(updates.acquisition_date ?? updates.purchase_date);
    }

    if (updates.institution !== undefined && updates.amc === undefined) {
      legacyPatch.amc = updates.institution;
    }

    if (updates.documents_placeholder !== undefined) {
      legacyPatch.documents_placeholder = updates.documents_placeholder;
    }

    const legacyResponse = await client
      .from(LEGACY_TABLE)
      .update(legacyPatch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (legacyResponse.error) {
      throw new Error(legacyResponse.error.message);
    }

    return mapHoldingRowToInvestment({
      row: legacyResponse.data as Record<string, unknown>,
      monthlyChange: 0,
      currentMonthValue: null,
      previousMonthValue: null,
    });
  }

  return mapHoldingRowToInvestment({
    row: updateResponse.data as Record<string, unknown>,
    monthlyChange: 0,
    currentMonthValue: null,
    previousMonthValue: null,
  });
}

export async function deleteInvestment(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const response = await client.from(HOLDINGS_TABLE).delete().eq("id", id).eq("user_id", user.id);
  if (response.error) {
    if (!isMissingRelationError(response.error.message)) {
      throw new Error(response.error.message);
    }

    const legacyResponse = await client.from(LEGACY_TABLE).delete().eq("id", id).eq("user_id", user.id);
    if (legacyResponse.error) {
      throw new Error(legacyResponse.error.message);
    }
  }
}

export async function getInvestmentMonthlyHistory(investmentId?: string): Promise<InvestmentMonthlyHistory[]> {
  const { client, user } = await requireAuthenticatedUser();

  let query = client
    .from(HISTORY_TABLE)
    .select("*")
    .eq("user_id", user.id)
    .order("month_end_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (investmentId) {
    query = query.eq("investment_id", investmentId);
  }

  const response = await query;
  if (response.error) {
    if (isMissingRelationError(response.error.message)) {
      return [];
    }
    throw new Error(response.error.message);
  }

  return (response.data ?? []).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    investment_id: String(row.investment_id),
    month_end_date: String(row.month_end_date),
    closing_value: toNumber(row.closing_value),
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

async function syncHoldingCurrentValueFromHistory(params: {
  client: ReturnType<typeof assertSupabaseClient>;
  userId: string;
  investmentId: string;
}) {
  const latestHistory = await params.client
    .from(HISTORY_TABLE)
    .select("closing_value")
    .eq("user_id", params.userId)
    .eq("investment_id", params.investmentId)
    .order("month_end_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestHistory.error) {
    throw new Error(latestHistory.error.message);
  }

  if (!latestHistory.data) {
    const holdingResponse = await params.client
      .from(HOLDINGS_TABLE)
      .select("units, nav_price")
      .eq("id", params.investmentId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (holdingResponse.error && !isMissingRelationError(holdingResponse.error.message)) {
      throw new Error(holdingResponse.error.message);
    }

    if (holdingResponse.data) {
      const fallbackCurrentValue = Number((toNumber(holdingResponse.data.units) * toNumber(holdingResponse.data.nav_price)).toFixed(2));
      const fallbackSyncResponse = await params.client
        .from(HOLDINGS_TABLE)
        .update({ current_value: fallbackCurrentValue })
        .eq("id", params.investmentId)
        .eq("user_id", params.userId);

      if (fallbackSyncResponse.error && !isMissingRelationError(fallbackSyncResponse.error.message)) {
        throw new Error(fallbackSyncResponse.error.message);
      }
    }
    return;
  }

  const syncResponse = await params.client
    .from(HOLDINGS_TABLE)
    .update({ current_value: toNumber(latestHistory.data.closing_value) })
    .eq("id", params.investmentId)
    .eq("user_id", params.userId);

  if (syncResponse.error && !isMissingRelationError(syncResponse.error.message)) {
    throw new Error(syncResponse.error.message);
  }
}

export async function createInvestmentMonthlyHistory(input: InvestmentMonthlyHistoryInsert): Promise<InvestmentMonthlyHistory> {
  const { client, user } = await requireAuthenticatedUser();

  const payload = {
    user_id: user.id,
    investment_id: input.investment_id,
    month_end_date: normalizeDate(input.month_end_date),
    closing_value: toNumber(input.closing_value),
    notes: input.notes ?? null,
  };

  const response = await client
    .from(HISTORY_TABLE)
    .upsert(payload, {
      onConflict: "user_id,investment_id,month_end_date",
    })
    .select("*")
    .single();
  if (response.error) {
    throw new Error(response.error.message);
  }

  await syncHoldingCurrentValueFromHistory({
    client,
    userId: user.id,
    investmentId: input.investment_id,
  });

  return {
    id: String(response.data.id),
    user_id: String(response.data.user_id),
    investment_id: String(response.data.investment_id),
    month_end_date: String(response.data.month_end_date),
    closing_value: toNumber(response.data.closing_value),
    notes: response.data.notes ? String(response.data.notes) : null,
    created_at: String(response.data.created_at),
    updated_at: String(response.data.updated_at),
  };
}

export async function updateInvestmentMonthlyHistory(input: InvestmentMonthlyHistoryUpdate): Promise<InvestmentMonthlyHistory> {
  const { client, user } = await requireAuthenticatedUser();

  const patch: Record<string, unknown> = {};
  if (input.investment_id !== undefined) {
    patch.investment_id = input.investment_id;
  }
  if (input.month_end_date !== undefined) {
    patch.month_end_date = normalizeDate(input.month_end_date);
  }
  if (input.closing_value !== undefined) {
    patch.closing_value = toNumber(input.closing_value);
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  const response = await client.from(HISTORY_TABLE).update(patch).eq("id", input.id).select("*").single();
  if (response.error) {
    throw new Error(response.error.message);
  }

  await syncHoldingCurrentValueFromHistory({
    client,
    userId: user.id,
    investmentId: String(response.data.investment_id),
  });

  return {
    id: String(response.data.id),
    user_id: String(response.data.user_id),
    investment_id: String(response.data.investment_id),
    month_end_date: String(response.data.month_end_date),
    closing_value: toNumber(response.data.closing_value),
    notes: response.data.notes ? String(response.data.notes) : null,
    created_at: String(response.data.created_at),
    updated_at: String(response.data.updated_at),
  };
}

export async function deleteInvestmentMonthlyHistory(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const existing = await client
    .from(HISTORY_TABLE)
    .select("investment_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const response = await client.from(HISTORY_TABLE).delete().eq("id", id).eq("user_id", user.id);
  if (response.error) {
    throw new Error(response.error.message);
  }

  if (existing.data?.investment_id) {
    await syncHoldingCurrentValueFromHistory({
      client,
      userId: user.id,
      investmentId: String(existing.data.investment_id),
    });
  }
}

export function buildInvestmentSummary(investments: Investment[]): InvestmentSummarySnapshot {
  const totalInvestmentValue = investments.reduce((sum, investment) => sum + Number(investment.current_value ?? 0), 0);
  const monthlyChange = investments.reduce((sum, investment) => sum + Number(investment.monthly_change ?? 0), 0);
  const activeInvestmentsCount = investments.filter((investment) => investment.status === "active").length;
  const todaysGainLoss = investments.reduce((sum, investment) => sum + Number(investment.today_gain_loss ?? investment.monthly_change ?? 0), 0);
  const costBasis = investments.reduce((sum, investment) => sum + Number(investment.cost_basis ?? 0), 0);
  const overallGain = totalInvestmentValue - costBasis;

  const categorySummaries = CORE_CATEGORY_ORDER.map((category) => {
    const categoryInvestments = investments.filter((investment) => investment.category === category);
    return {
      category,
      totalValue: categoryInvestments.reduce((sum, investment) => sum + Number(investment.current_value ?? 0), 0),
      holdingsCount: categoryInvestments.filter((investment) => investment.status === "active").length,
      monthlyChange: categoryInvestments.reduce((sum, investment) => sum + Number(investment.monthly_change ?? 0), 0),
    };
  });

  return {
    totalInvestmentValue,
    monthlyChange,
    activeInvestmentsCount,
    costBasis,
    todaysGainLoss,
    overallGain,
    xirr: null,
    cagr: null,
    assetAllocation: groupAllocation(investments, (investment) => investment.category, (investment) => Number(investment.current_value ?? 0)),
    categorySummaries,
    sectorAllocation: [],
    amcAllocation: [],
    equityDebtAllocation: [],
    regionAllocation: [],
    largestHolding: investments.reduce<Investment | null>((current, investment) => {
      if (!current || Number(investment.current_value ?? 0) > Number(current.current_value ?? 0)) {
        return investment;
      }

      return current;
    }, null),
  };
}

export function getTopInvestments(investments: Investment[], limit = 10) {
  return [...investments]
    .sort((left, right) => Number(right.current_value ?? 0) - Number(left.current_value ?? 0))
    .slice(0, limit);
}

export function getRecentInvestments(investments: Investment[], limit = 3) {
  return [...investments]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, limit);
}

export interface InvestmentInsight {
  title: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}

export function buildInvestmentInsights(): InvestmentInsight[] {
  return [];
}

export function buildInvestmentBalanceSheetSummary(investments: Investment[]): InvestmentBalanceSheetSummary {
  return investments.reduce<InvestmentBalanceSheetSummary>(
    (acc, investment) => {
      const currentValue = Number(investment.current_value ?? 0);

      if (retirementInvestmentCategories.has(investment.category)) {
        acc.retirementClassifiedValue += currentValue;
      } else if (fixedDepositCategories.has(investment.category)) {
        acc.fixedDepositClassifiedValue += currentValue;
      } else if (preciousMetalCategories.has(investment.category)) {
        acc.preciousMetalClassifiedValue += currentValue;
      } else {
        acc.coreInvestmentsValue += currentValue;
      }

      acc.totalInvestmentValue += currentValue;
      return acc;
    },
    {
      coreInvestmentsValue: 0,
      retirementClassifiedValue: 0,
      fixedDepositClassifiedValue: 0,
      preciousMetalClassifiedValue: 0,
      totalInvestmentValue: 0,
    },
  );
}

export async function getInvestmentBalanceSheetSummary(): Promise<InvestmentBalanceSheetSummary> {
  const investments = await getInvestments();
  return buildInvestmentBalanceSheetSummary(investments);
}