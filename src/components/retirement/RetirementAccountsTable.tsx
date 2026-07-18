"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RetirementAccount } from "@/types/retirementAccount";

interface RetirementAccountsTableProps {
  accounts: RetirementAccount[];
  onView: (account: RetirementAccount) => void;
  onEdit: (account: RetirementAccount) => void;
  onDelete: (account: RetirementAccount) => void;
  onAddSnapshot: (account: RetirementAccount) => void;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

export function RetirementAccountsTable({ accounts, onView, onEdit, onDelete, onAddSnapshot }: RetirementAccountsTableProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
        No retirement accounts match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Type",
                "Institution",
                "Holder",
                "Account Number",
                "Current Value",
                "Monthly Contribution",
                "Interest Rate",
                "Actions",
              ].map((label) => (
                <th key={label} className="px-4 py-3 text-left font-medium text-slate-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">{account.account_type}</span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{account.institution}</td>
                <td className="px-4 py-3 text-slate-700">{account.holder_name}</td>
                <td className="px-4 py-3 text-slate-600">{account.account_number}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(account.current_value)}</td>
                <td className="px-4 py-3 text-slate-700">{formatMoney(account.monthly_contribution)}</td>
                <td className="px-4 py-3 text-slate-700">{account.interest_rate.toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onView(account)}>
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit(account)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onAddSnapshot(account)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Snapshot
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onDelete(account)}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
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