"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BankAccount } from "@/types/bankAccount";

interface BankAccountDetailsDialogProps {
  account: BankAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function BankAccountDetailsDialog({ account, open, onOpenChange }: BankAccountDetailsDialogProps) {
  if (!account) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account.bank} • {account.account_name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="Account Type" value={account.account_type} />
          <InfoCard label="Nickname" value={account.nickname || "—"} />
          <InfoCard label="Masked Number" value={account.masked_account_number} />
          <InfoCard label="IFSC" value={account.ifsc || "—"} />
          <InfoCard label="Current Balance" value={formatCurrency(account.current_balance, account.currency)} />
          <InfoCard label="Opening Balance" value={formatCurrency(account.opening_balance, account.currency)} />
          <InfoCard label="Interest Rate" value={`${Number(account.interest_rate ?? 0).toFixed(3)}%`} />
          <InfoCard label="Status" value={account.status} />
          <InfoCard label="Owner" value={account.owner || "—"} />
          <InfoCard label="Nominee" value={account.nominee || "—"} />
          <InfoCard label="Joint Holder" value={account.joint_holder || "—"} />
          <InfoCard label="Documents" value={account.documents_placeholder || "No documents added"} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{account.notes || "No notes provided."}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="Created" value={formatDate(account.created_at)} />
          <InfoCard label="Updated" value={formatDate(account.updated_at)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}
