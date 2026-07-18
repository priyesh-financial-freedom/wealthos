import { Eye, Pencil, Trash2 } from "lucide-react";

import { BankAccountTypeBadge } from "@/components/bankAccounts/BankAccountTypeBadge";
import { Button } from "@/components/ui/button";
import type { BankAccount } from "@/types/bankAccount";

interface BankAccountTableProps {
  accounts: BankAccount[];
  onView: (account: BankAccount) => void;
  onEdit: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Number(value ?? 0).toLocaleString()}`;
  }
}

export function BankAccountTable({ accounts, onView, onEdit, onDelete }: BankAccountTableProps) {
  if (accounts.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No bank accounts found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Bank accounts inventory</h3>
          <p className="text-sm text-slate-600">Manage balances, ownership, and account profile details</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Eye className="h-4 w-4" />
          Click row for details
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Bank</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Account Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Masked Number</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Current Balance</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Owner</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {accounts.map((account) => (
              <tr key={account.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onView(account)}>
                <td className="px-4 py-3 text-slate-700">{account.bank}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{account.account_name}</td>
                <td className="px-4 py-3"><BankAccountTypeBadge type={account.account_type} /></td>
                <td className="px-4 py-3 text-slate-700">{account.masked_account_number}</td>
                <td className="px-4 py-3 text-slate-900">{formatCurrency(account.current_balance, account.currency)}</td>
                <td className="px-4 py-3 text-slate-700">{account.owner || "—"}</td>
                <td className="px-4 py-3 text-slate-700 capitalize">{account.status}</td>
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
