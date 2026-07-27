"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import type { Loan } from "@/services/loanManagement";

interface LoanDetailsDialogProps {
  loan: Loan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function LoanDetailsDialog({ loan, open, onOpenChange }: LoanDetailsDialogProps) {
  if (!loan) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{loan.name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Row label="Loan Type" value={loan.loanType} />
          <Row label="Status" value={loan.status} />
          <Row label="Lender" value={loan.lender} />
          <Row label="Outstanding Amount" value={formatCurrency(loan.outstandingAmount, { maximumFractionDigits: 0 })} />
          <Row label="Interest Rate" value={formatPercent(loan.interestRate, { digits: 2, multiply: false })} />
          <Row label="EMI" value={formatCurrency(loan.emi, { maximumFractionDigits: 0 })} />
          <Row label="Tenure (months)" value={String(loan.tenureMonths)} />
          <Row label="Remaining Months" value={String(loan.remainingMonths)} />
          <Row label="Start Date" value={formatDate(loan.startDate)} />
          <Row label="End Date" value={formatDate(loan.endDate)} />
          <Row label="Prepayment Amount" value={formatCurrency(loan.prepaymentAmount, { maximumFractionDigits: 0 })} />
          <Row label="Prepayment Frequency" value={loan.prepaymentFrequency} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{loan.notes || "No notes provided."}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
