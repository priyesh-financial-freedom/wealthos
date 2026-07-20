import { supabase } from "@/lib/supabase/client";
import type { SilverHolding, SilverHoldingInsert, SilverHoldingUpdate } from "@/types/silverHolding";

export interface SilverHoldingsSummary {
  totalCurrentValue: number;
  totalQuantity: number;
  count: number;
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

function normalize(item: SilverHolding): SilverHolding {
  return {
    ...item,
    quantity: Number(item.quantity ?? 0),
    cost_basis: Number(item.cost_basis ?? 0),
    current_value: Number(item.current_value ?? 0),
  };
}

export async function getSilverHoldings(): Promise<SilverHolding[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("silver_holdings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as SilverHolding[]).map(normalize);
}

export async function createSilverHolding(input: SilverHoldingInsert): Promise<SilverHolding> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("silver_holdings")
    .insert({
      ...input,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as SilverHolding);
}

export async function updateSilverHolding(input: SilverHoldingUpdate): Promise<SilverHolding> {
  const { client, user } = await requireAuthenticatedUser();
  const { id, ...updates } = input;

  const { data, error } = await client
    .from("silver_holdings")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as SilverHolding);
}

export async function deleteSilverHolding(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("silver_holdings").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function buildSilverHoldingsSummary(holdings: SilverHolding[]): SilverHoldingsSummary {
  return {
    totalCurrentValue: holdings.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0),
    totalQuantity: holdings.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    count: holdings.length,
  };
}

export async function getSilverHoldingsSummary(): Promise<SilverHoldingsSummary> {
  const holdings = await getSilverHoldings();
  return buildSilverHoldingsSummary(holdings);
}
