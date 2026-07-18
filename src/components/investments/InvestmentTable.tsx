"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InvestmentCategoryBadge } from "@/components/investments/InvestmentCategoryBadge";
import type { Investment } from "@/types/investment";

interface InvestmentTableProps {
  investments: Investment[];
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

export function InvestmentTable({ investments, onView, onEdit, onDelete }: InvestmentTableProps) {
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
              <th className="px-4 py-3 text-left font-medium text-slate-600">Units</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">NAV / Price</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Current Value</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Cost</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Gain/Loss</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">CAGR</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">XIRR</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {investments.map((investment) => (
              <tr key={investment.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onView(investment)}>
                <td className="px-4 py-3 font-medium text-slate-900">{investment.investment_name}</td>
                <td className="px-4 py-3"><InvestmentCategoryBadge category={investment.category} /></td>
                <td className="px-4 py-3 text-slate-600">{investment.units.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-900">${investment.nav_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-900">${investment.current_value.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-900">${investment.cost_basis.toLocaleString()}</td>
                <td className={`px-4 py-3 font-medium ${investment.gain_loss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  ${investment.gain_loss.toLocaleString()}
                </td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}