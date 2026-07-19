import { BadgeIndianRupee, CirclePercent, Landmark, ReceiptText } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { Liability } from "@/types/liability";

interface LiabilitySummaryProps {
  liabilities: Liability[];
  totalAssetBase: number;
}

export function LiabilitySummary({ liabilities, totalAssetBase }: LiabilitySummaryProps) {
  const totalOutstanding = liabilities.reduce((sum, item) => sum + Number(item.outstanding_amount ?? 0), 0);
  const monthlyEmi = liabilities.reduce((sum, item) => sum + Number(item.emi ?? 0), 0);
  const interestRates = liabilities.map((item) => Number(item.interest_rate)).filter((rate) => Number.isFinite(rate) && rate >= 0);
  const averageInterestRate = interestRates.length > 0 ? interestRates.reduce((sum, rate) => sum + rate, 0) / interestRates.length : null;
  const debtToAssetRatio = totalAssetBase > 0 ? totalOutstanding / totalAssetBase : null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <DashboardCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Total Liabilities</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">₹{totalOutstanding.toLocaleString("en-IN")}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <BadgeIndianRupee className="h-5 w-5" />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Monthly EMI</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">₹{monthlyEmi.toLocaleString("en-IN")}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <ReceiptText className="h-5 w-5" />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Average Interest Rate</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{averageInterestRate === null ? "—" : `${averageInterestRate.toFixed(1)}%`}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <CirclePercent className="h-5 w-5" />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Debt-to-Asset Ratio</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{debtToAssetRatio === null ? "—" : `${(debtToAssetRatio * 100).toFixed(1)}%`}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Landmark className="h-5 w-5" />
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
