import { ArrowUpRight, WalletCards } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetHeader, WidgetMetric, WidgetMetricGrid } from "@/components/dashboard/WidgetPrimitives";
import { formatCurrency } from "@/lib/formatters";

interface NetWorthWidgetProps {
  netWorth: number;
  plannedNetWorth: number | null;
  netWorthVariance: number | null;
  topContributors: Array<{
    label: string;
    value: number;
    type: "asset" | "liability";
  }>;
  lastMonthlyReview: string | null;
}

function formatVariance(value: number | null) {
  if (value === null) {
    return "Coming Soon";
  }

  if (value === 0) {
    return formatCurrency(0, { maximumFractionDigits: 0 });
  }

  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${formatCurrency(Math.abs(value), { maximumFractionDigits: 0 })}`;
}

export function NetWorthWidget({ netWorth, plannedNetWorth, netWorthVariance, topContributors, lastMonthlyReview }: NetWorthWidgetProps) {
  const varianceTone = netWorthVariance === null ? "default" : netWorthVariance >= 0 ? "positive" : "warning";

  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Where am I today" title="Current position" icon={WalletCards} iconTone="blue" />

      <WidgetMetricGrid>
        <WidgetMetric label="Current net worth" value={formatCurrency(netWorth, { maximumFractionDigits: 0 })} />
        <WidgetMetric
          label="Planned net worth"
          value={plannedNetWorth === null ? "Coming Soon" : formatCurrency(plannedNetWorth, { maximumFractionDigits: 0 })}
        />
        <WidgetMetric
          label="Variance"
          value={formatVariance(netWorthVariance)}
          tone={varianceTone}
          trailing={<ArrowUpRight className="h-3.5 w-3.5" />}
        />
        <WidgetMetric label="Last monthly review" value={lastMonthlyReview ?? "Coming Soon"} />
      </WidgetMetricGrid>

      <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Top contributors</p>
        {topContributors.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Coming Soon</p>
        ) : (
          <div className="mt-2 space-y-2">
            {topContributors.map((item) => (
              <div key={`${item.type}:${item.label}`} className="flex items-center justify-between gap-3 text-sm">
                <p className="text-slate-700">{item.label}</p>
                <p className={`font-semibold tabular-nums ${item.type === "asset" ? "text-emerald-700" : "text-amber-800"}`}>
                  {item.type === "liability" ? "-" : ""}
                  {formatCurrency(item.value, { maximumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
