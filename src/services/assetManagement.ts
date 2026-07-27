import type { AssetPosition, GrowthRule } from "@/services/projection-engine";
import type { Asset as AssetRecord, AssetInsert, AssetUpdate } from "@/types/asset";

import {
  createAsset,
  deleteAsset,
  getAssets,
  updateAsset,
} from "@/services/assets";

export type AssetType =
  | "Property"
  | "Gold"
  | "Bank Account"
  | "Fixed Deposit"
  | "Vehicle"
  | "Cash"
  | "Other";

export type AssetStatus = "Active" | "Sold";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  currentValue: number;
  growthRate: number;
  owner: string | null;
  notes: string | null;
  status: AssetStatus;
}

export type AssetCreateInput = Omit<Asset, "id">;
export type AssetUpdateInput = Partial<Omit<Asset, "id">>;

export interface AssetValidationIssue {
  field: keyof AssetCreateInput;
  message: string;
}

export interface AssetSummary {
  totalAssets: number;
  assetCount: number;
  largestAsset: Asset | null;
}

export interface AssetProjectionIntegration {
  assetPositions: AssetPosition[];
  growthRules: GrowthRule[];
  totalCurrentValue: number;
}

interface AssetMeta {
  growthRate?: number;
  status?: AssetStatus;
  type?: AssetType;
}

const META_PREFIX = "__ASSET_META__:";

const assetTypeToRecordType: Record<AssetType, AssetRecord["asset_type"]> = {
  Property: "real_estate",
  Gold: "investment",
  "Bank Account": "checking",
  "Fixed Deposit": "investment",
  Vehicle: "vehicle",
  Cash: "cash",
  Other: "other",
};

const recordTypeToAssetType: Record<AssetRecord["asset_type"], AssetType> = {
  real_estate: "Property",
  vehicle: "Vehicle",
  cash: "Cash",
  checking: "Bank Account",
  savings: "Bank Account",
  investment: "Other",
  business: "Other",
  other: "Other",
};

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

function clampGrowth(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

function parseNotesWithMeta(raw: string | null | undefined): { notes: string | null; meta: AssetMeta } {
  if (!raw) {
    return { notes: null, meta: {} };
  }

  const lines = raw.split("\n");
  const metaLine = lines.find((line) => line.startsWith(META_PREFIX));
  if (!metaLine) {
    return { notes: raw, meta: {} };
  }

  let meta: AssetMeta = {};
  try {
    meta = JSON.parse(metaLine.slice(META_PREFIX.length)) as AssetMeta;
  } catch {
    meta = {};
  }

  const notes = lines.filter((line) => !line.startsWith(META_PREFIX)).join("\n").trim();
  return {
    notes: notes.length > 0 ? notes : null,
    meta,
  };
}

function composeNotes(notes: string | null | undefined, meta: AssetMeta): string | null {
  const cleanNotes = (notes ?? "").trim();
  const compactMeta: AssetMeta = {
    ...(typeof meta.growthRate === "number" ? { growthRate: meta.growthRate } : {}),
    ...(meta.status ? { status: meta.status } : {}),
    ...(meta.type ? { type: meta.type } : {}),
  };

  const hasMeta = Object.keys(compactMeta).length > 0;

  if (!hasMeta) {
    return cleanNotes.length > 0 ? cleanNotes : null;
  }

  const metaPayload = `${META_PREFIX}${JSON.stringify(compactMeta)}`;
  return cleanNotes.length > 0 ? `${cleanNotes}\n${metaPayload}` : metaPayload;
}

function mapRecordToAsset(record: AssetRecord): Asset {
  const parsed = parseNotesWithMeta(record.notes);
  const fallbackType = recordTypeToAssetType[record.asset_type] ?? "Other";
  const type = parsed.meta.type ?? fallbackType;

  return {
    id: record.id,
    name: record.asset_name,
    type,
    currentValue: Math.max(0, toNumber(record.current_value)),
    growthRate: clampGrowth(toNumber(parsed.meta.growthRate ?? 0)),
    owner: record.owner ?? null,
    notes: parsed.notes,
    status: parsed.meta.status ?? "Active",
  };
}

function mapAssetToInsert(input: AssetCreateInput): AssetInsert {
  return {
    asset_type: assetTypeToRecordType[input.type],
    asset_name: input.name,
    current_value: roundTwo(Math.max(0, input.currentValue)),
    owner: input.owner,
    notes: composeNotes(input.notes, {
      growthRate: roundTwo(clampGrowth(input.growthRate)),
      status: input.status,
      type: input.type,
    }),
  };
}

function mapAssetUpdatesToRecordUpdate(current: AssetRecord, updates: AssetUpdateInput): AssetUpdate {
  const parsed = parseNotesWithMeta(current.notes);
  const nextMeta: AssetMeta = {
    growthRate: updates.growthRate ?? parsed.meta.growthRate ?? 0,
    status: updates.status ?? parsed.meta.status ?? "Active",
    type: updates.type ?? parsed.meta.type ?? recordTypeToAssetType[current.asset_type],
  };

  return {
    id: current.id,
    ...(updates.type ? { asset_type: assetTypeToRecordType[updates.type] } : {}),
    ...(updates.name !== undefined ? { asset_name: updates.name } : {}),
    ...(updates.currentValue !== undefined ? { current_value: roundTwo(Math.max(0, updates.currentValue)) } : {}),
    ...(updates.owner !== undefined ? { owner: updates.owner } : {}),
    ...(updates.notes !== undefined || updates.growthRate !== undefined || updates.status !== undefined || updates.type !== undefined
      ? { notes: composeNotes(updates.notes ?? parsed.notes, nextMeta) }
      : {}),
  };
}

export function validateAsset(input: AssetCreateInput): AssetValidationIssue[] {
  const issues: AssetValidationIssue[] = [];

  if (!String(input.name ?? "").trim()) {
    issues.push({ field: "name", message: "Name is required." });
  }

  if (toNumber(input.currentValue) < 0) {
    issues.push({ field: "currentValue", message: "Current value must be greater than or equal to 0." });
  }

  const growthRate = toNumber(input.growthRate);
  if (growthRate < -100 || growthRate > 100) {
    issues.push({ field: "growthRate", message: "Growth rate must be between -100 and 100." });
  }

  return issues;
}

function assertValidAsset(input: AssetCreateInput): void {
  const issues = validateAsset(input);
  if (issues.length === 0) {
    return;
  }

  throw new Error(issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | "));
}

function isActiveAsset(asset: Asset): boolean {
  return asset.status === "Active" && asset.currentValue > 0;
}

export function buildAssetSummary(assets: readonly Asset[]): AssetSummary {
  const totalAssets = assets.reduce((sum, asset) => sum + Math.max(0, asset.currentValue), 0);
  const largestAsset = assets.reduce<Asset | null>((current, asset) => {
    if (!current || asset.currentValue > current.currentValue) {
      return asset;
    }
    return current;
  }, null);

  return {
    totalAssets: roundTwo(totalAssets),
    assetCount: assets.length,
    largestAsset,
  };
}

export function buildAssetSummaryFromAssets(records: readonly AssetRecord[]): AssetSummary {
  return buildAssetSummary(records.map(mapRecordToAsset));
}

export function generateAssetProjectionIntegration(assets: readonly Asset[]): AssetProjectionIntegration {
  const activeAssets = assets.filter(isActiveAsset);

  const assetPositions: AssetPosition[] = activeAssets.map((asset) => ({
    id: asset.id,
    category: asset.type,
    currentValue: roundTwo(Math.max(0, asset.currentValue)),
  }));

  const growthRules: GrowthRule[] = activeAssets
    .filter((asset) => Number.isFinite(asset.growthRate))
    .map((asset) => ({
      id: `asset:${asset.id}:growth`,
      target: "assets",
      annualRate: roundTwo(clampGrowth(asset.growthRate)),
      enabled: true,
    }));

  return {
    assetPositions,
    growthRules,
    totalCurrentValue: roundTwo(activeAssets.reduce((sum, asset) => sum + Math.max(0, asset.currentValue), 0)),
  };
}

export class AssetManagementService {
  async listAssets(): Promise<Asset[]> {
    const records = await getAssets();
    return records.map(mapRecordToAsset);
  }

  async addAsset(input: AssetCreateInput): Promise<Asset> {
    assertValidAsset(input);
    const created = await createAsset(mapAssetToInsert(input));
    return mapRecordToAsset(created);
  }

  async editAsset(id: string, updates: AssetUpdateInput): Promise<Asset> {
    const records = await getAssets();
    const current = records.find((record) => record.id === id);

    if (!current) {
      throw new Error("Asset not found.");
    }

    const existing = mapRecordToAsset(current);
    const merged: AssetCreateInput = {
      name: updates.name ?? existing.name,
      type: updates.type ?? existing.type,
      currentValue: updates.currentValue ?? existing.currentValue,
      growthRate: updates.growthRate ?? existing.growthRate,
      owner: updates.owner ?? existing.owner,
      notes: updates.notes ?? existing.notes,
      status: updates.status ?? existing.status,
    };

    assertValidAsset(merged);
    const updated = await updateAsset(mapAssetUpdatesToRecordUpdate(current, updates));
    return mapRecordToAsset(updated);
  }

  async deleteAsset(id: string): Promise<void> {
    await deleteAsset(id);
  }

  async getAssetSummary(): Promise<AssetSummary> {
    const assets = await this.listAssets();
    return buildAssetSummary(assets);
  }
}

export const assetManagementService = new AssetManagementService();
