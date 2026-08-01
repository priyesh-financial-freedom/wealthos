import { PiggyBank } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetHeader, WidgetMetric, WidgetMetricGrid } from "@/components/dashboard/WidgetPrimitives";
import { formatCurrency } from "@/lib/formatters";
import type { ExecutiveDashboardData } from "@/services/dashboard";

interface RetirementHeroWidgetProps {
  retirement: ExecutiveDashboardData["retirement"];
}

function toneForStatus(status: ExecutiveDashboardData["retirement"]["status"]): "positive" | "warning" | "default" {
  if (status === "On Track") {
    return "positive";
  }

  if (status === "At Risk") {
    return "warning";
  }

  return "default";
}

function formatVariance(value: number | null): string {
  if (value === null) {
    return "Data required";
  }

  if (value === 0) {
    return formatCurrency(0, { maximumFractionDigits: 0 });
  }

  const sign = value > 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(value), { maximumFractionDigits: 0 })}`;
}

export function RetirementHeroWidget({ retirement }: RetirementHeroWidgetProps) {
  if (!retirement.available) {
    return (
      <DashboardCard>
        <WidgetHeader eyebrow="Retirement" title="Retirement readiness" icon={PiggyBank} iconTone="emerald" />
        <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">Data required</div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Retirement" title="Retirement readiness" icon={PiggyBank} iconTone="emerald" />

      <WidgetMetricGrid className="mt-5 lg:grid-cols-3">
        <WidgetMetric
          label="Readiness"
          value={retirement.readinessPercent === null ? "Data required" : `${Math.round(retirement.readinessPercent)}%`}
          tone={toneForStatus(retirement.status)}
        />
        <WidgetMetric
          label="Current corpus"
          value={retirement.totalRetirementAssets === null ? "Data required" : formatCurrency(retirement.totalRetirementAssets, { maximumFractionDigits: 0 })}
        />
        <WidgetMetric
          label="Required corpus"
          value={retirement.requiredCorpus === null ? "Set assumptions" : formatCurrency(retirement.requiredCorpus, { maximumFractionDigits: 0 })}
        />
        <WidgetMetric label="Gap / surplus" value={formatVariance(retirement.gapOrSurplus)} tone={toneForStatus(retirement.status)} />
        <WidgetMetric label="Retirement date" value={retirement.retirementDate ?? "Data required"} />
        <WidgetMetric label="Projection end" value={retirement.projectionEndDate ?? "Data required"} />
      </WidgetMetricGrid>

      <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Corpus survival status</p>
          <span className={[
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
            retirement.status === "On Track"
              ? "bg-emerald-100 text-emerald-700"
              : retirement.status === "At Risk"
                ? "bg-rose-100 text-rose-700"
                : "bg-amber-100 text-amber-700",
          ].join(" ")}
          >
            {retirement.status}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-slate-600">{retirement.corpusSurvivalStatus}</p>
      </div>
    </DashboardCard>
  );
}
