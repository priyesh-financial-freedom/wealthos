import { supabase } from "@/lib/supabase/client";
import type { Liability, LiabilityInsert, LiabilityType, LiabilityUpdate } from "@/types/liability";

export interface LiabilityBucketsSummary {
  homeLoan: number;
  carLoan: number;
  creditCards: number;
  personalLoan: number;
  otherLiabilities: number;
}

export interface LiabilitiesSummary {
  totalLiabilities: number;
  totalMonthlyEmi: number;
  count: number;
  buckets: LiabilityBucketsSummary;
  largestLiability: Liability | null;
}

function liabilityBucket(type: LiabilityType) {
  switch (type) {
    case "Home Loan":
    case "Loan Against Property":
      return "homeLoan" as const;
    case "Car Loan":
      return "carLoan" as const;
    case "Credit Card":
      return "creditCards" as const;
    case "Personal Loan":
    case "Overdraft / Line of Credit":
      return "personalLoan" as const;
    case "Education Loan":
    case "Other Liability":
    default:
      return "otherLiabilities" as const;
  }
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

export async function getLiabilities(): Promise<Liability[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client.from("liabilities").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Liability[];
}

export async function createLiability(input: LiabilityInsert): Promise<Liability> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("liabilities")
    .insert({
      ...input,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Liability;
}

export async function updateLiability(input: LiabilityUpdate): Promise<Liability> {
  const { client, user } = await requireAuthenticatedUser();

  const { id, ...updates } = input;
  const { data, error } = await client
    .from("liabilities")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Liability;
}

export async function deleteLiability(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("liabilities").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function buildLiabilitiesSummary(liabilities: Liability[]): LiabilitiesSummary {
  const buckets = liabilities.reduce<LiabilityBucketsSummary>(
    (acc, liability) => {
      const bucket = liabilityBucket(liability.liability_type);
      acc[bucket] += Number(liability.outstanding_amount ?? 0);
      return acc;
    },
    {
      homeLoan: 0,
      carLoan: 0,
      creditCards: 0,
      personalLoan: 0,
      otherLiabilities: 0,
    },
  );

  const totalLiabilities =
    buckets.homeLoan + buckets.carLoan + buckets.creditCards + buckets.personalLoan + buckets.otherLiabilities;

  const largestLiability = liabilities.reduce<Liability | null>((current, liability) => {
    if (!current || Number(liability.outstanding_amount ?? 0) > Number(current.outstanding_amount ?? 0)) {
      return liability;
    }
    return current;
  }, null);

  return {
    totalLiabilities,
    totalMonthlyEmi: liabilities.reduce((sum, liability) => sum + Number(liability.emi ?? 0), 0),
    count: liabilities.length,
    buckets,
    largestLiability,
  };
}

export async function getLiabilitiesSummary(): Promise<LiabilitiesSummary> {
  const liabilities = await getLiabilities();
  return buildLiabilitiesSummary(liabilities);
}
