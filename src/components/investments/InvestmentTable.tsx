"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InvestmentCategoryBadge } from "@/components/investments/InvestmentCategoryBadge";
import type { Investment } from "@/types/investment";

interface InvestmentTableProps {
  investments: Investment[];
  totalPortfolioValue: number;
  onView: (investment: Investment) => void;
  onEdit: (investment: Investment) => void;
  onDelete: (investment: Investment) => void;
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function getGainPercent(investment: Investment) {
  if (!Number.isFinite(investment.cost_basis) || investment.cost_basis <= 0) {
    return null;
  }

  return investment.gain_loss / investment.cost_basis;
}

function getPortfolioWeight(investment: Investment, totalPortfolioValue: number) {
  if (!Number.isFinite(totalPortfolioValue) || totalPortfolioValue <= 0) {
    return null;
  }

  return investment.current_value / totalPortfolioValue;
}

export function InvestmentTable({ investments, totalPortfolioValue, onView, onEdit, onDelete }: InvestmentTableProps) {
  if (investments.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">No investments found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Investment holdings</h3>
          <p className="text-sm text-slate-600">Search, sort, and manage portfolio positions</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Eye className="h-4 w-4" />
          Click a row for details
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Category</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Owner</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Folio</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Mode</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Units</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">NAV / Price</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Current Value</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Cost</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Gain/Loss</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Gain %</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Portfolio Weight</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">CAGR</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">XIRR</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {investments.map((investment) => {
              const gainPercent = getGainPercent(investment);
              const portfolioWeight = getPortfolioWeight(investment, totalPortfolioValue);

              return (
                <tr key={investment.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onView(investment)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{investment.investment_name}</td>
                  <td className="px-4 py-3"><InvestmentCategoryBadge category={investment.category} /></td>
                  <td className="px-4 py-3 text-slate-600">{investment.owner ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{investment.folio_number ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{investment.investment_mode ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{investment.units.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-900">₹{investment.nav_price.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-slate-900">₹{investment.current_value.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-slate-900">₹{investment.cost_basis.toLocaleString("en-IN")}</td>
                  <td className={`px-4 py-3 font-medium ${investment.gain_loss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    ₹{investment.gain_loss.toLocaleString("en-IN")}
                  </td>
                  <td className={`px-4 py-3 font-medium ${investment.gain_loss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatPercent(gainPercent)}</td>
                  <td className="px-4 py-3 text-slate-900">{formatPercent(portfolioWeight)}</td>
                  <td className="px-4 py-3 text-slate-900">{formatPercent(investment.cagr)}</td>
                  <td className="px-4 py-3 text-slate-900">{formatPercent(investment.xirr)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                      <Button type="button" variant="ghost" size="icon" onClick={() => onView(investment)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(investment)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(investment)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}