import { CalendarDays, Sparkles } from "lucide-react";

import { FinancialHealth } from "@/components/dashboard/FinancialHealth";
import type { ExecutiveDashboardData } from "@/services/dashboard";

interface DashboardHeaderProps {
  dateLabel: string;
  insight: string;
  health: {
    score: number;
    rating: "Excellent" | "Good" | "Needs Attention";
    detail: string;
    components: ExecutiveDashboardData["financialHealth"]["components"];
  };
}

export function DashboardHeader({ dateLabel, insight, health }: DashboardHeaderProps) {
  return (
    <header className="rounded-3xl bg-[linear-gradient(135deg,#fbfdff_0%,#f4f8ff_52%,#eef6f5_100%)] p-4 shadow-[0_30px_68px_-50px_rgba(15,23,42,0.38)] ring-1 ring-slate-900/5 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Project North Star</p>
          <h1 className="mt-1.5 text-[1.65rem] font-semibold tracking-[-0.02em] text-slate-900 sm:text-[1.8rem]">Executive Dashboard</h1>
          <div className="mt-2 flex items-center gap-2 text-slate-700">
            <CalendarDays className="h-4 w-4" />
            <p className="text-sm font-medium">{dateLabel}</p>
          </div>
        </div>

        <FinancialHealth score={health.score} rating={health.rating} detail={health.detail} components={health.components} />
      </div>

      <div className="mt-4 rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-slate-900/5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Daily Financial Insight</p>
        <p className="mt-1.5 flex items-start gap-2 text-sm leading-6 text-slate-700">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <span className="max-w-[86ch]">{insight}</span>
        </p>
      </div>
    </header>
  );
}
