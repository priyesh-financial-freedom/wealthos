import { supabase } from "@/lib/supabase/client";
import type {
  BankAccount,
  BankAccountInsert,
  BankAccountMonthlySnapshot,
  BankAccountMonthlySnapshotInsert,
  BankAccountMonthlySnapshotUpdate,
  BankAccountsDashboardModel,
  BankAccountUpdate,
} from "@/types/bankAccount";

export interface BankAccountsSummary {
  totalActiveBalance: number;
  activeAccountsCount: number;
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

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function buildSyntheticAccountNumber(input: { bank: string; accountName: string; owner?: string | null }) {
  const normalizedBank = input.bank.trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6) || "bank";
  const normalizedAccount = input.accountName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6) || "acct";
  const normalizedOwner = (input.owner ?? "owner").trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 4) || "ownr";

  return `${normalizedBank}-${normalizedAccount}-${normalizedOwner}`;
}

async function syncBankAccountCurrentBalance(client: ReturnType<typeof assertSupabaseClient>, userId: string, bankAccountId: string) {
  const { data: latestSnapshot, error: snapshotError } = await client
    .from("bank_account_monthly_snapshots")
    .select("closing_balance")
    .eq("user_id", userId)
    .eq("bank_account_id", bankAccountId)
    .order("snapshot_year", { ascending: false })
    .order("snapshot_month", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }

  if (latestSnapshot) {
    const { error: updateError } = await client
      .from("bank_accounts")
      .update({ current_balance: Number(latestSnapshot.closing_balance ?? 0) })
      .eq("id", bankAccountId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(updateError.message);
    }
    return;
  }

  const { data: account, error: accountError } = await client
    .from("bank_accounts")
    .select("opening_balance")
    .eq("id", bankAccountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (accountError) {
    throw new Error(accountError.message);
  }

  if (!account) {
    return;
  }

  const { error: resetError } = await client
    .from("bank_accounts")
    .update({ current_balance: Number(account.opening_balance ?? 0) })
    .eq("id", bankAccountId)
    .eq("user_id", userId);

  if (resetError) {
    throw new Error(resetError.message);
  }
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
  const accountName = input.account_name.trim();
  const nickname = input.nickname?.trim() || accountName;
  const accountNumber = input.account_number?.trim() || buildSyntheticAccountNumber({ bank: input.bank, accountName, owner: input.owner });

  const { data, error } = await client
    .from("bank_accounts")
    .insert({
      ...input,
      account_name: accountName,
      nickname,
      account_number: accountNumber,
      user_id: user.id,
      currency: input.currency ?? "INR",
      status: input.status ?? "active",
      interest_rate: input.interest_rate ?? 0,
      include_in_net_worth: input.include_in_net_worth ?? true,
      include_in_cash_position: input.include_in_cash_position ?? true,
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
  const normalizedUpdates = {
    ...updates,
    ...(updates.account_name !== undefined ? { account_name: updates.account_name.trim() } : {}),
    ...(updates.nickname !== undefined ? { nickname: updates.nickname?.trim() || updates.account_name?.trim() || null } : {}),
    ...(updates.account_number !== undefined && updates.account_number ? { account_number: updates.account_number.trim() } : {}),
  };
  const { data, error } = await client
    .from("bank_accounts")
    .update(normalizedUpdates)
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

  await syncBankAccountCurrentBalance(client, user.id, input.bank_account_id);

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

  await syncBankAccountCurrentBalance(client, user.id, data.bank_account_id as string);

  return data as BankAccountMonthlySnapshot;
}

export async function deleteBankAccountMonthlySnapshot(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { data: existingSnapshot, error: existingSnapshotError } = await client
    .from("bank_account_monthly_snapshots")
    .select("bank_account_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSnapshotError) {
    throw new Error(existingSnapshotError.message);
  }

  const { error } = await client.from("bank_account_monthly_snapshots").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  if (existingSnapshot?.bank_account_id) {
    await syncBankAccountCurrentBalance(client, user.id, existingSnapshot.bank_account_id as string);
  }
}

export function buildBankAccountsDashboardModel(
  accounts: BankAccount[],
  snapshots: BankAccountMonthlySnapshot[],
): BankAccountsDashboardModel {
  const totalCash = accounts
    .filter((account) => account.status === "active" && account.include_in_cash_position)
    .reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0);

  const latestSnapshot = [...snapshots].sort((left, right) => {
    if (left.snapshot_year !== right.snapshot_year) {
      return right.snapshot_year - left.snapshot_year;
    }
    if (left.snapshot_month !== right.snapshot_month) {
      return right.snapshot_month - left.snapshot_month;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  })[0];

  return {
    totalCash,
    activeAccountsCount: accounts.filter((account) => account.status === "active").length,
    lastUpdatedMonth: latestSnapshot ? monthLabel(latestSnapshot.snapshot_year, latestSnapshot.snapshot_month) : "No history yet",
  };
}

export function buildBankAccountsSummary(accounts: BankAccount[]): BankAccountsSummary {
  const activeAccounts = accounts.filter((account) => account.status === "active" && account.include_in_net_worth);

  return {
    totalActiveBalance: activeAccounts.reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0),
    activeAccountsCount: activeAccounts.length,
  };
}

export async function getBankAccountsSummary(): Promise<BankAccountsSummary> {
  const accounts = await getBankAccounts();
  return buildBankAccountsSummary(accounts);
}
