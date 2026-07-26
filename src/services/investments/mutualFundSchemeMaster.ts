import { supabase } from "@/lib/supabase/client";
import type { InvestmentMode, InvestmentOptionType } from "@/types/investment";

export type MutualFundSchemeMasterItem = {
  id: string;
  user_id: string;
  scheme_name: string;
  amc: string;
  amfi_scheme_code: string;
  investment_mode: InvestmentMode | null;
  option_type: InvestmentOptionType | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

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

function normalizeMode(value: string | null | undefined): InvestmentMode | null {
  if (!value) {
    return null;
  }

  return value === "Regular" ? "Regular" : "Direct";
}

function normalizeOption(value: string | null | undefined): InvestmentOptionType | null {
  if (!value) {
    return null;
  }

  return value === "IDCW" ? "IDCW" : "Growth";
}

function mapRow(row: Record<string, unknown>): MutualFundSchemeMasterItem {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    scheme_name: String(row.scheme_name),
    amc: String(row.amc),
    amfi_scheme_code: String(row.amfi_scheme_code),
    investment_mode: normalizeMode(row.investment_mode as string | null | undefined),
    option_type: normalizeOption(row.option_type as string | null | undefined),
    category: row.category ? String(row.category) : null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listMutualFundSchemeMaster(): Promise<MutualFundSchemeMasterItem[]> {
  const { client, user } = await requireAuthenticatedUser();

  const response = await client
    .from("mutual_fund_scheme_master")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("scheme_name", { ascending: true });

  if (response.error) {
    const message = response.error.message.toLowerCase();
    if (message.includes("does not exist") || (message.includes("relation") && message.includes("not found"))) {
      return [];
    }
    throw new Error(response.error.message);
  }

  return (response.data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function upsertMutualFundSchemeMaster(input: {
  schemeName: string;
  amc: string | null;
  amfiSchemeCode: string | null;
  investmentMode: InvestmentMode | null;
  optionType: InvestmentOptionType | null;
  category?: string | null;
}): Promise<void> {
  if (!input.schemeName.trim() || !input.amc?.trim() || !input.amfiSchemeCode?.trim()) {
    return;
  }

  const { client, user } = await requireAuthenticatedUser();

  const response = await client
    .from("mutual_fund_scheme_master")
    .upsert(
      {
        user_id: user.id,
        scheme_name: input.schemeName.trim(),
        amc: input.amc.trim(),
        amfi_scheme_code: input.amfiSchemeCode.trim(),
        investment_mode: input.investmentMode,
        option_type: input.optionType,
        category: input.category ?? null,
        is_active: true,
      },
      {
        onConflict: "user_id,amfi_scheme_code",
      },
    );

  if (response.error) {
    const message = response.error.message.toLowerCase();
    if (message.includes("does not exist") || (message.includes("relation") && message.includes("not found"))) {
      return;
    }
    throw new Error(response.error.message);
  }
}
