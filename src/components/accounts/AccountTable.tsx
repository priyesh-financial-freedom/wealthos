import { Eye, Pencil, Trash2 } from "lucide-react";

import { AccountCategoryBadge } from "@/components/accounts/AccountCategoryBadge";
import { Button } from "@/components/ui/button";
import type { Account } from "@/types/account";

interface AccountTableProps {
  accounts: Account[];
  onView: (account: Account) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}

function formatCurrency(value: number) {
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

export function AccountTable({ accounts, onView, onEdit, onDelete }: AccountTableProps) {
  if (accounts.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No accounts found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Accounts catalog</h3>
          <p className="text-sm text-slate-600">Master view across banking, investments, debt, and insurance</p>
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
              <th className="px-4 py-3 text-left font-medium text-slate-600">Institution</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Owner</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Current Value</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Linked Item</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {accounts.map((account) => (
              <tr key={account.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onView(account)}>
                <td className="px-4 py-3 font-medium text-slate-900">{account.name}</td>
                <td className="px-4 py-3"><AccountCategoryBadge category={account.category} /></td>
                <td className="px-4 py-3 text-slate-600">{account.institution || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{account.owner || "—"}</td>
                <td className="px-4 py-3 text-slate-900">{formatCurrency(Number(account.current_value ?? 0))}</td>
                <td className="px-4 py-3 text-slate-700 capitalize">{account.status.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-slate-600">{account.linked_item_type && account.linked_item_id ? `${account.linked_item_type} • ${account.linked_item_id.slice(0, 8)}...` : "—"}</td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
