import { supabase } from "@/lib/supabase/client";
import type { Asset, AssetInsert, AssetUpdate } from "@/types/asset";

export async function getAssets(): Promise<Asset[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.from("assets").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Asset[];
}

export async function createAsset(input: AssetInsert): Promise<Asset> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { data, error } = await supabase.from("assets").insert(input).select().single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Asset;
}

export async function updateAsset(input: AssetUpdate): Promise<Asset> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { id, ...updates } = input;
  const { data, error } = await supabase.from("assets").update(updates).eq("id", id).select().single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Asset;
}

export async function deleteAsset(id: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { error } = await supabase.from("assets").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
