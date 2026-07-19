import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UniversalAccount, UniversalAccountMetrics } from "@/types/universalAccount";

interface UniversalAccountsTableProps {
  accounts: UniversalAccount[];
  metricsByAccountId: Record<string, UniversalAccountMetrics>;
  onView: (account: UniversalAccount) => void;
  onEdit: (account: UniversalAccount) => void;
  onDelete: (account: UniversalAccount) => void;
}

function formatMoney(value: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₹${Number(value ?? 0).toLocaleString("en-IN")}`;
  }
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

export function UniversalAccountsTable({ accounts, metricsByAccountId, onView, onEdit, onDelete }: UniversalAccountsTableProps) {
  if (accounts.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No universal accounts found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Institution</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Current Value</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Monthly Growth</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">CAGR</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">XIRR</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Portfolio Weight</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {accounts.map((account) => {
              const metrics = metricsByAccountId[account.id];

              return (
                <tr key={account.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onView(account)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{account.name}</td>
                  <td className="px-4 py-3 text-slate-700">{account.institution || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{account.account_type}</td>
                  <td className="px-4 py-3 text-slate-900">{formatMoney(account.current_value)}</td>
                  <td className={`px-4 py-3 font-medium ${metrics.monthlyGrowth >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatMoney(metrics.monthlyGrowth)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatPercent(metrics.cagr)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatPercent(metrics.xirr)}</td>
                  <td className="px-4 py-3 text-slate-700">{(metrics.portfolioWeight * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                      <Button type="button" variant="ghost" size="icon" onClick={() => onView(account)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(account)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(account)}>
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
