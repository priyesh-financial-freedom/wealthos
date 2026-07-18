"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Account } from "@/types/account";

interface AccountDetailsDialogProps {
  account: Account | null;
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

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
}

export function AccountDetailsDialog({ account, open, onOpenChange }: AccountDetailsDialogProps) {
  if (!account) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account.name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Category</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{account.category}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Status</p>
            <p className="mt-1 text-base font-semibold text-slate-900 capitalize">{account.status.replaceAll("_", " ")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Institution</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{account.institution || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Owner</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{account.owner || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Current value</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(Number(account.current_value ?? 0), account.currency)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Currency</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{account.currency}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <p className="text-sm font-medium text-slate-500">Linked item</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{account.linked_item_type && account.linked_item_id ? `${account.linked_item_type} • ${account.linked_item_id}` : "Not linked"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <p className="text-sm font-medium text-slate-500">Documents placeholder</p>
            <p className="mt-1 text-base text-slate-800">{account.documents_placeholder || "No documents attached yet."}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <p className="text-sm font-medium text-slate-500">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{account.notes || "No notes provided."}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Created</p>
            <p className="mt-1 text-sm text-slate-700">{formatDate(account.created_at)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Updated</p>
            <p className="mt-1 text-sm text-slate-700">{formatDate(account.updated_at)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
