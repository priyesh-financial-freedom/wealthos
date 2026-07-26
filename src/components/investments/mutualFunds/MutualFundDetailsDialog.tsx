"use client";

import { DetailDialog, DetailGrid, DetailItem, DetailSection } from "@/components/ui/detail-dialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Investment, InvestmentMonthlyHistory } from "@/types/investment";

interface MutualFundDetailsDialogProps {
  fund: Investment | null;
  historyRows: InvestmentMonthlyHistory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function monthLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(parsed);
}

function parseDocuments(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const decoded = JSON.parse(value) as unknown;
    if (Array.isArray(decoded)) {
      return decoded
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const entry = item as Record<string, unknown>;
          return {
            type: String(entry.type ?? "Other"),
            fileName: entry.fileName ? String(entry.fileName) : null,
            uploadDate: entry.uploadDate ? String(entry.uploadDate) : null,
          };
        })
        .filter((item): item is { type: string; fileName: string | null; uploadDate: string | null } => Boolean(item));
    }
  } catch {
    // Fallback handles old comma-separated format.
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function MutualFundDetailsDialog({ fund, historyRows, open, onOpenChange }: MutualFundDetailsDialogProps) {
  if (!fund) {
    return null;
  }

  const gainLoss = Number(fund.current_value ?? 0) - Number(fund.cost_value ?? fund.cost_basis ?? 0);
  const gainPercent = Number(fund.cost_value ?? fund.cost_basis ?? 0) > 0
    ? (gainLoss / Number(fund.cost_value ?? fund.cost_basis ?? 0)) * 100
    : null;
  const documents = parseDocuments(fund.documents_placeholder);

  return (
    <DetailDialog open={open} onOpenChange={onOpenChange} title={fund.investment_name} description="Mutual Fund overview and value history.">
      <div className="space-y-6">
        <DetailSection title="Overview">
          <DetailGrid>
            <DetailItem label="Scheme" value={fund.investment_name} />
            <DetailItem label="AMC" value={fund.amc ?? fund.institution ?? "-"} />
            <DetailItem label="Folio" value={fund.folio_number ?? "-"} />
            <DetailItem label="Owner" value={fund.owner ?? "-"} />
            <DetailItem label="Status" value={fund.status} />
            <DetailItem label="Updated" value={formatDate(fund.updated_at)} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Financial Summary">
          <DetailGrid>
            <DetailItem label="Cost Value" value={formatCurrency(fund.cost_value ?? fund.cost_basis, { maximumFractionDigits: 0 })} />
            <DetailItem label="Current Value" value={formatCurrency(fund.current_value, { maximumFractionDigits: 0 })} />
            <DetailItem label="Unrealized Gain / Loss" value={formatCurrency(gainLoss, { maximumFractionDigits: 0 })} />
            <DetailItem label="Gain %" value={gainPercent === null ? "-" : `${gainPercent.toFixed(2)}%`} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Value History">
          {historyRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No Value History yet. Add your first month-end value.</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Month</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {historyRows
                    .slice()
                    .sort((left, right) => new Date(left.month_end_date).getTime() - new Date(right.month_end_date).getTime())
                    .map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 text-slate-700">{monthLabel(row.month_end_date)}</td>
                        <td className="px-4 py-3 text-slate-900">{formatCurrency(row.closing_value, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </DetailSection>

        <DetailSection title="Documents">
          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No documents attached.</div>
          ) : (
            <ul className="space-y-2">
              {documents.map((item, index) => (
                typeof item === "string" ? (
                  <li key={`${item}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{item}</li>
                ) : (
                  <li key={`${item.type}-${item.fileName ?? "no-file"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">{item.type}</p>
                    <p>{item.fileName ?? "File not attached"}</p>
                    <p className="text-xs text-slate-500">Uploaded: {item.uploadDate ?? "N/A"}</p>
                  </li>
                )
              ))}
            </ul>
          )}
        </DetailSection>

        <DetailSection title="Notes">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{fund.notes || "No notes provided."}</div>
        </DetailSection>
      </div>
    </DetailDialog>
  );
}
