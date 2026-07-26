import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { InvestmentMonthlyHistory } from "@/types/investment";

interface InvestmentMonthlyHistoryProps {
  rows: InvestmentMonthlyHistory[];
  onEdit: (row: InvestmentMonthlyHistory) => void;
  onDelete: (row: InvestmentMonthlyHistory) => void;
}

function monthLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(parsed);
}

export function InvestmentMonthlyHistoryTable({ rows, onEdit, onDelete }: InvestmentMonthlyHistoryProps) {
  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No month-end history yet.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Month End</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Closing Value</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Notes</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{monthLabel(row.month_end_date)}</td>
                <td className="px-4 py-3 text-slate-900">{formatCurrency(row.closing_value, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-slate-600">{row.notes || "-"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(row)}>
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
