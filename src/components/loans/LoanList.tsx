"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import type { Loan } from "@/services/loanManagement";

interface LoanListProps {
  loans: Loan[];
  onView: (loan: Loan) => void;
  onEdit: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
}

export function LoanList({ loans, onView, onEdit, onDelete }: LoanListProps) {
  if (loans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <h3 className="text-lg font-semibold text-slate-900">No loans added yet</h3>
        <p className="mt-2 text-sm text-slate-500">Add your first loan to start tracking EMIs, interest rates and prepayments.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Loan</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Outstanding</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">EMI</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Interest</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{loan.name}</p>
                  <p className="text-xs text-slate-500">{loan.loanType} • {loan.lender}</p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(loan.outstandingAmount, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(loan.emi, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{formatPercent(loan.interestRate, { digits: 2, multiply: false })}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{loan.remainingMonths} months</td>
                <td className="px-4 py-3 text-sm text-slate-700">{formatDate(loan.endDate)}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={loan.status === "Active" ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700" : "rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"}>
                    {loan.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onView(loan)} aria-label={`View ${loan.name}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onEdit(loan)} aria-label={`Edit ${loan.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete(loan)} aria-label={`Delete ${loan.name}`}>
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
