import { supabase } from "@/lib/supabase/client";
import type { GoldHolding, GoldHoldingInsert, GoldHoldingUpdate } from "@/types/goldHolding";

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

function normalize(item: GoldHolding): GoldHolding {
  return {
    ...item,
    quantity: Number(item.quantity ?? 0),
    cost_basis: Number(item.cost_basis ?? 0),
    current_value: Number(item.current_value ?? 0),
  };
}

export async function getGoldHoldings(): Promise<GoldHolding[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("gold_holdings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as GoldHolding[]).map(normalize);
}

export async function createGoldHolding(input: GoldHoldingInsert): Promise<GoldHolding> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("gold_holdings")
    .insert({
      ...input,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as GoldHolding);
}

export async function updateGoldHolding(input: GoldHoldingUpdate): Promise<GoldHolding> {
  const { client, user } = await requireAuthenticatedUser();
  const { id, ...updates } = input;

  const { data, error } = await client
    .from("gold_holdings")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as GoldHolding);
}

export async function deleteGoldHolding(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("gold_holdings").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
