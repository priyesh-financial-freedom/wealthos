import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BankAccount, BankAccountMonthlySnapshot } from "@/types/bankAccount";

interface BankAccountMonthlySnapshotsTableProps {
  snapshots: BankAccountMonthlySnapshot[];
  accounts: BankAccount[];
  onEdit: (snapshot: BankAccountMonthlySnapshot) => void;
  onDelete: (snapshot: BankAccountMonthlySnapshot) => void;
}

function accountLabel(accounts: BankAccount[], id: string) {
  const account = accounts.find((item) => item.id === id);
  if (!account) {
    return "Unknown account";
  }

  return `${account.bank} • ${account.account_name}`;
}

function monthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function BankAccountMonthlySnapshotsTable({ snapshots, accounts, onEdit, onDelete }: BankAccountMonthlySnapshotsTableProps) {
  if (snapshots.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No monthly history found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Financial Month</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Bank Account</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Closing Balance</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Notes</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{monthLabel(snapshot.snapshot_month, snapshot.snapshot_year)}</td>
                <td className="px-4 py-3 text-slate-700">{accountLabel(accounts, snapshot.bank_account_id)}</td>
                <td className="px-4 py-3 text-slate-900">₹{snapshot.closing_balance.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-slate-700">{snapshot.notes || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(snapshot)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(snapshot)}>
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
