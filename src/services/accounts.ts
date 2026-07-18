import { supabase } from "@/lib/supabase/client";
import type { Account, AccountInsert, AccountUpdate } from "@/types/account";

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

export async function getAccounts(): Promise<Account[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client.from("accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Account[];
}

export async function createAccount(input: AccountInsert): Promise<Account> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("accounts")
    .insert({
      ...input,
      user_id: user.id,
      currency: input.currency ?? "USD",
      status: input.status ?? "active",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Account;
}

export async function updateAccount(input: AccountUpdate): Promise<Account> {
  const { client, user } = await requireAuthenticatedUser();

  const { id, ...updates } = input;
  const { data, error } = await client
    .from("accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Account;
}

export async function deleteAccount(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("accounts").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
