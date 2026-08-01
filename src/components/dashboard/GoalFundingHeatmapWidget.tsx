import { Target } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetHeader } from "@/components/dashboard/WidgetPrimitives";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ExecutiveDashboardData } from "@/services/dashboard";

interface GoalFundingHeatmapWidgetProps {
  goals: ExecutiveDashboardData["goals"];
}

function statusTone(status: "Funded" | "On Track" | "Watch" | "At Risk"): string {
  if (status === "Funded" || status === "On Track") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Watch") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-rose-100 text-rose-700";
}

function progressTone(status: "Funded" | "On Track" | "Watch" | "At Risk"): string {
  if (status === "Funded" || status === "On Track") {
    return "bg-emerald-500";
  }

  if (status === "Watch") {
    return "bg-amber-500";
  }

  return "bg-rose-500";
}

export function GoalFundingHeatmapWidget({ goals }: GoalFundingHeatmapWidgetProps) {
  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Goals" title="Goal funding heatmap" icon={Target} iconTone="amber" />

      {goals.heatmap.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">Data required</div>
      ) : (
        <div className="mt-6 space-y-3">
          {goals.heatmap.slice(0, 8).map((goal) => (
            <article key={goal.id} className="rounded-2xl bg-slate-50 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{goal.name}</p>
                  <p className="text-xs text-slate-600">Target: {formatDate(goal.targetDate)}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(goal.status)}`}>{goal.status}</span>
              </div>

              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${progressTone(goal.status)}`}
                  style={{ width: `${Math.max(0, Math.min(100, Number(goal.fundingPercent ?? 0)))}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <span>{goal.fundingPercent === null ? "Data required" : `${goal.fundingPercent}% funded`}</span>
                <span>
                  {goal.gapOrSurplus === null
                    ? "Data required"
                    : goal.gapOrSurplus >= 0
                      ? `Surplus ${formatCurrency(goal.gapOrSurplus, { maximumFractionDigits: 0 })}`
                      : `Gap ${formatCurrency(Math.abs(goal.gapOrSurplus), { maximumFractionDigits: 0 })}`}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
