"use client";

import { useMemo, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssetAllocationChart } from "@/components/assets/AssetAllocationChart";
import { AssetForm } from "@/components/assets/AssetForm";
import { AssetSummary } from "@/components/assets/AssetSummary";
import { AssetTable } from "@/components/assets/AssetTable";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createAsset, deleteAsset, getAssets, updateAsset } from "@/services/assets";
import type { Asset, AssetInsert } from "@/types/asset";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useState(() => {
    void refreshAssets();
  });

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return assets;
    }
    return assets.filter((asset) => `${asset.asset_name} ${asset.institution ?? ""} ${asset.owner ?? ""}`.toLowerCase().includes(normalized));
  }, [assets, query]);

  async function handleCreate(values: AssetInsert) {
    setSubmitting(true);
    try {
      await createAsset(values);
      setDialogOpen(false);
      await refreshAssets();
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
    try {
      await updateAsset({ id: editingAsset.id, ...values });
      setDialogOpen(false);
      setEditingAsset(null);
      await refreshAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update asset");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(asset: Asset) {
    try {
      await deleteAsset(asset.id);
      setDeleteTarget(null);
      await refreshAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete asset");
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader title="Assets" description="Track holdings, values, and growth with a professional overview." />
          <Button onClick={() => { setEditingAsset(null); setDialogOpen(true); }}>Add Asset</Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <AssetSummary assets={filteredAssets} />

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <DashboardCard>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Asset inventory</h3>
                <p className="text-sm text-slate-600">Search, filter, and manage holdings</p>
              </div>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets" className="max-w-sm" />
            </div>
            {loading ? <div className="py-10 text-center text-sm text-slate-500">Loading assets...</div> : <AssetTable assets={filteredAssets} onEdit={(asset) => { setEditingAsset(asset); setDialogOpen(true); }} onDelete={(asset) => setDeleteTarget(asset)} />}
          </DashboardCard>
          <AssetAllocationChart assets={filteredAssets} />
        </div>
      </PageContainer>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingAsset(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit asset" : "Add asset"}</DialogTitle>
          </DialogHeader>
          <AssetForm initialData={editingAsset} onSubmit={editingAsset ? handleUpdate : handleCreate} onCancel={() => { setDialogOpen(false); setEditingAsset(null); }} submitting={submitting} />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete asset</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this asset?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
