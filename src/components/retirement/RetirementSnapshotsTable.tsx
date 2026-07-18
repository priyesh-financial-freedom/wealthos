"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MonthlyRetirementSnapshot, RetirementAccount } from "@/types/retirementAccount";

interface RetirementSnapshotsTableProps {
  snapshots: MonthlyRetirementSnapshot[];
  accountsById: Record<string, RetirementAccount>;
  onEdit: (snapshot: MonthlyRetirementSnapshot) => void;
  onDelete: (snapshot: MonthlyRetirementSnapshot) => void;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatMonth(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function RetirementSnapshotsTable({ snapshots, accountsById, onEdit, onDelete }: RetirementSnapshotsTableProps) {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
        No monthly retirement snapshots yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Month", "Account", "Opening", "Contribution", "Interest", "Closing", "Actions"].map((label) => (
                <th key={label} className="px-4 py-3 text-left font-medium text-slate-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snapshots.map((snapshot) => {
              const account = accountsById[snapshot.retirement_account_id];

              return (
                <tr key={snapshot.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">{formatMonth(snapshot.snapshot_month, snapshot.snapshot_year)}</td>
                  <td className="px-4 py-3 text-slate-700">{account ? `${account.account_type} • ${account.institution}` : snapshot.retirement_account_id}</td>
                  <td className="px-4 py-3 text-slate-700">{formatMoney(snapshot.opening_balance)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatMoney(snapshot.contribution)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatMoney(snapshot.interest)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(snapshot.closing_balance)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(snapshot)}>
                        <Pencil className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => onDelete(snapshot)}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
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