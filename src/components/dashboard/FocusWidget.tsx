import { AlertTriangle, CircleCheck } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";

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
    <DashboardCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Where Should I Focus</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Priority Areas</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {focusItems.map((item) => (
          <div key={item} className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-3">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p className="text-sm text-slate-700">{item}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Goals On Track" value={String(goalsOnTrack)} />
        <Stat label="Goals At Risk" value={String(goalsAtRisk)} tone={goalsAtRisk > 0 ? "warning" : "default"} />
      </div>
    </DashboardCard>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  const toneClass = tone === "warning" ? "text-amber-800" : "text-slate-900";

  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
