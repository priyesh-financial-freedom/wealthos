import { Landmark, Wallet2 } from "lucide-react";

interface NetWorthCardProps {
  title: string;
  value: string;
  subtitle: string;
  tone?: "default" | "positive" | "warning";
}

export function NetWorthCard({ title, value, subtitle, tone = "default" }: NetWorthCardProps) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {tone === "warning" ? <Landmark className="h-5 w-5" /> : <Wallet2 className="h-5 w-5" />}
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}
