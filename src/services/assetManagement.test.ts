import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Asset as AssetRecord } from "@/types/asset";

const runtime = vi.hoisted(() => ({
  getAssets: vi.fn(),
  createAsset: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
}));

vi.mock("@/services/assets", () => ({
  getAssets: runtime.getAssets,
  createAsset: runtime.createAsset,
  updateAsset: runtime.updateAsset,
  deleteAsset: runtime.deleteAsset,
}));

import {
  AssetManagementService,
  buildAssetSummary,
  buildAssetSummaryFromAssets,
  generateAssetProjectionIntegration,
  validateAsset,
} from "./assetManagement";

function makeRecord(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: "asset-1",
    user_id: "user-1",
    asset_type: "real_estate",
    asset_name: "Primary Home",
    institution: null,
    current_value: 9000000,
    purchase_value: null,
    purchase_date: null,
    owner: "Self",
    notes: "Core family asset\n__ASSET_META__:{\"growthRate\":6,\"status\":\"Active\",\"type\":\"Property\"}",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("asset validation", () => {
  it("returns issues for invalid input", () => {
    const issues = validateAsset({
      name: "",
      type: "Property",
      currentValue: -1,
      growthRate: 150,
      owner: null,
      notes: null,
      status: "Active",
    });

    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["name", "currentValue", "growthRate"]),
    );
  });
});

describe("asset summaries", () => {
  it("builds summary totals and largest asset", () => {
    const summary = buildAssetSummary([
      {
        id: "a1",
        name: "Primary Home",
        type: "Property",
        currentValue: 9000000,
        growthRate: 6,
        owner: "Self",
        notes: null,
        status: "Active",
      },
      {
        id: "a2",
        name: "Gold",
        type: "Gold",
        currentValue: 500000,
        growthRate: 4,
        owner: "Self",
        notes: null,
        status: "Active",
      },
    ]);

    expect(summary.totalAssets).toBe(9500000);
    expect(summary.assetCount).toBe(2);
    expect(summary.largestAsset?.name).toBe("Primary Home");
  });

  it("builds summary from asset records", () => {
    const summary = buildAssetSummaryFromAssets([
      makeRecord(),
      makeRecord({ id: "asset-2", asset_name: "Vehicle", asset_type: "vehicle", current_value: 1200000 }),
    ]);

    expect(summary.totalAssets).toBe(10200000);
    expect(summary.assetCount).toBe(2);
    expect(summary.largestAsset?.name).toBe("Primary Home");
  });
});

describe("asset projection integration", () => {
  it("returns active asset positions and growth rules", () => {
    const integration = generateAssetProjectionIntegration([
      {
        id: "a1",
        name: "Primary Home",
        type: "Property",
        currentValue: 9000000,
        growthRate: 6,
        owner: "Self",
        notes: null,
        status: "Active",
      },
      {
        id: "a2",
        name: "Sold Car",
        type: "Vehicle",
        currentValue: 0,
        growthRate: -8,
        owner: "Self",
        notes: null,
        status: "Sold",
      },
    ]);

    expect(integration.assetPositions).toHaveLength(1);
    expect(integration.assetPositions[0].category).toBe("Property");
    expect(integration.growthRules).toHaveLength(1);
    expect(integration.growthRules[0].target).toBe("assets");
  });
});

describe("AssetManagementService CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists assets", async () => {
    runtime.getAssets.mockResolvedValue([makeRecord()]);

    const service = new AssetManagementService();
    const assets = await service.listAssets();

    expect(assets).toHaveLength(1);
    expect(assets[0].name).toBe("Primary Home");
  });

  it("adds an asset", async () => {
    runtime.createAsset.mockResolvedValue(makeRecord());

    const service = new AssetManagementService();
    const created = await service.addAsset({
      name: "Primary Home",
      type: "Property",
      currentValue: 9000000,
      growthRate: 6,
      owner: "Self",
      notes: "Core family asset",
      status: "Active",
    });

    expect(runtime.createAsset).toHaveBeenCalledTimes(1);
    expect(created.id).toBe("asset-1");
  });

  it("edits an asset", async () => {
    runtime.getAssets.mockResolvedValue([makeRecord()]);
    runtime.updateAsset.mockResolvedValue(makeRecord({ current_value: 8500000 }));

    const service = new AssetManagementService();
    const updated = await service.editAsset("asset-1", { currentValue: 8500000 });

    expect(runtime.updateAsset).toHaveBeenCalledTimes(1);
    expect(updated.currentValue).toBe(8500000);
  });

  it("deletes an asset", async () => {
    runtime.deleteAsset.mockResolvedValue(undefined);

    const service = new AssetManagementService();
    await service.deleteAsset("asset-1");

    expect(runtime.deleteAsset).toHaveBeenCalledWith("asset-1");
  });
});
