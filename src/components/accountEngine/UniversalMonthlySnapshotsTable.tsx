import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UniversalAccount, UniversalAccountMonthlySnapshot } from "@/types/universalAccount";

interface UniversalMonthlySnapshotsTableProps {
  snapshots: UniversalAccountMonthlySnapshot[];
  accounts: UniversalAccount[];
  onEdit: (snapshot: UniversalAccountMonthlySnapshot) => void;
  onDelete: (snapshot: UniversalAccountMonthlySnapshot) => void;
}

function accountLabel(accounts: UniversalAccount[], id: string) {
  const account = accounts.find((item) => item.id === id);
  return account ? `${account.name} • ${account.account_type}` : "Unknown account";
}

function monthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function UniversalMonthlySnapshotsTable({ snapshots, accounts, onEdit, onDelete }: UniversalMonthlySnapshotsTableProps) {
  if (snapshots.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No monthly snapshots found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Month</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Account</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Opening</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Contribution</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Withdrawal</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Closing</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Growth</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Cash Flow</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Interest</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Dividend</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Gain/Loss</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{monthLabel(snapshot.snapshot_month, snapshot.snapshot_year)}</td>
                <td className="px-4 py-3 text-slate-700">{accountLabel(accounts, snapshot.universal_account_id)}</td>
                <td className="px-4 py-3 text-slate-700">${snapshot.opening_value.toLocaleString()}</td>
                <td className="px-4 py-3 text-emerald-700">${snapshot.contribution.toLocaleString()}</td>
                <td className="px-4 py-3 text-rose-700">${snapshot.withdrawal.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-900">${snapshot.closing_value.toLocaleString()}</td>
                <td className={`px-4 py-3 font-medium ${snapshot.monthly_growth >= 0 ? "text-emerald-700" : "text-rose-700"}`}>${snapshot.monthly_growth.toLocaleString()}</td>
                <td className={`px-4 py-3 font-medium ${snapshot.cash_flow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>${snapshot.cash_flow.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-700">${snapshot.interest.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-700">${snapshot.dividend.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-700">${snapshot.gain_loss.toLocaleString()}</td>
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
