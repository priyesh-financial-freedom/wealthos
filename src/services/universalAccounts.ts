import { supabase } from "@/lib/supabase/client";
import { UNIVERSAL_ACCOUNT_TYPE_MAP } from "@/features/accountEngine/config";
import type {
  UniversalAccount,
  UniversalAccountInsert,
  UniversalAccountMetrics,
  UniversalAccountMonthlySnapshot,
  UniversalAccountMonthlySnapshotInsert,
  UniversalAccountMonthlySnapshotUpdate,
  UniversalAccountUpdate,
  UniversalDashboardSummary,
} from "@/types/universalAccount";

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

function monthKey(snapshotYear: number, snapshotMonth: number) {
  return `${snapshotYear}-${String(snapshotMonth).padStart(2, "0")}`;
}

function monthLabel(snapshotYear: number, snapshotMonth: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(snapshotYear, snapshotMonth - 1, 1));
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

interface Cashflow {
  date: Date;
  amount: number;
}

function calculateCagr(startValue: number, endValue: number, startDate: string | null) {
  if (!startDate || startValue <= 0 || endValue <= 0) {
    return null;
  }

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const days = Math.max(1, (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  const years = days / 365.25;

  if (years <= 0) {
    return null;
  }

  return Math.pow(endValue / startValue, 1 / years) - 1;
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
      derivative -= (years * cashflow.amount) / Math.pow(1 + rate, years + 1);
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

export async function getUniversalAccounts(): Promise<UniversalAccount[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("universal_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as UniversalAccount[]).map((item) => ({
    ...item,
    opening_value: toNumber(item.opening_value),
    current_value: toNumber(item.current_value),
    interest_rate: item.interest_rate === null ? null : toNumber(item.interest_rate),
  }));
}

export async function createUniversalAccount(input: UniversalAccountInsert): Promise<UniversalAccount> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("universal_accounts")
    .insert({
      ...input,
      user_id: user.id,
      currency: input.currency ?? "USD",
      status: input.status ?? "active",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as UniversalAccount;
}

export async function updateUniversalAccount(input: UniversalAccountUpdate): Promise<UniversalAccount> {
  const { client, user } = await requireAuthenticatedUser();

  const { id, ...updates } = input;
  const { data, error } = await client
    .from("universal_accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as UniversalAccount;
}

export async function deleteUniversalAccount(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client
    .from("universal_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getUniversalAccountMonthlySnapshots(): Promise<UniversalAccountMonthlySnapshot[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("universal_account_monthly_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("snapshot_year", { ascending: false })
    .order("snapshot_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as UniversalAccountMonthlySnapshot[]).map((item) => ({
    ...item,
    opening_value: toNumber(item.opening_value),
    contribution: toNumber(item.contribution),
    withdrawal: toNumber(item.withdrawal),
    closing_value: toNumber(item.closing_value),
    interest: toNumber(item.interest),
    dividend: toNumber(item.dividend),
    gain_loss: toNumber(item.gain_loss),
    monthly_growth: toNumber(item.monthly_growth),
    cash_flow: toNumber(item.cash_flow),
  }));
}

export async function createUniversalAccountMonthlySnapshot(input: UniversalAccountMonthlySnapshotInsert): Promise<UniversalAccountMonthlySnapshot> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("universal_account_monthly_snapshots")
    .insert({
      ...input,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as UniversalAccountMonthlySnapshot;
}

export async function updateUniversalAccountMonthlySnapshot(input: UniversalAccountMonthlySnapshotUpdate): Promise<UniversalAccountMonthlySnapshot> {
  const { client, user } = await requireAuthenticatedUser();

  const { id, ...updates } = input;
  const { data, error } = await client
    .from("universal_account_monthly_snapshots")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as UniversalAccountMonthlySnapshot;
}

export async function deleteUniversalAccountMonthlySnapshot(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client
    .from("universal_account_monthly_snapshots")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function buildUniversalAccountMetrics(
  account: UniversalAccount,
  snapshots: UniversalAccountMonthlySnapshot[],
  totalPortfolioValue: number,
): UniversalAccountMetrics {
  const accountSnapshots = snapshots
    .filter((snapshot) => snapshot.universal_account_id === account.id)
    .sort((left, right) => {
      if (left.snapshot_year !== right.snapshot_year) {
        return left.snapshot_year - right.snapshot_year;
      }
      return left.snapshot_month - right.snapshot_month;
    });

  const totalContributions = accountSnapshots.reduce((sum, snapshot) => sum + snapshot.contribution, 0);
  const totalWithdrawals = accountSnapshots.reduce((sum, snapshot) => sum + snapshot.withdrawal, 0);
  const monthlyGrowth = accountSnapshots.length > 0 ? accountSnapshots[accountSnapshots.length - 1].monthly_growth : account.current_value - account.opening_value;
  const lifetimeReturn = account.current_value - account.opening_value - totalContributions + totalWithdrawals;

  const cagr = calculateCagr(account.opening_value, account.current_value, account.purchase_date);

  const xirrCashflows: Cashflow[] = [
    {
      date: account.purchase_date ? new Date(account.purchase_date) : new Date(account.created_at),
      amount: -Math.abs(account.opening_value),
    },
    ...accountSnapshots.flatMap((snapshot) => {
      const date = new Date(snapshot.snapshot_year, snapshot.snapshot_month - 1, 28);
      return [
        ...(snapshot.contribution > 0 ? [{ date, amount: -Math.abs(snapshot.contribution) }] : []),
        ...(snapshot.withdrawal > 0 ? [{ date, amount: Math.abs(snapshot.withdrawal) }] : []),
      ];
    }),
    { date: new Date(), amount: Math.abs(account.current_value) },
  ];

  const xirr = calculateXirr(xirrCashflows);
  const currentAllocation = totalPortfolioValue > 0 ? account.current_value / totalPortfolioValue : 0;
  const typeConfig = UNIVERSAL_ACCOUNT_TYPE_MAP.get(account.account_type);
  const signedValue = (typeConfig?.weightSign ?? 1) * account.current_value;
  const portfolioWeight = totalPortfolioValue > 0 ? signedValue / totalPortfolioValue : 0;

  return {
    monthlyGrowth,
    cagr,
    xirr,
    totalContributions,
    totalWithdrawals,
    lifetimeReturn,
    currentAllocation,
    portfolioWeight,
  };
}

export function buildUniversalDashboardSummary(
  accounts: UniversalAccount[],
  snapshots: UniversalAccountMonthlySnapshot[],
): UniversalDashboardSummary {
  const totalCurrentValue = accounts.reduce((sum, account) => sum + account.current_value, 0);

  const totalCash = accounts.reduce((sum, account) => {
    const accountConfig = UNIVERSAL_ACCOUNT_TYPE_MAP.get(account.account_type);
    return accountConfig?.class === "cash" ? sum + account.current_value : sum;
  }, 0);

  const totalLiabilities = accounts.reduce((sum, account) => {
    const accountConfig = UNIVERSAL_ACCOUNT_TYPE_MAP.get(account.account_type);
    return accountConfig?.weightSign === -1 ? sum + account.current_value : sum;
  }, 0);

  const sortedSnapshots = [...snapshots].sort((left, right) => {
    if (left.snapshot_year !== right.snapshot_year) {
      return right.snapshot_year - left.snapshot_year;
    }
    return right.snapshot_month - left.snapshot_month;
  });

  const latestKey = sortedSnapshots.length > 0 ? monthKey(sortedSnapshots[0].snapshot_year, sortedSnapshots[0].snapshot_month) : null;
  const latestSnapshots = latestKey
    ? sortedSnapshots.filter((snapshot) => monthKey(snapshot.snapshot_year, snapshot.snapshot_month) === latestKey)
    : [];

  const monthlyInflow = latestSnapshots.reduce((sum, snapshot) => sum + snapshot.contribution, 0);
  const monthlyOutflow = latestSnapshots.reduce((sum, snapshot) => sum + snapshot.withdrawal, 0);

  const groupedTrend = snapshots.reduce<Record<string, { month: string; total: number; inflow: number; outflow: number }>>((acc, snapshot) => {
    const key = monthKey(snapshot.snapshot_year, snapshot.snapshot_month);
    if (!acc[key]) {
      acc[key] = {
        month: monthLabel(snapshot.snapshot_year, snapshot.snapshot_month),
        total: 0,
        inflow: 0,
        outflow: 0,
      };
    }

    acc[key].total += snapshot.closing_value;
    acc[key].inflow += snapshot.contribution;
    acc[key].outflow += snapshot.withdrawal;

    return acc;
  }, {});

  const trend = Object.entries(groupedTrend)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([, value]) => value);

  const allocation = Object.entries(
    accounts.reduce<Record<string, number>>((acc, account) => {
      acc[account.account_type] = (acc[account.account_type] ?? 0) + account.current_value;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);

  const liquidityRatio = totalLiabilities > 0 ? totalCash / totalLiabilities : null;

  return {
    totalCurrentValue,
    totalCash,
    totalLiabilities,
    monthlyInflow,
    monthlyOutflow,
    liquidityRatio,
    trend,
    allocation,
  };
}

export async function getUniversalDashboardSummary(): Promise<UniversalDashboardSummary> {
  const [accounts, snapshots] = await Promise.all([getUniversalAccounts(), getUniversalAccountMonthlySnapshots()]);
  return buildUniversalDashboardSummary(accounts, snapshots);
}
