"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Investment } from "@/types/investment";

interface InvestmentDetailsDialogProps {
  investment: Investment | null;
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

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(2)}%`;
}

export function InvestmentDetailsDialog({ investment, open, onOpenChange }: InvestmentDetailsDialogProps) {
  if (!investment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{investment.investment_name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailCard label="Category" value={investment.category} />
          <DetailCard label="Region" value={investment.region} />
          <DetailCard label="Units" value={investment.units.toLocaleString()} />
          <DetailCard label="NAV / Price" value={formatCurrency(investment.nav_price)} />
          <DetailCard label="Current value" value={formatCurrency(investment.current_value)} />
          <DetailCard label="Cost basis" value={formatCurrency(investment.cost_basis)} />
          <DetailCard label="Overall gain" value={formatCurrency(investment.gain_loss)} />
          <DetailCard label="Today's gain/loss" value={formatCurrency(investment.today_gain_loss)} />
          <DetailCard label="CAGR" value={formatPercent(investment.cagr)} />
          <DetailCard label="XIRR" value={formatPercent(investment.xirr)} />
          <DetailCard label="Sector" value={investment.sector ?? "—"} />
          <DetailCard label="AMC / Issuer" value={investment.amc ?? "—"} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{investment.notes || "No notes provided."}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailCard label="Purchase date" value={formatDate(investment.purchase_date)} />
          <DetailCard label="Updated" value={formatDate(investment.updated_at)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}