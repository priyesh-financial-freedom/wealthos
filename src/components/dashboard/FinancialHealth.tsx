import { Activity, ShieldCheck, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ExecutiveDashboardData } from "@/services/dashboard";

interface FinancialHealthProps {
  score: number | null;
  rating: "Excellent" | "Good" | "Needs Attention";
  detail?: string;
  components?: ExecutiveDashboardData["financialHealth"]["components"];
}

function ratingStyles(rating: FinancialHealthProps["rating"]) {
  if (rating === "Excellent") {
    return {
      badge: "bg-emerald-100 text-emerald-700",
      icon: ShieldCheck,
      iconClass: "text-emerald-600",
    };
  }

  if (rating === "Good") {
    return {
      badge: "bg-blue-100 text-blue-700",
      icon: Activity,
      iconClass: "text-blue-600",
    };
  }

  return {
    badge: "bg-amber-100 text-amber-800",
    icon: ShieldAlert,
    iconClass: "text-amber-700",
  };
}

function componentToneClass(status: "green" | "amber" | "red") {
  if (status === "green") {
    return "bg-emerald-500";
  }

  if (status === "amber") {
    return "bg-amber-500";
  }

  return "bg-rose-500";
}

export function FinancialHealth({ score, rating, detail, components = [] }: FinancialHealthProps) {
  const style = ratingStyles(rating);
  const Icon = style.icon;

  return (
    <div className="flex max-w-full items-start gap-3 rounded-2xl bg-white/90 px-3.5 py-3 ring-1 ring-slate-900/5 sm:min-w-[320px]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm shadow-slate-200/70">
        <Icon className={cn("h-4.5 w-4.5", style.iconClass)} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Financial Health Score</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <p className="text-3xl font-semibold leading-none text-slate-900 tabular-nums">{score === null ? "Coming Soon" : score}</p>
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", style.badge)}>{rating}</span>
        </div>
        {detail ? <p className="mt-1 text-xs leading-5 text-slate-600 line-clamp-2">{detail}</p> : null}
      </div>

      {components.length > 0 ? (
        <div className="mt-3 w-full shrink-0 space-y-1.5 rounded-xl bg-slate-50 p-2.5 lg:ml-auto lg:mt-0 lg:min-w-[330px] lg:max-w-[360px]">
          {components.map((component) => (
            <div key={component.key} className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-slate-900/5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn("inline-block h-2.5 w-2.5 rounded-full", componentToneClass(component.status))} />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">{component.label}</p>
                </div>
                <p className="text-xs font-semibold text-slate-900 tabular-nums">
                  {component.score === null ? "Data required" : `${component.score} / ${component.maxScore}`}
                </p>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-600">{component.reason}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
