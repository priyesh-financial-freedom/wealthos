"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Liability } from "@/types/liability";

interface LiabilityDetailsDialogProps {
  liability: Liability | null;
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

function formatCurrency(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `$${value.toLocaleString()}`;
}

export function LiabilityDetailsDialog({ liability, open, onOpenChange }: LiabilityDetailsDialogProps) {
  if (!liability) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{liability.account_name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Liability type</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{liability.liability_type}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Status</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{liability.status}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Lender</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{liability.lender}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Outstanding amount</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(liability.outstanding_amount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Original amount</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(liability.original_amount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Interest rate</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{liability.interest_rate === null ? "—" : `${liability.interest_rate.toFixed(2)}%`}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">EMI</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(liability.emi)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Due day</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{liability.due_day ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Start date</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatDate(liability.start_date)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">End date</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatDate(liability.end_date)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{liability.notes || "No notes provided."}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Created</p>
            <p className="mt-1 text-sm text-slate-700">{formatDate(liability.created_at)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Updated</p>
            <p className="mt-1 text-sm text-slate-700">{formatDate(liability.updated_at)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}