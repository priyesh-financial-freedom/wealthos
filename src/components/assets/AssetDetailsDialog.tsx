"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Asset } from "@/types/asset";

interface AssetDetailsDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AssetDetailsDialog({ asset, open, onOpenChange }: AssetDetailsDialogProps) {
  if (!asset) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{asset.asset_name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Asset type</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{asset.asset_type}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Institution</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{asset.institution ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Current value</p>
            <p className="mt-1 text-base font-semibold text-slate-900">${asset.current_value.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Purchase value</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{asset.purchase_value ? `$${asset.purchase_value.toLocaleString()}` : "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Purchase date</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatDate(asset.purchase_date)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Owner</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{asset.owner ?? "—"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{asset.notes || "No notes provided."}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Created</p>
            <p className="mt-1 text-sm text-slate-700">{formatDate(asset.created_at)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Updated</p>
            <p className="mt-1 text-sm text-slate-700">{formatDate(asset.updated_at)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
