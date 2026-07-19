import { supabase } from "@/lib/supabase/client";
import type {
  RealEstateProperty,
  RealEstatePropertyInsert,
  RealEstatePropertyUpdate,
} from "@/types/realEstateProperty";

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

function normalize(item: RealEstateProperty): RealEstateProperty {
  return {
    ...item,
    purchase_price: Number(item.purchase_price ?? 0),
    current_market_value: Number(item.current_market_value ?? 0),
    monthly_rent: item.monthly_rent === null ? null : Number(item.monthly_rent ?? 0),
  };
}

export async function getRealEstateProperties(): Promise<RealEstateProperty[]> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("real_estate_properties")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as RealEstateProperty[]).map(normalize);
}

export async function createRealEstateProperty(input: RealEstatePropertyInsert): Promise<RealEstateProperty> {
  const { client, user } = await requireAuthenticatedUser();

  const { data, error } = await client
    .from("real_estate_properties")
    .insert({
      ...input,
      user_id: user.id,
      monthly_rent: input.occupancy_status === "rented" ? Number(input.monthly_rent ?? 0) : 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as RealEstateProperty);
}

export async function updateRealEstateProperty(input: RealEstatePropertyUpdate): Promise<RealEstateProperty> {
  const { client, user } = await requireAuthenticatedUser();
  const { id, ...updates } = input;

  const payload = {
    ...updates,
    monthly_rent: updates.occupancy_status === "self_occupied" ? 0 : updates.monthly_rent,
  };

  const { data, error } = await client
    .from("real_estate_properties")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalize(data as RealEstateProperty);
}

export async function deleteRealEstateProperty(id: string): Promise<void> {
  const { client, user } = await requireAuthenticatedUser();

  const { error } = await client.from("real_estate_properties").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
