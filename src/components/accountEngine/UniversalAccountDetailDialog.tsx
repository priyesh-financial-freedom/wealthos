"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UniversalAccount, UniversalAccountMetrics } from "@/types/universalAccount";

interface UniversalAccountDetailDialogProps {
  account: UniversalAccount | null;
  metrics: UniversalAccountMetrics | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Number(value ?? 0).toLocaleString()}`;
  }
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "—";
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function UniversalAccountDetailDialog({ account, metrics, open, onOpenChange }: UniversalAccountDetailDialogProps) {
  if (!account) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{account.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric title="Current Value" value={formatMoney(account.current_value, account.currency)} />
            <Metric title="Opening Value" value={formatMoney(account.opening_value, account.currency)} />
            <Metric title="Net Change" value={formatMoney(account.current_value - account.opening_value, account.currency)} />
            <Metric title="Monthly Growth" value={formatMoney(metrics?.monthlyGrowth ?? 0, account.currency)} />
            <Metric title="CAGR" value={formatPercent(metrics?.cagr ?? null)} />
            <Metric title="XIRR" value={formatPercent(metrics?.xirr ?? null)} />
            <Metric title="Contributions" value={formatMoney(metrics?.totalContributions ?? 0, account.currency)} />
            <Metric title="Withdrawals" value={formatMoney(metrics?.totalWithdrawals ?? 0, account.currency)} />
            <Metric title="Lifetime Return" value={formatMoney(metrics?.lifetimeReturn ?? 0, account.currency)} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-800">Account Details</h4>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Institution" value={account.institution || "—"} />
              <Detail label="Type" value={account.account_type} />
              <Detail label="Status" value={account.status} />
              <Detail label="Owner" value={account.owner || "—"} />
              <Detail label="Joint Owner" value={account.joint_owner || "—"} />
              <Detail label="Nominee" value={account.nominee || "—"} />
              <Detail label="Currency" value={account.currency} />
              <Detail label="Interest Rate" value={account.interest_rate !== null ? `${account.interest_rate}%` : "—"} />
              <Detail label="Purchase Date" value={account.purchase_date || "—"} />
              <Detail label="Maturity Date" value={account.maturity_date || "—"} />
              <Detail label="Last Updated" value={new Date(account.updated_at).toLocaleString()} />
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Notes</h4>
            <p className="text-sm text-slate-700">{account.notes || "No notes available."}</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
