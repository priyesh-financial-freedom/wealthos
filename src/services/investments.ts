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

function calculateCagr(costBasis: number, currentValue: number, purchaseDate: string | null) {
  if (!purchaseDate || costBasis <= 0 || currentValue <= 0) {
    return null;
  }

  const purchase = new Date(purchaseDate);
  if (Number.isNaN(purchase.getTime())) {
    return null;
  }

  const days = Math.max(1, (Date.now() - purchase.getTime()) / (1000 * 60 * 60 * 24));
  const years = days / 365.25;

  if (years <= 0) {
    return null;
  }

  return Math.pow(currentValue / costBasis, 1 / years) - 1;
}

function calculateXirr(cashflows: Cashflow[]) {
  const validCashflows = cashflows.filter((entry) => Number.isFinite(entry.amount) && entry.amount !== 0);
  if (validCashflows.length < 2) {
    return null;
  }

  const hasPositive = validCashflows.some((entry) => entry.amount > 0);
  const hasNegative = validCashflows.some((entry) => entry.amount < 0);
  if (!hasPositive || !hasNegative) {
    return null;
  }

  const baseDate = validCashflows.reduce((earliest, entry) => (entry.date < earliest ? entry.date : earliest), validCashflows[0].date);
  let rate = 0.1;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    let f = 0;
    let derivative = 0;

    for (const cashflow of validCashflows) {
      const years = (cashflow.date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      const denominator = Math.pow(1 + rate, years);
      f += cashflow.amount / denominator;
      derivative -= (years * cashflow.amount) / (Math.pow(1 + rate, years + 1));
    }

    if (Math.abs(f) < 1e-7) {
      return rate;
    }

    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-10) {
      break;
    }

    const nextRate = rate - f / derivative;
    if (!Number.isFinite(nextRate)) {
      break;
    }

    if (Math.abs(nextRate - rate) < 1e-7) {
      return nextRate;
    }

    rate = nextRate;
  }

  return null;
}

function formatInvestmentRow(investment: Investment): Investment {
  const currentValue = getCurrentValue(investment);
  const gainLoss = getGainLoss(investment);
  const cagr = calculateCagr(Number(investment.cost_basis ?? 0), currentValue, investment.purchase_date);
  const xirr = calculateXirr([
    ...(investment.purchase_date
      ? [
          {
            date: new Date(investment.purchase_date),
            amount: -Number(investment.cost_basis ?? 0),
          },
        ]
      : []),
    {
      date: new Date(),
      amount: currentValue,
    },
  ]);

  return {
    ...investment,
    current_value: currentValue,
    gain_loss: gainLoss,
    cagr,
    xirr,
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
  const decorated = investments.map((investment) => formatInvestmentRow(investment));
  const totalInvestmentValue = decorated.reduce((sum, investment) => sum + investment.current_value, 0);
  const todaysGainLoss = decorated.reduce((sum, investment) => sum + Number(investment.today_gain_loss ?? 0), 0);
  const costBasis = decorated.reduce((sum, investment) => sum + Number(investment.cost_basis ?? 0), 0);
  const overallGain = totalInvestmentValue - costBasis;
  const cagr = calculateCagr(costBasis, totalInvestmentValue, decorated.length > 0 ? getOldestPurchaseDate(decorated) : null);
  const xirr = calculateXirr(
    decorated.flatMap((investment) =>
      investment.purchase_date
        ? [
            { date: new Date(investment.purchase_date), amount: -Number(investment.cost_basis ?? 0) },
            { date: new Date(), amount: investment.current_value },
          ]
        : [{ date: new Date(), amount: investment.current_value }],
    ),
  );

  return {
    totalInvestmentValue,
    todaysGainLoss,
    overallGain,
    xirr,
    cagr,
    costBasis,
    assetAllocation: groupAllocation(decorated, (investment) => investment.category, (investment) => investment.current_value),
    sectorAllocation: groupAllocation(decorated, (investment) => investment.sector ?? "Unspecified", (investment) => investment.current_value),
    amcAllocation: groupAllocation(decorated, (investment) => investment.amc ?? "Self-managed", (investment) => investment.current_value),
    equityDebtAllocation: groupAllocation(decorated, (investment) => (investment.exposure === "debt" ? "Debt" : "Equity"), (investment) => investment.current_value),
    regionAllocation: groupAllocation(decorated, (investment) => investment.region, (investment) => investment.current_value),
    largestHolding: decorated.reduce<Investment | null>((current, investment) => {
      if (!current || investment.current_value > current.current_value) {
        return investment;
      }

      return current;
    }, null),
  };
}

export function getTopInvestments(investments: Investment[], limit = 10) {
  return [...investments]
    .map((investment) => formatInvestmentRow(investment))
    .sort((left, right) => right.current_value - left.current_value)
    .slice(0, limit);
}

export function getRecentInvestments(investments: Investment[], limit = 3) {
  return [...investments]
    .map((investment) => formatInvestmentRow(investment))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, limit);
}

export interface InvestmentInsight {
  title: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}

export function buildInvestmentInsights(summary: InvestmentSummarySnapshot): InvestmentInsight[] {
  const insights: InvestmentInsight[] = [];
  const equityShare = shareFor(summary.equityDebtAllocation, "Equity");
  const domesticShare = shareFor(summary.regionAllocation, "Domestic");
  const cashShare = shareFor(summary.assetAllocation, "Cash Equivalents");
  const largestCategory = summary.assetAllocation[0];
  const largestSector = summary.sectorAllocation[0];
  const largestAmc = summary.amcAllocation[0];

  if (summary.totalInvestmentValue <= 0) {
    insights.push({ title: "Build your core portfolio", detail: "Add your first investment to unlock allocation, performance, and return insights.", tone: "neutral" });
    return insights;
  }

  if ((summary.xirr ?? 0) > 0.12) {
    insights.push({ title: "Returns are strong", detail: `Portfolio XIRR is ${((summary.xirr ?? 0) * 100).toFixed(1)}%, indicating healthy compounding.`, tone: "positive" });
  } else {
    insights.push({ title: "Returns deserve attention", detail: `Portfolio XIRR is ${(summary.xirr ? summary.xirr * 100 : 0).toFixed(1)}%. Review allocation and costs for improvement.`, tone: "warning" });
  }

  if (equityShare > 0.7) {
    insights.push({ title: "Equity bias is elevated", detail: `${(equityShare * 100).toFixed(0)}% of capital sits in equity-style investments.`, tone: "warning" });
  } else {
    insights.push({ title: "Balance is intact", detail: `Equity exposure is ${(equityShare * 100).toFixed(0)}%, leaving room for diversification.`, tone: "positive" });
  }

  if (domesticShare > 0.8) {
    insights.push({ title: "Domestic concentration is high", detail: `${(domesticShare * 100).toFixed(0)}% of the portfolio is domestic.`, tone: "warning" });
  }

  if (cashShare < 0.1) {
    insights.push({ title: "Cash equivalents are below target", detail: `Cash equivalents represent only ${(cashShare * 100).toFixed(0)}% of the portfolio.`, tone: "warning" });
  }

  if (largestCategory) {
    insights.push({ title: "Largest sleeve identified", detail: `${largestCategory.name} leads the allocation with $${largestCategory.value.toLocaleString()}.`, tone: "neutral" });
  }

  if (largestSector) {
    insights.push({ title: "Sector concentration to watch", detail: `${largestSector.name} is your largest sector exposure.`, tone: "neutral" });
  }

  if (largestAmc) {
    insights.push({ title: "AMC concentration to review", detail: `${largestAmc.name} manages the largest share of capital.`, tone: "neutral" });
  }

  return insights.slice(0, 4);
}

function shareFor(allocation: AllocationItem[], name: string) {
  const total = allocation.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return 0;
  }

  const item = allocation.find((entry) => entry.name === name);
  return item ? item.value / total : 0;
}

function getOldestPurchaseDate(investments: Investment[]) {
  const purchases = investments.map((investment) => investment.purchase_date).filter(Boolean) as string[];
  if (purchases.length === 0) {
    return null;
  }

  return purchases.reduce((earliest, current) => (new Date(current) < new Date(earliest) ? current : earliest), purchases[0]);
}