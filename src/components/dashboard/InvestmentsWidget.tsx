import { BarChart3 } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { formatCurrency, formatPercent } from "@/lib/formatters";

interface InvestmentsWidgetProps {
  available: boolean;
  currentPortfolio: number;
  monthlyInvestment: number;
  projectedValue: number;
  expectedCagr: number;
}

export function InvestmentsWidget({ available, currentPortfolio, monthlyInvestment, projectedValue, expectedCagr }: InvestmentsWidgetProps) {
  return (
    <DashboardCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Investments</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Portfolio Snapshot</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>

      {!available ? (
        <ComingSoon />
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Metric label="Current Portfolio" value={formatCurrency(currentPortfolio, { maximumFractionDigits: 0 })} />
          <Metric label="Monthly Investment" value={formatCurrency(monthlyInvestment, { maximumFractionDigits: 0 })} />
          <Metric label="Projected Value" value={formatCurrency(projectedValue, { maximumFractionDigits: 0 })} />
          <Metric label="Expected CAGR" value={formatPercent(expectedCagr, { multiply: false })} />
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
