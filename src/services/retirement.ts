import { supabase } from "@/lib/supabase/client";
import type {
  MonthlyRetirementSnapshot,
  MonthlyRetirementSnapshotInsert,
  MonthlyRetirementSnapshotUpdate,
  RetirementAccount,
  RetirementAccountInsert,
  RetirementAccountType,
  RetirementAccountUpdate,
  RetirementDashboardModel,
  RetirementExecutiveSummary,
} from "@/types/retirementAccount";

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

function monthKey(snapshotYear: number, snapshotMonth: number) {
  return `${snapshotYear}-${String(snapshotMonth).padStart(2, "0")}`;
}

function monthLabel(snapshotYear: number, snapshotMonth: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(snapshotYear, snapshotMonth - 1, 1));
}

function normalizeRetirementAccount(account: RetirementAccount): RetirementAccount {
  return {
    ...account,
    current_value: toNumber(account.current_value),
    monthly_contribution: toNumber(account.monthly_contribution),
    annual_contribution: toNumber(account.annual_contribution),
    interest_rate: toNumber(account.interest_rate),
  };
}

function normalizeRetirementSnapshot(snapshot: MonthlyRetirementSnapshot): MonthlyRetirementSnapshot {
  return {
    ...snapshot,
    opening_balance: toNumber(snapshot.opening_balance),
    contribution: toNumber(snapshot.contribution),
    interest: toNumber(snapshot.interest),
    closing_balance: toNumber(snapshot.closing_balance),
  };
}

export async function getRetirementAccounts(): Promise<RetirementAccount[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("retirement_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as RetirementAccount[]).map(normalizeRetirementAccount);
}

export async function createRetirementAccount(input: RetirementAccountInsert): Promise<RetirementAccount> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("retirement_accounts")
    .insert({
      ...input,
      user_id: user.id,
      monthly_contribution: input.monthly_contribution ?? 0,
      annual_contribution: input.annual_contribution ?? (input.monthly_contribution ?? 0) * 12,
      interest_rate: input.interest_rate ?? 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeRetirementAccount(data as RetirementAccount);
}

export async function updateRetirementAccount(input: RetirementAccountUpdate): Promise<RetirementAccount> {
  const { client, user } = await requireAuthenticatedUser();
  const { id, ...updates } = input;

  const { data, error } = await client
    .from("retirement_accounts")
    .update({
      ...updates,
      annual_contribution:
        updates.annual_contribution ??
        (typeof updates.monthly_contribution === "number" ? updates.monthly_contribution * 12 : undefined),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeRetirementAccount(data as RetirementAccount);
}

export async function deleteRetirementAccount(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();
  const { error } = await client.from("retirement_accounts").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getMonthlyRetirementSnapshots(): Promise<MonthlyRetirementSnapshot[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("monthly_retirement_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("snapshot_year", { ascending: false })
    .order("snapshot_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as MonthlyRetirementSnapshot[]).map(normalizeRetirementSnapshot);
}

export async function createMonthlyRetirementSnapshot(input: MonthlyRetirementSnapshotInsert): Promise<MonthlyRetirementSnapshot> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("monthly_retirement_snapshots")
    .insert({
      ...input,
      user_id: user.id,
      contribution: input.contribution ?? 0,
      interest: input.interest ?? 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeRetirementSnapshot(data as MonthlyRetirementSnapshot);
}

export async function updateMonthlyRetirementSnapshot(input: MonthlyRetirementSnapshotUpdate): Promise<MonthlyRetirementSnapshot> {
  const { client, user } = await requireAuthenticatedUser();
  const { id, ...updates } = input;

  const { data, error } = await client
    .from("monthly_retirement_snapshots")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeRetirementSnapshot(data as MonthlyRetirementSnapshot);
}

export async function deleteMonthlyRetirementSnapshot(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();
  const { error } = await client.from("monthly_retirement_snapshots").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function buildRetirementDashboardModel(
  accounts: RetirementAccount[],
  snapshots: MonthlyRetirementSnapshot[],
  baseNetWorthExcludingRetirement = 0,
): RetirementDashboardModel {
  const normalizedAccounts = accounts.map(normalizeRetirementAccount);
  const normalizedSnapshots = snapshots.map(normalizeRetirementSnapshot);
  const totalCorpus = normalizedAccounts.reduce((sum, account) => sum + account.current_value, 0);
  const balancesByType: Record<RetirementAccountType, number> = {
    EPF: 0,
    PPF: 0,
    NPS: 0,
  };

  for (const account of normalizedAccounts) {
    balancesByType[account.account_type] += account.current_value;
  }

  const sortedSnapshots = [...normalizedSnapshots].sort((left, right) => {
    if (left.snapshot_year !== right.snapshot_year) {
      return left.snapshot_year - right.snapshot_year;
    }
    if (left.snapshot_month !== right.snapshot_month) {
      return left.snapshot_month - right.snapshot_month;
    }
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });

  const latestSnapshot = sortedSnapshots.at(-1) ?? null;
  const latestKey = latestSnapshot ? monthKey(latestSnapshot.snapshot_year, latestSnapshot.snapshot_month) : null;
  const latestSnapshots = latestKey
    ? normalizedSnapshots.filter((snapshot) => monthKey(snapshot.snapshot_year, snapshot.snapshot_month) === latestKey)
    : [];

  const monthlyContribution = latestSnapshots.length > 0
    ? latestSnapshots.reduce((sum, snapshot) => sum + snapshot.contribution, 0)
    : normalizedAccounts.reduce((sum, account) => sum + account.monthly_contribution, 0);

  const groupedTrend = normalizedSnapshots.reduce<Record<string, { month: string; total: number; contribution: number; interest: number }>>((acc, snapshot) => {
    const key = monthKey(snapshot.snapshot_year, snapshot.snapshot_month);
    if (!acc[key]) {
      acc[key] = {
        month: monthLabel(snapshot.snapshot_year, snapshot.snapshot_month),
        total: 0,
        contribution: 0,
        interest: 0,
      };
    }

    acc[key].total += snapshot.closing_balance;
    acc[key].contribution += snapshot.contribution;
    acc[key].interest += snapshot.interest;

    return acc;
  }, {});

  const trend = Object.entries(groupedTrend)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([, value]) => value);

  const contributionHistory = trend.map((item) => ({ month: item.month, contribution: item.contribution }));

  const yearlyGrowthMap = normalizedSnapshots.reduce<Record<string, { opening: number; closing: number }>>((acc, snapshot) => {
    const key = String(snapshot.snapshot_year);
    if (!acc[key]) {
      acc[key] = { opening: snapshot.opening_balance, closing: snapshot.closing_balance };
    } else {
      acc[key].opening = Math.min(acc[key].opening, snapshot.opening_balance);
      acc[key].closing = Math.max(acc[key].closing, snapshot.closing_balance);
    }
    return acc;
  }, {});

  const yearlyGrowth = Object.entries(yearlyGrowthMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([year, value]) => ({ year, growth: value.closing - value.opening }));

  const baselinePoint = trend.length > 1 ? trend[Math.max(0, trend.length - 12)] : null;
  const latestTrendPoint = trend.at(-1) ?? null;
  const annualGrowthAmount = baselinePoint && latestTrendPoint ? latestTrendPoint.total - baselinePoint.total : 0;
  const annualGrowthPercent = baselinePoint && baselinePoint.total > 0 ? annualGrowthAmount / baselinePoint.total : null;

  const allocationDenominator = Math.max(totalCorpus, totalCorpus + Math.max(baseNetWorthExcludingRetirement, 0), 1);
  const retirementAllocationPercent = totalCorpus > 0 ? totalCorpus / allocationDenominator : 0;

  return {
    totalCorpus,
    balancesByType,
    monthlyContribution,
    annualGrowthAmount,
    annualGrowthPercent,
    retirementAllocationPercent,
    trend,
    allocation: (Object.entries(balancesByType) as Array<[RetirementAccountType, number]>)
      .map(([name, value]) => ({ name, value }))
      .filter((entry) => entry.value > 0)
      .sort((left, right) => right.value - left.value),
    contributionHistory,
    yearlyGrowth,
  };
}

export function buildRetirementExecutiveSummary(model: RetirementDashboardModel): RetirementExecutiveSummary {
  return {
    totalCorpus: model.totalCorpus,
    retirementAllocationPercent: model.retirementAllocationPercent,
    annualGrowthPercent: model.annualGrowthPercent,
  };
}