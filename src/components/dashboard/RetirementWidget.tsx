import { PiggyBank } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { formatCurrency } from "@/lib/formatters";

interface RetirementWidgetProps {
  available: boolean;
  totalRetirementAssets: number;
  accountsCount: number;
}

export function RetirementWidget({ available, totalRetirementAssets, accountsCount }: RetirementWidgetProps) {
  return (
    <DashboardCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Retirement</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Retirement Readiness</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <PiggyBank className="h-5 w-5" />
        </div>
      </div>

      {!available ? (
        <ComingSoon />
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Metric label="Total Retirement Assets" value={formatCurrency(totalRetirementAssets, { maximumFractionDigits: 0 })} />
          <Metric label="Tracked Accounts" value={accountsCount.toLocaleString("en-IN")} />
        </div>
      )}
    </DashboardCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ComingSoon() {
  return <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">Coming Soon</p>;
}
