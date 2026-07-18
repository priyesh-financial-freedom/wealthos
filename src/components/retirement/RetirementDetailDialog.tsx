"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RetirementAccount } from "@/types/retirementAccount";

interface RetirementDetailDialogProps {
  account: RetirementAccount | null;
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

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

export function RetirementDetailDialog({ account, open, onOpenChange }: RetirementDetailDialogProps) {
  if (!account) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account.account_type} Retirement Account</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard label="Institution" value={account.institution} />
          <StatCard label="Holder Name" value={account.holder_name} />
          <StatCard label="Account Number" value={account.account_number} />
          <StatCard label="Opening Date" value={formatDate(account.opening_date)} />
          <StatCard label="Current Value" value={formatMoney(account.current_value)} />
          <StatCard label="Monthly Contribution" value={formatMoney(account.monthly_contribution)} />
          <StatCard label="Annual Contribution" value={formatMoney(account.annual_contribution)} />
          <StatCard label="Interest Rate" value={`${account.interest_rate.toFixed(2)}%`} />
          <StatCard label="Nominee" value={account.nominee || "—"} />
          <StatCard label="Created" value={formatDate(account.created_at)} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{account.notes || "No notes provided."}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}