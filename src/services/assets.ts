import { supabase } from "@/lib/supabase/client";
import type { Asset, AssetInsert, AssetUpdate } from "@/types/asset";

export interface AssetsSummary {
  totalsByType: Record<string, number>;
  totalAssetsValue: number;
  totalCashLikeAssets: number;
  totalInvestmentAssets: number;
  totalRealEstateAssets: number;
  totalVehicleAssets: number;
  totalOtherAssets: number;
  largestAsset: Asset | null;
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

export function buildAssetsSummary(assets: Asset[]): AssetsSummary {
  const totalsByType = assets.reduce<Record<string, number>>((acc, asset) => {
    const key = asset.asset_type || "other";
    acc[key] = (acc[key] ?? 0) + Number(asset.current_value ?? 0);
    return acc;
  }, {});

  const totalAssetsValue = assets.reduce((sum, asset) => sum + Number(asset.current_value ?? 0), 0);
  const totalCashLikeAssets = Number(totalsByType.cash ?? 0) + Number(totalsByType.checking ?? 0) + Number(totalsByType.savings ?? 0);
  const totalInvestmentAssets = Number(totalsByType.investment ?? 0);
  const totalRealEstateAssets = Number(totalsByType.real_estate ?? 0);
  const totalVehicleAssets = Number(totalsByType.vehicle ?? 0);
  const totalOtherAssets = Number(totalsByType.business ?? 0) + Number(totalsByType.other ?? 0);

  const largestAsset = assets.reduce<Asset | null>((current, asset) => {
    if (!current || Number(asset.current_value ?? 0) > Number(current.current_value ?? 0)) {
      return asset;
    }
    return current;
  }, null);

  return {
    totalsByType,
    totalAssetsValue,
    totalCashLikeAssets,
    totalInvestmentAssets,
    totalRealEstateAssets,
    totalVehicleAssets,
    totalOtherAssets,
    largestAsset,
  };
}

export async function getAssetsSummary(): Promise<AssetsSummary> {
  const assets = await getAssets();
  return buildAssetsSummary(assets);
}
