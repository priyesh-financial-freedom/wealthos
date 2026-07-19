import type { AllocationItem } from "@/services/finance";
import { supabase } from "@/lib/supabase/client";
import type {
  Investment,
  InvestmentCategory,
  InvestmentExposure,
  InvestmentInsert,
  InvestmentUpdate,
} from "@/types/investment";

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
  todaysGainLoss: number;
  overallGain: number;
  xirr: number | null;
  cagr: number | null;
  costBasis: number;
  assetAllocation: AllocationItem[];
  sectorAllocation: AllocationItem[];
  amcAllocation: AllocationItem[];
  equityDebtAllocation: AllocationItem[];
  regionAllocation: AllocationItem[];
  largestHolding: Investment | null;
}

interface Cashflow {
  date: Date;
  amount: number;
}

const debtCategories = new Set<InvestmentCategory>(["Bonds", "Fixed Deposits", "EPF", "PPF", "NPS", "Cash Equivalents", "Sovereign Gold Bonds"]);

function getCurrentValue(investment: Pick<Investment, "units" | "nav_price">) {
  return Number(investment.units ?? 0) * Number(investment.nav_price ?? 0);
}

function getGainLoss(investment: Pick<Investment, "units" | "nav_price" | "cost_basis">) {
  return getCurrentValue(investment) - Number(investment.cost_basis ?? 0);
}

function formatInvestmentRow(investment: Investment): Investment {
  const currentValue = getCurrentValue(investment);
  const gainLoss = getGainLoss(investment);

  return {
    ...investment,
    current_value: currentValue,
    gain_loss: gainLoss,
    cagr: null,
    xirr: null,
    exposure: classifyExposure(investment.category),
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

  const { data, error } = await client.from("investments").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => formatInvestmentRow(item as Investment));
}

export async function createInvestment(input: InvestmentInsert): Promise<Investment> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("investments")
    .insert({
      ...input,
      user_id: user.id,
      region: input.region ?? "Domestic",
      today_gain_loss: input.today_gain_loss ?? 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return formatInvestmentRow(data as Investment);
}

export async function updateInvestment(input: InvestmentUpdate): Promise<Investment> {
  const { client, user } = await requireAuthenticatedUser();

  const { id, ...updates } = input;
  const { data, error } = await client
    .from("investments")
    .update({
      ...updates,
      region: updates.region ?? "Domestic",
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return formatInvestmentRow(data as Investment);
}

export async function deleteInvestment(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("investments").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function buildInvestmentSummary(investments: Investment[]): InvestmentSummarySnapshot {
  const totalInvestmentValue = investments.reduce((sum, investment) => sum + Number(investment.current_value ?? 0), 0);
  const todaysGainLoss = investments.reduce((sum, investment) => sum + Number(investment.today_gain_loss ?? 0), 0);
  const costBasis = investments.reduce((sum, investment) => sum + Number(investment.cost_basis ?? 0), 0);
  const overallGain = totalInvestmentValue - costBasis;

  return {
    totalInvestmentValue,
    todaysGainLoss,
    overallGain,
    xirr: null,
    cagr: null,
    costBasis,
    assetAllocation: groupAllocation(investments, (investment) => investment.category, (investment) => Number(investment.current_value ?? 0)),
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

export function buildInvestmentInsights(summary: InvestmentSummarySnapshot): InvestmentInsight[] {
  return [];
}

function getOldestPurchaseDate(investments: Investment[]) {
  const purchases = investments.map((investment) => investment.purchase_date).filter(Boolean) as string[];
  if (purchases.length === 0) {
    return null;
  }

  return purchases.reduce((earliest, current) => (new Date(current) < new Date(earliest) ? current : earliest), purchases[0]);
}