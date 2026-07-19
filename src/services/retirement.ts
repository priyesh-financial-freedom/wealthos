import { supabase } from "@/lib/supabase/client";
import type {
  BaseRetirementAccount,
  ContributionMonth,
  EpfAccount,
  EpfAccountInsert,
  NpsAccount,
  NpsAccountInsert,
  PpfAccount,
  PpfAccountInsert,
  RetirementAccount,
  RetirementAccountInsert,
  RetirementAccountType,
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

const monthNames: ContributionMonth[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function normalizeBaseAccount<T extends BaseRetirementAccount>(account: T): T {
  return {
    ...account,
    current_balance: toNumber(account.current_balance),
    contribution_amount: toNumber(account.contribution_amount),
    contribution_day: account.contribution_day === null ? null : toNumber(account.contribution_day),
    interest_rate: account.interest_rate === null ? null : toNumber(account.interest_rate),
  };
}

function normalizePpfAccount(account: PpfAccount): PpfAccount {
  return {
    ...normalizeBaseAccount(account),
    account_type: "PPF",
  };
}

function normalizeEpfAccount(account: EpfAccount): EpfAccount {
  return {
    ...normalizeBaseAccount(account),
    account_type: "EPF",
    employee_contribution: account.employee_contribution === null ? null : toNumber(account.employee_contribution),
    employer_contribution: account.employer_contribution === null ? null : toNumber(account.employer_contribution),
  };
}

function normalizeNpsAccount(account: NpsAccount): NpsAccount {
  return {
    ...normalizeBaseAccount(account),
    account_type: "NPS",
    equity_percent: account.equity_percent === null ? null : toNumber(account.equity_percent),
    corporate_debt_percent: account.corporate_debt_percent === null ? null : toNumber(account.corporate_debt_percent),
    government_securities_percent: account.government_securities_percent === null ? null : toNumber(account.government_securities_percent),
    alternative_assets_percent: account.alternative_assets_percent === null ? null : toNumber(account.alternative_assets_percent),
  };
}

function normalizeContributionMonth(value: string | null | undefined): ContributionMonth | null {
  if (!value) {
    return null;
  }

  const match = monthNames.find((month) => month.toLowerCase() === String(value).toLowerCase());
  return match ?? null;
}

function sanitizeBasePayload(input: {
  owner: string;
  institution: string;
  current_balance: number;
  account_number?: string | null;
  opening_date?: string | null;
  interest_rate?: number | null;
  nominee?: string | null;
  notes?: string | null;
  contribution_frequency: "Monthly" | "Quarterly" | "Annual" | "One-time";
  contribution_amount: number;
  contribution_day?: number | null;
  contribution_month?: ContributionMonth | null;
}) {
  return {
    owner: input.owner.trim(),
    institution: input.institution.trim(),
    current_balance: Number(input.current_balance ?? 0),
    account_number: input.account_number?.trim() || null,
    opening_date: input.opening_date ?? null,
    interest_rate: input.interest_rate ?? null,
    nominee: input.nominee?.trim() || null,
    notes: input.notes?.trim() || null,
    contribution_frequency: input.contribution_frequency,
    contribution_amount: Number(input.contribution_amount ?? 0),
    contribution_day: input.contribution_day ?? null,
    contribution_month: input.contribution_month ?? null,
  };
}

function getTableForType(accountType: RetirementAccountType) {
  switch (accountType) {
    case "PPF":
      return "ppf_accounts";
    case "EPF":
      return "epf_accounts";
    case "NPS":
    default:
      return "nps_accounts";
  }
}

async function fetchPpfAccounts(userId: string): Promise<PpfAccount[]> {
  const client = assertSupabaseClient();
  const { data, error } = await client
    .from("ppf_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as PpfAccount[]).map((row) => normalizePpfAccount({ ...row, account_type: "PPF", contribution_month: normalizeContributionMonth(row.contribution_month) }));
}

async function fetchEpfAccounts(userId: string): Promise<EpfAccount[]> {
  const client = assertSupabaseClient();
  const { data, error } = await client
    .from("epf_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as EpfAccount[]).map((row) => normalizeEpfAccount({ ...row, account_type: "EPF", contribution_month: normalizeContributionMonth(row.contribution_month) }));
}

async function fetchNpsAccounts(userId: string): Promise<NpsAccount[]> {
  const client = assertSupabaseClient();
  const { data, error } = await client
    .from("nps_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as NpsAccount[]).map((row) => normalizeNpsAccount({ ...row, account_type: "NPS", contribution_month: normalizeContributionMonth(row.contribution_month) }));
}

export async function getRetirementAccounts(): Promise<RetirementAccount[]> {
  const { client, user } = await requireAuthenticatedUser();
  void client;

  const [ppfAccounts, epfAccounts, npsAccounts] = await Promise.all([
    fetchPpfAccounts(user.id),
    fetchEpfAccounts(user.id),
    fetchNpsAccounts(user.id),
  ]);

  return [...ppfAccounts, ...epfAccounts, ...npsAccounts].sort((left, right) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export async function createRetirementAccount(input: RetirementAccountInsert): Promise<RetirementAccount> {
  const { client, user } = await requireAuthenticatedUser();
  const basePayload = sanitizeBasePayload(input);

  if (input.account_type === "PPF") {
    const payload: Omit<PpfAccountInsert, "account_type"> = {
      ...basePayload,
      maturity_date: input.maturity_date ?? null,
    };

    const { data, error } = await client
      .from("ppf_accounts")
      .insert({ ...payload, user_id: user.id })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return normalizePpfAccount({ ...(data as PpfAccount), account_type: "PPF", contribution_month: normalizeContributionMonth((data as PpfAccount).contribution_month) });
  }

  if (input.account_type === "EPF") {
    const payload: Omit<EpfAccountInsert, "account_type"> = {
      ...basePayload,
      employer: input.employer?.trim() || null,
      uan: input.uan?.trim() || null,
      employee_contribution: input.employee_contribution ?? null,
      employer_contribution: input.employer_contribution ?? null,
    };

    const { data, error } = await client
      .from("epf_accounts")
      .insert({ ...payload, user_id: user.id })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return normalizeEpfAccount({ ...(data as EpfAccount), account_type: "EPF", contribution_month: normalizeContributionMonth((data as EpfAccount).contribution_month) });
  }

  const payload: Omit<NpsAccountInsert, "account_type"> = {
    ...basePayload,
    pran: input.pran?.trim() || null,
    pop: input.pop?.trim() || null,
    equity_percent: input.equity_percent ?? null,
    corporate_debt_percent: input.corporate_debt_percent ?? null,
    government_securities_percent: input.government_securities_percent ?? null,
    alternative_assets_percent: input.alternative_assets_percent ?? null,
  };

  const { data, error } = await client
    .from("nps_accounts")
    .insert({ ...payload, user_id: user.id })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeNpsAccount({ ...(data as NpsAccount), account_type: "NPS", contribution_month: normalizeContributionMonth((data as NpsAccount).contribution_month) });
}

export async function updateRetirementAccount(input: { id: string; account_type: RetirementAccountType } & Partial<RetirementAccountInsert>): Promise<RetirementAccount> {
  const { client, user } = await requireAuthenticatedUser();
  const { id, account_type, ...values } = input;

  const baseUpdate = {
    ...(values.owner !== undefined ? { owner: values.owner.trim() } : {}),
    ...(values.institution !== undefined ? { institution: values.institution.trim() } : {}),
    ...(values.current_balance !== undefined ? { current_balance: Number(values.current_balance) } : {}),
    ...(values.account_number !== undefined ? { account_number: values.account_number?.trim() || null } : {}),
    ...(values.opening_date !== undefined ? { opening_date: values.opening_date ?? null } : {}),
    ...(values.interest_rate !== undefined ? { interest_rate: values.interest_rate } : {}),
    ...(values.nominee !== undefined ? { nominee: values.nominee?.trim() || null } : {}),
    ...(values.notes !== undefined ? { notes: values.notes?.trim() || null } : {}),
    ...(values.contribution_frequency !== undefined ? { contribution_frequency: values.contribution_frequency } : {}),
    ...(values.contribution_amount !== undefined ? { contribution_amount: Number(values.contribution_amount) } : {}),
    ...(values.contribution_day !== undefined ? { contribution_day: values.contribution_day } : {}),
    ...(values.contribution_month !== undefined ? { contribution_month: values.contribution_month } : {}),
  };

  if (account_type === "PPF") {
    const ppfValues = values as Partial<PpfAccountInsert>;
    const { data, error } = await client
      .from("ppf_accounts")
      .update({ ...baseUpdate, ...(ppfValues.maturity_date !== undefined ? { maturity_date: ppfValues.maturity_date } : {}) })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return normalizePpfAccount({ ...(data as PpfAccount), account_type: "PPF", contribution_month: normalizeContributionMonth((data as PpfAccount).contribution_month) });
  }

  if (account_type === "EPF") {
    const epfValues = values as Partial<EpfAccountInsert>;
    const { data, error } = await client
      .from("epf_accounts")
      .update({
        ...baseUpdate,
        ...(epfValues.employer !== undefined ? { employer: epfValues.employer?.trim() || null } : {}),
        ...(epfValues.uan !== undefined ? { uan: epfValues.uan?.trim() || null } : {}),
        ...(epfValues.employee_contribution !== undefined ? { employee_contribution: epfValues.employee_contribution } : {}),
        ...(epfValues.employer_contribution !== undefined ? { employer_contribution: epfValues.employer_contribution } : {}),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return normalizeEpfAccount({ ...(data as EpfAccount), account_type: "EPF", contribution_month: normalizeContributionMonth((data as EpfAccount).contribution_month) });
  }

  const npsValues = values as Partial<NpsAccountInsert>;
  const { data, error } = await client
    .from("nps_accounts")
    .update({
      ...baseUpdate,
      ...(npsValues.pran !== undefined ? { pran: npsValues.pran?.trim() || null } : {}),
      ...(npsValues.pop !== undefined ? { pop: npsValues.pop?.trim() || null } : {}),
      ...(npsValues.equity_percent !== undefined ? { equity_percent: npsValues.equity_percent } : {}),
      ...(npsValues.corporate_debt_percent !== undefined ? { corporate_debt_percent: npsValues.corporate_debt_percent } : {}),
      ...(npsValues.government_securities_percent !== undefined ? { government_securities_percent: npsValues.government_securities_percent } : {}),
      ...(npsValues.alternative_assets_percent !== undefined ? { alternative_assets_percent: npsValues.alternative_assets_percent } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeNpsAccount({ ...(data as NpsAccount), account_type: "NPS", contribution_month: normalizeContributionMonth((data as NpsAccount).contribution_month) });
}

export async function deleteRetirementAccount(id: string, accountType: RetirementAccountType): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();
  const tableName = getTableForType(accountType);
  const { error } = await client.from(tableName).delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function buildRetirementDashboardModel(accounts: RetirementAccount[]): RetirementDashboardModel {
  const totalRetirementAssets = accounts.reduce((sum, account) => sum + account.current_balance, 0);
  const balancesByType: Record<RetirementAccountType, number> = {
    EPF: 0,
    PPF: 0,
    NPS: 0,
  };

  const ownerMap = new Map<string, number>();

  for (const account of accounts) {
    balancesByType[account.account_type] += account.current_balance;
    ownerMap.set(account.owner, (ownerMap.get(account.owner) ?? 0) + account.current_balance);
  }

  const ownerAllocation = Array.from(ownerMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);

  return {
    totalRetirementAssets,
    balancesByType,
    ownerAllocation,
    accountTypeAllocation: (Object.entries(balancesByType) as Array<[RetirementAccountType, number]>)
      .map(([name, value]) => ({ name, value }))
      .filter((entry) => entry.value > 0)
      .sort((left, right) => right.value - left.value),
  };
}

export function buildRetirementExecutiveSummary(model: RetirementDashboardModel): RetirementExecutiveSummary {
  return {
    totalRetirementAssets: model.totalRetirementAssets,
  };
}