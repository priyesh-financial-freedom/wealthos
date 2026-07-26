"use client";

import { InvestmentDetailHeader } from "@/components/investments/InvestmentDetailHeader";
import { parseInvestmentDocuments } from "@/components/investments/documents";
import { DetailDialog, DetailGrid, DetailItem, DetailSection } from "@/components/ui/detail-dialog";
import { formatDate } from "@/lib/formatters";
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

  const portfolioWeight = totalPortfolioValue > 0 ? (investment.current_value / totalPortfolioValue) * 100 : 0;
  const documents = parseInvestmentDocuments(investment.documents_placeholder);

  return (
    <DetailDialog open={open} onOpenChange={onOpenChange} title={investment.investment_name} description="Investment overview and month-end tracking context.">
      <div className="space-y-6">
        <InvestmentDetailHeader investment={investment} />

        <DetailSection title="Core Fields">
          <DetailGrid>
            <DetailItem label="Owner" value={investment.owner ?? "-"} />
            <DetailItem label="Institution" value={investment.institution ?? "-"} />
            <DetailItem label="Investment Type" value={investment.investment_type} />
            <DetailItem label="Status" value={investment.status} />
            <DetailItem label="Acquisition Date" value={formatDate(investment.acquisition_date ?? investment.purchase_date)} />
            <DetailItem label="Portfolio Weight" value={`${portfolioWeight.toFixed(1)}%`} />
            <DetailItem label="Updated" value={formatDate(investment.updated_at)} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Notes">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{investment.notes || "No notes provided."}</div>
        </DetailSection>

        <DetailSection title="Documents">
          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No documents attached.</div>
          ) : (
            <ul className="space-y-2">
              {documents.map((item, index) => (
                <li key={`${item.type}-${item.fileName ?? "no-file"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{item.type}</p>
                  <p>{item.fileName ?? "File not attached"}</p>
                  <p className="text-xs text-slate-500">Uploaded: {item.uploadDate ?? "N/A"}</p>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>
      </div>
    </DetailDialog>
  );
}