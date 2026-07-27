import { AlertTriangle, CircleCheck } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetHeader, WidgetMetric, WidgetMetricGrid } from "@/components/dashboard/WidgetPrimitives";

interface FocusWidgetProps {
  goalsAtRisk: number;
  goalsOnTrack: number;
  monthlySavings: number;
  hasLiabilities: boolean;
}

export function FocusWidget({ goalsAtRisk, goalsOnTrack, monthlySavings, hasLiabilities }: FocusWidgetProps) {
  const focusItems: string[] = [];

  if (monthlySavings < 0) {
    focusItems.push("Monthly savings is negative. Review cash outflows.");
  }

  if (goalsAtRisk > 0) {
    focusItems.push(`${goalsAtRisk} goal(s) are marked at risk.`);
  }

  if (hasLiabilities) {
    focusItems.push("Track EMI obligations and repayment consistency.");
  }

  if (focusItems.length === 0) {
    focusItems.push("All tracked indicators are stable today.");
  }

  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Where should I focus" title="Priority areas" icon={AlertTriangle} iconTone="amber" />

      <div className="mt-6 space-y-3">
        {focusItems.map((item) => (
          <div key={item} className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3.5">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p className="text-sm leading-6 text-slate-700">{item}</p>
          </div>
        ))}
      </div>

      <WidgetMetricGrid>
        <WidgetMetric label="Goals On Track" value={String(goalsOnTrack)} />
        <WidgetMetric label="Goals At Risk" value={String(goalsAtRisk)} tone={goalsAtRisk > 0 ? "warning" : "default"} />
      </WidgetMetricGrid>
    </DashboardCard>
  );
}
