import { supabase } from "@/lib/supabase/client";
import type { Liability, LiabilityInsert, LiabilityUpdate } from "@/types/liability";

export async function getLiabilities(): Promise<Liability[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.from("liabilities").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Liability[];
}

export async function createLiability(input: LiabilityInsert): Promise<Liability> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { data, error } = await supabase.from("liabilities").insert(input).select().single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Liability;
}

export async function updateLiability(input: LiabilityUpdate): Promise<Liability> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { id, ...updates } = input;
  const { data, error } = await supabase.from("liabilities").update(updates).eq("id", id).select().single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Liability;
}

export async function deleteLiability(id: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { error } = await supabase.from("liabilities").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
