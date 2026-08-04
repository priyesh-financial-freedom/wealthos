import { supabase } from "@/lib/supabase/client";
import type {
  InsurancePolicy,
  InsurancePolicyInsert,
  InsurancePolicySummary,
  InsurancePolicyUpdate,
} from "@/types/insurancePolicy";

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

function normalize(item: InsurancePolicy): InsurancePolicy {
  return {
    ...item,
    cover_amount: Number(item.cover_amount ?? 0),
    premium_amount: Number(item.premium_amount ?? 0),
    include_in_cash_flow: Boolean(item.include_in_cash_flow),
  };
}

export function toMonthlyPremiumEquivalent(premiumAmount: number, frequency: InsurancePolicy["premium_frequency"]): number {
  const value = Number(premiumAmount ?? 0);
  switch (frequency) {
    case "Monthly":
      return value;
    case "Quarterly":
      return value / 3;
    case "Half-Yearly":
      return value / 6;
    case "Yearly":
      return value / 12;
    case "Single":
      return 0;
    default:
      return 0;
  }
}

export function toAnnualPremiumEquivalent(premiumAmount: number, frequency: InsurancePolicy["premium_frequency"]): number {
  const value = Number(premiumAmount ?? 0);
  switch (frequency) {
    case "Monthly":
      return value * 12;
    case "Quarterly":
      return value * 4;
    case "Half-Yearly":
      return value * 2;
    case "Yearly":
      return value;
    case "Single":
      return 0;
    default:
      return 0;
  }
}

export async function getInsurancePolicies(): Promise<InsurancePolicy[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("insurance_policies")
    .select("*")
    .eq("user_id", user.id)
    .order("renewal_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InsurancePolicy[]).map(normalize);
}

export async function createInsurancePolicy(input: InsurancePolicyInsert): Promise<InsurancePolicy> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("insurance_policies")
    .insert({
      ...input,
      user_id: user.id,
      nominee: input.nominee ?? null,
      cover_amount: input.cover_amount ?? 0,
      premium_amount: input.premium_amount ?? 0,
      premium_frequency: input.premium_frequency ?? "Monthly",
      status: input.status ?? "Active",
      include_in_cash_flow: input.include_in_cash_flow ?? true,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as InsurancePolicy);
}

export async function updateInsurancePolicy(input: InsurancePolicyUpdate): Promise<InsurancePolicy> {
  const { client, user } = await requireAuthenticatedUser();
  const { id, ...updates } = input;

  const { data, error } = await client
    .from("insurance_policies")
    .update({
      ...updates,
      nominee: updates.nominee ?? undefined,
      notes: updates.notes ?? undefined,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as InsurancePolicy);
}

export async function deleteInsurancePolicy(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("insurance_policies").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function buildInsuranceSummary(policies: InsurancePolicy[]): InsurancePolicySummary {
  const activePolicies = policies.filter((policy) => policy.status === "Active");
  const activeWithCashFlow = activePolicies.filter((policy) => policy.include_in_cash_flow);

  const totalAnnualPremium = activeWithCashFlow.reduce(
    (sum, policy) => sum + toAnnualPremiumEquivalent(policy.premium_amount, policy.premium_frequency),
    0,
  );
  const monthlyPremiumEquivalent = activeWithCashFlow.reduce(
    (sum, policy) => sum + toMonthlyPremiumEquivalent(policy.premium_amount, policy.premium_frequency),
    0,
  );

  const totalLifeCover = activePolicies
    .filter((policy) => ["Life", "Term", "ULIP"].includes(policy.policy_type))
    .reduce((sum, policy) => sum + Number(policy.cover_amount ?? 0), 0);

  const totalHealthCover = activePolicies
    .filter((policy) => ["Health", "Critical Illness", "Personal Accident"].includes(policy.policy_type))
    .reduce((sum, policy) => sum + Number(policy.cover_amount ?? 0), 0);

  const today = new Date();
  const upcomingRenewals = activePolicies
    .filter((policy) => policy.renewal_date)
    .map((policy) => policy.renewal_date as string)
    .filter((renewalDate) => {
      const date = new Date(`${renewalDate}T00:00:00`);
      return Number.isFinite(date.getTime()) && date >= today;
    })
    .sort((left, right) => left.localeCompare(right));

  return {
    totalAnnualPremium,
    monthlyPremiumEquivalent,
    totalLifeCover,
    totalHealthCover,
    activePolicies: activePolicies.length,
    nextRenewalDue: upcomingRenewals[0] ?? null,
  };
}
