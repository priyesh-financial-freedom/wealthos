import { DollarSign, ReceiptText, TrendingUp } from "lucide-react";

import type { Liability } from "@/types/liability";

interface LiabilitySummaryProps {
  liabilities: Liability[];
}

export function LiabilitySummary({ liabilities }: LiabilitySummaryProps) {
  const totalLiabilities = liabilities.reduce((sum, item) => sum + Number(item.outstanding_amount), 0);
  const monthlyEmi = liabilities.reduce((sum, item) => sum + Number(item.emi ?? 0), 0);
  const largestLiability = liabilities.reduce<Liability | null>((current, item) => {
    if (!current || Number(item.outstanding_amount) > Number(current.outstanding_amount)) {
      return item;
    }
    return current;
  }, null);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <DollarSign className="h-4 w-4" /> Total Liabilities
        </div>
        <p className="mt-3 text-2xl font-semibold text-slate-900">${totalLiabilities.toLocaleString()}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <ReceiptText className="h-4 w-4" /> Monthly EMI
        </div>
        <p className="mt-3 text-2xl font-semibold text-slate-900">${monthlyEmi.toLocaleString()}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <TrendingUp className="h-4 w-4" /> Largest Liability
        </div>
        <p className="mt-3 text-lg font-semibold text-slate-900">{largestLiability ? largestLiability.account_name : "—"}</p>
        <p className="text-sm text-slate-600">{largestLiability ? `$${largestLiability.outstanding_amount.toLocaleString()}` : "No liabilities yet"}</p>
      </div>
    </div>
  );
}
