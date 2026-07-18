import { supabase } from "@/lib/supabase/client";
import type { FixedDeposit, FixedDepositInsert, FixedDepositUpdate } from "@/types/fixedDeposit";

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

function normalize(item: FixedDeposit): FixedDeposit {
  return {
    ...item,
    principal: Number(item.principal ?? 0),
    interest_rate: Number(item.interest_rate ?? 0),
    current_value: Number(item.current_value ?? 0),
  };
}

export async function getFixedDeposits(): Promise<FixedDeposit[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("fixed_deposit_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as FixedDeposit[]).map(normalize);
}

export async function createFixedDeposit(input: FixedDepositInsert): Promise<FixedDeposit> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("fixed_deposit_accounts")
    .insert({
      ...input,
      user_id: user.id,
      compounding_frequency: input.compounding_frequency ?? "quarterly",
      auto_renew: input.auto_renew ?? false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as FixedDeposit);
}

export async function updateFixedDeposit(input: FixedDepositUpdate): Promise<FixedDeposit> {
  const { client, user } = await requireAuthenticatedUser();
  const { id, ...updates } = input;

  const { data, error } = await client
    .from("fixed_deposit_accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as FixedDeposit);
}

export async function deleteFixedDeposit(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("fixed_deposit_accounts").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
