"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SummaryCard, SummaryCardGrid } from "@/components/ui/summary-cards";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import {
  assetManagementService,
  type Asset,
  type AssetCreateInput,
  type AssetSummary,
  type AssetType,
} from "@/services/assetManagement";

const assetTypes: AssetType[] = ["Property", "Gold", "Bank Account", "Fixed Deposit", "Vehicle", "Cash", "Other"];

const defaultFormValues: AssetCreateInput = {
  name: "",
  type: "Other",
  currentValue: 0,
  growthRate: 0,
  owner: null,
  notes: null,
  status: "Active",
};

const emptySummary: AssetSummary = {
  totalAssets: 0,
  assetCount: 0,
  largestAsset: null,
};

function toNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<AssetSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [formValues, setFormValues] = useState<AssetCreateInput>(defaultFormValues);

  const dialogTitle = useMemo(() => (editingAsset ? "Edit Asset" : "Add Asset"), [editingAsset]);

  const loadData = useCallback(async () => {
    setError(null);

    try {
      const [assetRows, nextSummary] = await Promise.all([
        assetManagementService.listAssets(),
        assetManagementService.getAssetSummary(),
      ]);

      setAssets(assetRows);
      setSummary(nextSummary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load assets.");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      await loadData();
      if (mounted) {
        setLoading(false);
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [loadData]);

  function openCreateDialog() {
    setEditingAsset(null);
    setFormValues(defaultFormValues);
    setFormOpen(true);
  }

  function openEditDialog(asset: Asset) {
    setEditingAsset(asset);
    setFormValues({
      name: asset.name,
      type: asset.type,
      currentValue: asset.currentValue,
      growthRate: asset.growthRate,
      owner: asset.owner,
      notes: asset.notes,
      status: asset.status,
    });
    setFormOpen(true);
  }

  async function handleSaveAsset() {
    setSubmitting(true);
    setError(null);

    try {
      if (editingAsset) {
        await assetManagementService.editAsset(editingAsset.id, formValues);
      } else {
        await assetManagementService.addAsset(formValues);
      }

      setFormOpen(false);
      setEditingAsset(null);
      setFormValues(defaultFormValues);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save asset.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAsset(asset: Asset) {
    const confirmed = window.confirm(`Delete asset \"${asset.name}\"?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await assetManagementService.deleteAsset(asset.id);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete asset.");
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Assets" }]} />

        <PageToolbar>
          <PageHeader
            title="Assets"
            description="Manage assets in one place and keep your asset summary up to date."
            summary={summary.assetCount > 0 ? `${summary.assetCount} assets tracked` : "No assets added yet"}
          />
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        </PageToolbar>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <SummaryCardGrid>
          <SummaryCard title="Total Assets" value={formatCurrency(summary.totalAssets, { maximumFractionDigits: 0 })} tone="positive" />
          <SummaryCard title="Asset Count" value={summary.assetCount.toLocaleString("en-IN")} />
          <SummaryCard title="Largest Asset" value={summary.largestAsset ? summary.largestAsset.name : "No assets"} />
          <SummaryCard
            title="Largest Asset Value"
            value={summary.largestAsset ? formatCurrency(summary.largestAsset.currentValue, { maximumFractionDigits: 0 }) : "—"}
          />
        </SummaryCardGrid>

        <ContentContainer>
          {loading ? (
            <LoadingSpinner label="Loading assets..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Current Value</th>
                    <th className="px-3 py-2">Growth Rate</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {assets.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>No assets yet. Add your first asset to begin.</td>
                    </tr>
                  ) : (
                    assets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="px-3 py-3 font-medium text-slate-900">{asset.name}</td>
                        <td className="px-3 py-3">{asset.type}</td>
                        <td className="px-3 py-3">{formatCurrency(asset.currentValue, { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-3">{asset.growthRate.toFixed(2)}%</td>
                        <td className="px-3 py-3">{asset.status}</td>
                        <td className="px-3 py-3">{asset.owner ?? "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(asset)}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => void handleDeleteAsset(asset)}>
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </ContentContainer>

        <Dialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) {
              setEditingAsset(null);
              setFormValues(defaultFormValues);
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="asset-name">Name</Label>
                <Input
                  id="asset-name"
                  value={formValues.name}
                  onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Primary Home"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-type">Type</Label>
                <select
                  id="asset-type"
                  value={formValues.type}
                  onChange={(event) => setFormValues((current) => ({ ...current, type: event.target.value as AssetType }))}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  {assetTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-status">Status</Label>
                <select
                  id="asset-status"
                  value={formValues.status}
                  onChange={(event) => setFormValues((current) => ({ ...current, status: event.target.value as "Active" | "Sold" }))}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="Active">Active</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-current-value">Current Value</Label>
                <Input
                  id="asset-current-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.currentValue}
                  onChange={(event) => setFormValues((current) => ({ ...current, currentValue: toNumber(event.target.value) }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-growth-rate">Growth Rate (%)</Label>
                <Input
                  id="asset-growth-rate"
                  type="number"
                  min="-100"
                  max="100"
                  step="0.01"
                  value={formValues.growthRate}
                  onChange={(event) => setFormValues((current) => ({ ...current, growthRate: toNumber(event.target.value) }))}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="asset-owner">Owner</Label>
                <Input
                  id="asset-owner"
                  value={formValues.owner ?? ""}
                  onChange={(event) => setFormValues((current) => ({ ...current, owner: normalizeNullableText(event.target.value) }))}
                  placeholder="Self"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="asset-notes">Notes</Label>
                <Textarea
                  id="asset-notes"
                  value={formValues.notes ?? ""}
                  onChange={(event) => setFormValues((current) => ({ ...current, notes: normalizeNullableText(event.target.value) }))}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormOpen(false);
                  setEditingAsset(null);
                  setFormValues(defaultFormValues);
                }}
              >
                Cancel
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void handleSaveAsset()}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AppLayout>
  );
}
