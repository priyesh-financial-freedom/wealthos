import { Pencil, Trash2 } from "lucide-react";

import { LiabilityTypeBadge } from "@/components/liabilities/LiabilityTypeBadge";
import { Button } from "@/components/ui/button";
import type { Liability } from "@/types/liability";

interface LiabilityTableProps {
  liabilities: Liability[];
  onEdit: (liability: Liability) => void;
  onDelete: (liability: Liability) => void;
}

export function LiabilityTable({ liabilities, onEdit, onDelete }: LiabilityTableProps) {
  if (liabilities.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No liabilities found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Account</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Lender</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Outstanding</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">EMI</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {liabilities.map((liability) => (
            <tr key={liability.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{liability.account_name}</td>
              <td className="px-4 py-3"><LiabilityTypeBadge type={liability.liability_type} /></td>
              <td className="px-4 py-3 text-slate-600">{liability.lender}</td>
              <td className="px-4 py-3 text-slate-900">${Number(liability.outstanding_amount).toLocaleString()}</td>
              <td className="px-4 py-3 text-slate-900">{liability.emi ? `$${Number(liability.emi).toLocaleString()}` : "—"}</td>
              <td className="px-4 py-3 text-slate-700">{liability.status}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(liability)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(liability)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
