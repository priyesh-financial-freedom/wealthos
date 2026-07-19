"use client";

import { DetailDialog, DetailGrid, DetailItem, DetailSection } from "@/components/ui/detail-dialog";
import { formatCurrency, formatDate, formatPercent, formatNumber } from "@/lib/formatters";
import type { Investment } from "@/types/investment";

interface InvestmentDetailsDialogProps {
  investment: Investment | null;
  totalPortfolioValue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvestmentDetailsDialog({ investment, totalPortfolioValue, open, onOpenChange }: InvestmentDetailsDialogProps) {
  if (!investment) {
    return null;
  }

  const isStock = investment.category === "Stocks";
  const gainPercent = investment.cost_basis > 0 ? investment.gain_loss / investment.cost_basis : null;
  const portfolioWeight = totalPortfolioValue > 0 ? investment.current_value / totalPortfolioValue : null;
  const averagePurchasePrice = investment.units > 0 ? investment.cost_basis / investment.units : null;

  return (
    <DetailDialog open={open} onOpenChange={onOpenChange} title={investment.investment_name} description="Position summary and metadata.">
      <div className="space-y-6">
        <DetailSection title="Performance">
          <DetailGrid>
            <DetailItem label="Current value" value={formatCurrency(investment.current_value)} />
            <DetailItem label="Invested value" value={formatCurrency(investment.cost_basis)} />
            <DetailItem label="Overall gain/loss" value={formatCurrency(investment.gain_loss)} />
            <DetailItem label="Gain %" value={formatPercent(gainPercent, { digits: 2 })} />
            <DetailItem label="Portfolio weight" value={formatPercent(portfolioWeight, { digits: 2 })} />
            {!isStock ? <DetailItem label="Today's gain/loss" value={formatCurrency(investment.today_gain_loss)} /> : null}
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Position">
          <DetailGrid>
            <DetailItem label="Category" value={investment.category} />
            {!isStock ? <DetailItem label="Region" value={investment.region} /> : null}
            <DetailItem label="Units" value={formatNumber(investment.units)} />
            <DetailItem label={isStock ? "Current Price" : "NAV / Price"} value={formatCurrency(investment.nav_price)} />
            {isStock ? <DetailItem label="Average Purchase Price" value={formatCurrency(averagePurchasePrice)} /> : null}
            <DetailItem label="Purchase date" value={formatDate(investment.purchase_date)} />
            <DetailItem label="Updated" value={formatDate(investment.updated_at)} />
            <DetailItem label="Sector" value={investment.sector ?? "—"} />
            <DetailItem label={isStock ? "Exchange" : "AMC / Issuer"} value={isStock ? investment.exchange ?? "—" : investment.amc ?? "—"} />
          </DetailGrid>
        </DetailSection>

        {isStock ? (
          <DetailSection title="Stock Metadata">
            <DetailGrid>
              <DetailItem label="Owner" value={investment.owner ?? "—"} />
                <DetailItem label="Broker" value={investment.broker ?? "—"} />
                <DetailItem label="ISIN" value={investment.isin ?? "—"} />
            </DetailGrid>
          </DetailSection>
        ) : (
          <DetailSection title="Family Office">
            <DetailGrid>
              <DetailItem label="Owner" value={investment.owner ?? "—"} />
              <DetailItem label="Nominee" value={investment.nominee ?? "—"} />
              <DetailItem label="Folio number" value={investment.folio_number ?? "—"} />
              <DetailItem label="AMFI scheme code" value={investment.amfi_scheme_code ?? "—"} />
              <DetailItem label="Investment mode" value={investment.investment_mode ?? "—"} />
              <DetailItem label="Option type" value={investment.option_type ?? "—"} />
              <DetailItem label="Broker platform" value={investment.broker_platform ?? "—"} />
              <DetailItem label="SIP amount" value={formatCurrency(investment.sip_amount)} />
              <DetailItem label="SIP date" value={investment.sip_date ? `${investment.sip_date}` : "—"} />
            </DetailGrid>
          </DetailSection>
        )}

        <DetailSection title="Notes">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{investment.notes || "No notes provided."}</div>
        </DetailSection>
      </div>
    </DetailDialog>
  );
}