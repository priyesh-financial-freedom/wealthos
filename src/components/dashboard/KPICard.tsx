import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  trend: string;
  icon: LucideIcon;
}

export function KPICard({ title, value, trend, icon: Icon }: KPICardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-emerald-600">{trend}</p>
    </div>
  );
}
