import { Sparkles } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetHeader } from "@/components/dashboard/WidgetPrimitives";
import type { ExecutiveDashboardData } from "@/services/dashboard";

interface RecommendedActionsWidgetProps {
  actions: ExecutiveDashboardData["recommendedActions"];
}

function priorityTone(priority: "High" | "Medium" | "Low"): string {
  if (priority === "High") {
    return "bg-rose-100 text-rose-700";
  }

  if (priority === "Medium") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

export function RecommendedActionsWidget({ actions }: RecommendedActionsWidgetProps) {
  return (
    <DashboardCard>
      <WidgetHeader eyebrow="AI as advisor" title="Recommended actions" icon={Sparkles} iconTone="cyan" />

      {actions.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">Data required</div>
      ) : (
        <div className="mt-6 space-y-3">
          {actions.slice(0, 5).map((action) => (
            <article key={action.id} className="rounded-2xl bg-slate-50 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityTone(action.priority)}`}>
                  {action.priority}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{action.reason}</p>
              <p className="mt-1.5 text-xs font-medium text-slate-700">Next: {action.nextStep}</p>
            </article>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
