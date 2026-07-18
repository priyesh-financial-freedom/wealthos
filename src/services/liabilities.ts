import { supabase } from "@/lib/supabase/client";
import type { Liability, LiabilityInsert, LiabilityUpdate } from "@/types/liability";

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
