import { ArrowUpRight, WalletCards } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { formatCurrency } from "@/lib/formatters";

interface NetWorthWidgetProps {
  netWorth: number;
  assets: number;
  liabilities: number;
  monthlySavings: number;
}

export function NetWorthWidget({ netWorth, assets, liabilities, monthlySavings }: NetWorthWidgetProps) {
  return (
    <DashboardCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Where Am I Today</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Current Position</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <WalletCards className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">{formatCurrency(netWorth, { maximumFractionDigits: 0 })}</p>
      <p className="mt-1 text-sm text-slate-600">Net worth</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <MetricRow label="Total Assets" value={formatCurrency(assets, { maximumFractionDigits: 0 })} />
        <MetricRow label="Total Liabilities" value={formatCurrency(liabilities, { maximumFractionDigits: 0 })} />
        <MetricRow
          label="Monthly Savings"
          value={formatCurrency(monthlySavings, { maximumFractionDigits: 0 })}
          tone={monthlySavings >= 0 ? "positive" : "warning"}
        />
        <MetricRow
          label="Direction"
          value={monthlySavings >= 0 ? "Positive" : "Needs Attention"}
          tone={monthlySavings >= 0 ? "positive" : "warning"}
          icon
        />
      </div>
    </DashboardCard>
  );
}

function MetricRow({
  label,
  value,
  tone = "default",
  icon = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warning";
  icon?: boolean;
}) {
  const toneClass = tone === "positive" ? "text-emerald-700" : tone === "warning" ? "text-amber-800" : "text-slate-900";

  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-2 flex items-center gap-1 text-sm font-semibold ${toneClass}`}>
        {value}
        {icon ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
      </p>
    </div>
  );
}
