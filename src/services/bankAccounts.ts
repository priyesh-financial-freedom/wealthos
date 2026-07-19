import { supabase } from "@/lib/supabase/client";
import type {
  BankAccount,
  BankAccountInsert,
  BankAccountMonthlySnapshot,
  BankAccountMonthlySnapshotInsert,
  BankAccountMonthlySnapshotUpdate,
  BankAccountsDashboardModel,
  BankAccountUpdate,
  CashTrendPoint,
} from "@/types/bankAccount";

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

function maskAccountNumber(value: string) {
  const normalized = (value ?? "").replace(/\s+/g, "");
  if (normalized.length <= 4) {
    return normalized;
  }

  const suffix = normalized.slice(-4);
  return `${"*".repeat(Math.max(4, normalized.length - 4))}${suffix}`;
}

function withMaskedAccountNumber(account: BankAccount): BankAccount {
  return {
    ...account,
    masked_account_number: maskAccountNumber(account.account_number),
  };
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client.from("bank_accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as BankAccount[]).map((account) => withMaskedAccountNumber(account));
}

export async function createBankAccount(input: BankAccountInsert): Promise<BankAccount> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("bank_accounts")
    .insert({
      ...input,
      user_id: user.id,
      currency: input.currency ?? "INR",
      status: input.status ?? "active",
      interest_rate: input.interest_rate ?? 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return withMaskedAccountNumber(data as BankAccount);
}

export async function updateBankAccount(input: BankAccountUpdate): Promise<BankAccount> {
  const { client, user } = await requireAuthenticatedUser();

  const { id, ...updates } = input;
  const { data, error } = await client
    .from("bank_accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return withMaskedAccountNumber(data as BankAccount);
}

export async function deleteBankAccount(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("bank_accounts").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getBankAccountMonthlySnapshots(): Promise<BankAccountMonthlySnapshot[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("bank_account_monthly_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("snapshot_year", { ascending: false })
    .order("snapshot_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as BankAccountMonthlySnapshot[]).map((snapshot) => ({
    ...snapshot,
    opening_balance: toNumber(snapshot.opening_balance),
    deposits: toNumber(snapshot.deposits),
    withdrawals: toNumber(snapshot.withdrawals),
    closing_balance: toNumber(snapshot.closing_balance),
    interest_rate: toNumber(snapshot.interest_rate),
    monthly_change: toNumber(snapshot.monthly_change),
    cash_flow: toNumber(snapshot.cash_flow),
    average_balance: toNumber(snapshot.average_balance),
    interest_earned: toNumber(snapshot.interest_earned),
  }));
}

export async function createBankAccountMonthlySnapshot(input: BankAccountMonthlySnapshotInsert): Promise<BankAccountMonthlySnapshot> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("bank_account_monthly_snapshots")
    .insert({
      ...input,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as BankAccountMonthlySnapshot;
}

export async function updateBankAccountMonthlySnapshot(input: BankAccountMonthlySnapshotUpdate): Promise<BankAccountMonthlySnapshot> {
  const { client, user } = await requireAuthenticatedUser();

  const { id, ...updates } = input;
  const { data, error } = await client
    .from("bank_account_monthly_snapshots")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as BankAccountMonthlySnapshot;
}

export async function deleteBankAccountMonthlySnapshot(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("bank_account_monthly_snapshots").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function buildBankAccountsDashboardModel(
  accounts: BankAccount[],
  snapshots: BankAccountMonthlySnapshot[],
  totalLiabilities = 0,
): BankAccountsDashboardModel {
  const totalCash = accounts
    .filter((account) => account.status !== "closed")
    .reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0);

  const sortedSnapshots = [...snapshots].sort((left, right) => {
    if (left.snapshot_year !== right.snapshot_year) {
      return right.snapshot_year - left.snapshot_year;
    }
    if (left.snapshot_month !== right.snapshot_month) {
      return right.snapshot_month - left.snapshot_month;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });

  const latestKey = sortedSnapshots.length > 0 ? monthKey(sortedSnapshots[0].snapshot_year, sortedSnapshots[0].snapshot_month) : null;
  const latestSnapshots = latestKey
    ? sortedSnapshots.filter((snapshot) => monthKey(snapshot.snapshot_year, snapshot.snapshot_month) === latestKey)
    : [];

  const monthlyInflow = latestSnapshots.reduce((sum, snapshot) => sum + Number(snapshot.deposits ?? 0), 0);
  const monthlyOutflow = latestSnapshots.reduce((sum, snapshot) => sum + Number(snapshot.withdrawals ?? 0), 0);
  const latestAverageBalance = latestSnapshots.reduce((sum, snapshot) => sum + Number(snapshot.average_balance ?? 0), 0);
  const latestInterestEarned = latestSnapshots.reduce((sum, snapshot) => sum + Number(snapshot.interest_earned ?? 0), 0);

  const groupedTrend = snapshots.reduce<Record<string, CashTrendPoint>>((acc, snapshot) => {
    const key = monthKey(snapshot.snapshot_year, snapshot.snapshot_month);
    if (!acc[key]) {
      acc[key] = {
        month: monthLabel(snapshot.snapshot_year, snapshot.snapshot_month),
        totalCash: 0,
        inflow: 0,
        outflow: 0,
      };
    }

    acc[key].totalCash += Number(snapshot.closing_balance ?? 0);
    acc[key].inflow += Number(snapshot.deposits ?? 0);
    acc[key].outflow += Number(snapshot.withdrawals ?? 0);

    return acc;
  }, {});

  const cashTrend = Object.entries(groupedTrend)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([, point]) => point);

  const accountTypeAllocation = Object.entries(
    accounts.reduce<Record<string, number>>((acc, account) => {
      acc[account.account_type] = (acc[account.account_type] ?? 0) + Number(account.current_balance ?? 0);
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);

  const liquidityRatio = totalLiabilities > 0 ? totalCash / totalLiabilities : null;

  return {
    totalCash,
    monthlyInflow,
    monthlyOutflow,
    liquidityRatio,
    latestAverageBalance,
    latestInterestEarned,
    cashTrend,
    accountTypeAllocation,
  };
}
