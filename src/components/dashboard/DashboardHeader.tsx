import { CalendarDays, Sparkles } from "lucide-react";

import { FinancialHealth } from "@/components/dashboard/FinancialHealth";

interface DashboardHeaderProps {
  dateLabel: string;
  insight: string;
  health: {
    score: number;
    rating: "Excellent" | "Good" | "Needs Attention";
    detail: string;
  };
}

export function DashboardHeader({ dateLabel, insight, health }: DashboardHeaderProps) {
  return (
    <header className="rounded-3xl bg-[linear-gradient(135deg,#f8fbff_0%,#eff5ff_48%,#e8f4f3_100%)] p-8 shadow-[0_32px_70px_-42px_rgba(15,23,42,0.45)]">
      <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Project North Star</p>
          <div className="mt-3 flex items-center gap-2 text-slate-700">
            <CalendarDays className="h-4 w-4" />
            <p className="text-sm font-medium">{dateLabel}</p>
          </div>
        </div>

        <FinancialHealth score={health.score} rating={health.rating} detail={health.detail} />
      </div>

      <div className="mt-7 rounded-2xl bg-white/80 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Daily Financial Insight</p>
        <p className="mt-2 flex items-start gap-2 text-sm text-slate-700">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <span>{insight}</span>
        </p>
      </div>
    </header>
  );
}
