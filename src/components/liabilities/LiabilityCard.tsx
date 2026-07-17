import { DollarSign, Landmark, ReceiptText } from "lucide-react";

import { LiabilityTypeBadge } from "@/components/liabilities/LiabilityTypeBadge";
import type { Liability } from "@/types/liability";

interface LiabilityCardProps {
  liability: Liability;
}

export function LiabilityCard({ liability }: LiabilityCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{liability.account_name}</p>
          <p className="mt-1 text-sm text-slate-600">{liability.lender}</p>
        </div>
        <LiabilityTypeBadge type={liability.liability_type} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <DollarSign className="h-4 w-4" /> Outstanding
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900">${liability.outstanding_amount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <ReceiptText className="h-4 w-4" /> EMI
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900">{liability.emi ? `$${liability.emi.toLocaleString()}` : "—"}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Landmark className="h-4 w-4" /> Rate
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900">{liability.interest_rate ? `${liability.interest_rate}%` : "—"}</p>
        </div>
      </div>
    </div>
  );
}
