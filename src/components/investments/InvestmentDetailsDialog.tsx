"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Investment } from "@/types/investment";

interface InvestmentDetailsDialogProps {
  investment: Investment | null;
  totalPortfolioValue: number;
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

  return `₹${value.toLocaleString("en-IN")}`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(2)}%`;
}

export function InvestmentDetailsDialog({ investment, totalPortfolioValue, open, onOpenChange }: InvestmentDetailsDialogProps) {
  if (!investment) {
    return null;
  }

  const gainPercent = investment.cost_basis > 0 ? investment.gain_loss / investment.cost_basis : null;
  const portfolioWeight = totalPortfolioValue > 0 ? investment.current_value / totalPortfolioValue : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{investment.investment_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Performance</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailCard label="Current value" value={formatCurrency(investment.current_value)} />
            <DetailCard label="Cost basis" value={formatCurrency(investment.cost_basis)} />
            <DetailCard label="Overall gain/loss" value={formatCurrency(investment.gain_loss)} />
            <DetailCard label="Gain %" value={formatPercent(gainPercent)} />
            <DetailCard label="Portfolio weight" value={formatPercent(portfolioWeight)} />
            <DetailCard label="Today's gain/loss" value={formatCurrency(investment.today_gain_loss)} />
            <DetailCard label="CAGR" value={formatPercent(investment.cagr)} />
            <DetailCard label="XIRR" value={formatPercent(investment.xirr)} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Position</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailCard label="Category" value={investment.category} />
            <DetailCard label="Region" value={investment.region} />
            <DetailCard label="Units" value={investment.units.toLocaleString()} />
            <DetailCard label="NAV / Price" value={formatCurrency(investment.nav_price)} />
            <DetailCard label="Purchase date" value={formatDate(investment.purchase_date)} />
            <DetailCard label="Updated" value={formatDate(investment.updated_at)} />
            <DetailCard label="Sector" value={investment.sector ?? "—"} />
            <DetailCard label="AMC / Issuer" value={investment.amc ?? "—"} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Family Office</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailCard label="Owner" value={investment.owner ?? "—"} />
            <DetailCard label="Nominee" value={investment.nominee ?? "—"} />
            <DetailCard label="Folio number" value={investment.folio_number ?? "—"} />
            <DetailCard label="AMFI scheme code" value={investment.amfi_scheme_code ?? "—"} />
            <DetailCard label="Investment mode" value={investment.investment_mode ?? "—"} />
            <DetailCard label="Option type" value={investment.option_type ?? "—"} />
            <DetailCard label="Broker platform" value={investment.broker_platform ?? "—"} />
            <DetailCard label="SIP amount" value={formatCurrency(investment.sip_amount)} />
            <DetailCard label="SIP date" value={investment.sip_date ? `${investment.sip_date}` : "—"} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{investment.notes || "No notes provided."}</p>
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