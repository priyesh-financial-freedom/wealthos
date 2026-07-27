import { Activity, ShieldCheck, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

interface FinancialHealthProps {
  score: number | null;
  rating: "Excellent" | "Good" | "Needs Attention";
  detail?: string;
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

export function FinancialHealth({ score, rating, detail }: FinancialHealthProps) {
  const style = ratingStyles(rating);
  const Icon = style.icon;

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm shadow-slate-200/70">
        <Icon className={cn("h-5 w-5", style.iconClass)} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Financial Health Score</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-2xl font-semibold text-slate-900">{score === null ? "Coming Soon" : score}</p>
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", style.badge)}>{rating}</span>
        </div>
        {detail ? <p className="mt-1 text-xs text-slate-600">{detail}</p> : null}
      </div>
    </div>
  );
}
