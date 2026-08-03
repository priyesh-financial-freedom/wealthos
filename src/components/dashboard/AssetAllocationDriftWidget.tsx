import { PieChart } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetHeader } from "@/components/dashboard/WidgetPrimitives";
import type { ExecutiveDashboardData } from "@/components/dashboard/dashboardTypes";

interface AssetAllocationDriftWidgetProps {
  drift: ExecutiveDashboardData["assetAllocationDrift"];
}

export function AssetAllocationDriftWidget({ drift }: AssetAllocationDriftWidgetProps) {
  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Investments" title="Asset allocation drift" icon={PieChart} iconTone="blue" />

      {drift.rows.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">Set assumptions to calculate this metric</div>
      ) : (
        <div className="mt-6 space-y-2">
          {drift.rows.map((row) => (
            <div key={row.assetClass} className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="font-medium text-slate-900">{row.assetClass}</p>
                <p className={row.needsAction ? "font-semibold text-amber-700" : "font-semibold text-slate-700"}>
                  Drift {row.driftPercent === null ? "Data required" : `${row.driftPercent > 0 ? "+" : ""}${row.driftPercent.toFixed(1)}%`}
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Current {row.currentPercent === null ? "Data required" : `${row.currentPercent.toFixed(1)}%`} ·
                Target {row.targetPercent === null ? " Data required" : ` ${row.targetPercent.toFixed(1)}%`}
              </p>
            </div>
          ))}
        </div>
      )}

      {drift.message ? <p className="mt-4 text-sm text-slate-600">{drift.message}</p> : null}
    </DashboardCard>
  );
}
