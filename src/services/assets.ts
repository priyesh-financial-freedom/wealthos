import { supabase } from "@/lib/supabase/client";
import type { Asset, AssetInsert, AssetUpdate } from "@/types/asset";

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

export async function getAssets(): Promise<Asset[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client.from("assets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Asset[];
}

export async function createAsset(input: AssetInsert): Promise<Asset> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("assets")
    .insert({
      ...input,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Asset;
}

export async function updateAsset(input: AssetUpdate): Promise<Asset> {
  const { client, user } = await requireAuthenticatedUser();

  const { id, ...updates } = input;
  const { data, error } = await client.from("assets").update(updates).eq("id", id).eq("user_id", user.id).select().single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Asset;
}

export async function deleteAsset(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("assets").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
