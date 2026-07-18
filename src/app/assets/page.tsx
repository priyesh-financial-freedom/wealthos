"use client";

import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssetAllocationChart } from "@/components/assets/AssetAllocationChart";
import { AssetDetailsDialog } from "@/components/assets/AssetDetailsDialog";
import { AssetForm } from "@/components/assets/AssetForm";
import { AssetSummary } from "@/components/assets/AssetSummary";
import { AssetTable } from "@/components/assets/AssetTable";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { createAsset, deleteAsset, getAssets, updateAsset } from "@/services/assets";
import type { Asset, AssetInsert } from "@/types/asset";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"name" | "current_value" | "purchase_value" | "purchase_date">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  async function refreshAssets() {
    try {
      setLoading(true);
      const nextAssets = await getAssets();
      setAssets(nextAssets);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load assets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAssets() {
      try {
        const nextAssets = await getAssets();
        if (isMounted) {
          setAssets(nextAssets);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load assets");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = assets.filter((asset) => {
      const matchesQuery = !normalized || `${asset.asset_name} ${asset.institution ?? ""} ${asset.owner ?? ""}`.toLowerCase().includes(normalized);
      const matchesType = assetTypeFilter === "all" || asset.asset_type === assetTypeFilter;
      const matchesOwner = ownerFilter === "all" || (asset.owner ?? "") === ownerFilter;
      return matchesQuery && matchesType && matchesOwner;
    });

    return [...filtered].sort((left, right) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      const getValue = (asset: Asset) => {
        switch (sortKey) {
          case "current_value":
            return Number(asset.current_value);
          case "purchase_value":
            return Number(asset.purchase_value ?? 0);
          case "purchase_date":
            return asset.purchase_date ? new Date(asset.purchase_date).getTime() : 0;
          case "name":
          default:
            return asset.asset_name.toLowerCase();
        }
      };

      const leftValue = getValue(left);
      const rightValue = getValue(right);
      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * multiplier;
      }
      return (Number(leftValue) - Number(rightValue)) * multiplier;
    });
  }, [assetTypeFilter, assets, ownerFilter, query, sortDirection, sortKey]);

  async function handleCreate(values: AssetInsert) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createAsset(values);
      setDialogOpen(false);
      setNotice("Asset created successfully.");
      await refreshAssets();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create asset");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(values: AssetInsert) {
    if (!editingAsset) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await updateAsset({ id: editingAsset.id, ...values });
      setDialogOpen(false);
      setEditingAsset(null);
      setNotice("Asset updated successfully.");
      await refreshAssets();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update asset");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(asset: Asset) {
    setError(null);
    setNotice(null);
    try {
      await deleteAsset(asset.id);
      setDeleteTarget(null);
      setNotice("Asset deleted successfully.");
      await refreshAssets();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete asset");
    }
  }

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader title="Assets" description="Track holdings, values, and growth with a professional overview." />
          <Button onClick={() => { setEditingAsset(null); setDialogOpen(true); }} disabled={submitting}>Add Asset</Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <AssetSummary assets={filteredAssets} />

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <DashboardCard>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Asset inventory</h3>
                <p className="text-sm text-slate-600">Search, filter, and manage holdings</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets" className="max-w-sm" />
                <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={assetTypeFilter} onChange={(event) => setAssetTypeFilter(event.target.value)}>
                  <option value="all">All types</option>
                  <option value="cash">Cash</option>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="investment">Investment</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="business">Business</option>
                  <option value="other">Other</option>
                </select>
                <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                  <option value="all">All owners</option>
                  {Array.from(new Set(assets.map((asset) => asset.owner).filter(Boolean))).map((owner) => (
                    <option key={owner} value={owner as string}>{owner}</option>
                  ))}
                </select>
                <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={`${sortKey}:${sortDirection}`} onChange={(event) => {
                  const [nextKey, nextDirection] = event.target.value.split(":") as [typeof sortKey, typeof sortDirection];
                  setSortKey(nextKey);
                  setSortDirection(nextDirection);
                }}>
                  <option value="name:asc">Name (A-Z)</option>
                  <option value="name:desc">Name (Z-A)</option>
                  <option value="current_value:desc">Current value (High-Low)</option>
                  <option value="current_value:asc">Current value (Low-High)</option>
                  <option value="purchase_value:desc">Purchase value (High-Low)</option>
                  <option value="purchase_value:asc">Purchase value (Low-High)</option>
                  <option value="purchase_date:desc">Purchase date (Newest)</option>
                  <option value="purchase_date:asc">Purchase date (Oldest)</option>
                </select>
              </div>
            </div>
            {loading ? <LoadingSpinner label="Loading assets..." /> : filteredAssets.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><h4 className="text-base font-semibold text-slate-900">No assets yet</h4><p className="mt-2 text-sm text-slate-600">Add your first asset to unlock your portfolio summary and dashboard insights.</p></div> : <AssetTable assets={filteredAssets} onEdit={(asset) => { setEditingAsset(asset); setDialogOpen(true); }} onDelete={(asset) => setDeleteTarget(asset)} onView={(asset) => setSelectedAsset(asset)} />}
          </DashboardCard>
          <AssetAllocationChart assets={filteredAssets} />
        </div>
      </PageContainer>

      <AssetDetailsDialog asset={selectedAsset} open={Boolean(selectedAsset)} onOpenChange={(open) => { if (!open) setSelectedAsset(null); }} />

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingAsset(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit asset" : "Add asset"}</DialogTitle>
          </DialogHeader>
          <AssetForm key={editingAsset?.id ?? "new-asset"} initialData={editingAsset} onSubmit={editingAsset ? handleUpdate : handleCreate} onCancel={() => { setDialogOpen(false); setEditingAsset(null); }} submitting={submitting} />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete asset</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this asset?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDelete(deleteTarget)} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
