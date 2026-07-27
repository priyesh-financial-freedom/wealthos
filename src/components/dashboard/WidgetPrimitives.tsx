import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function WidgetHeader({
  eyebrow,
  title,
  icon: Icon,
  iconTone,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  iconTone: "blue" | "amber" | "rose" | "emerald" | "cyan";
}) {
  const iconToneClass = {
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    emerald: "bg-emerald-100 text-emerald-700",
    cyan: "bg-cyan-100 text-cyan-700",
  }[iconTone];

  const accentToneClass = {
    blue: "bg-blue-200/80",
    amber: "bg-amber-200/80",
    rose: "bg-rose-200/80",
    emerald: "bg-emerald-200/80",
    cyan: "bg-cyan-200/80",
  }[iconTone];

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-[0.01em] text-slate-500">{eyebrow}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.015em] text-slate-900">{title}</h3>
        <div className={cn("mt-3 h-1 w-12 rounded-full", accentToneClass)} />
      </div>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", iconToneClass)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

export function WidgetMetricGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-6 grid gap-3 sm:grid-cols-2", className)}>{children}</div>;
}

export function WidgetMetric({
  label,
  value,
  tone = "default",
  trailing,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warning";
  trailing?: React.ReactNode;
}) {
  const toneClass = tone === "positive" ? "text-emerald-700" : tone === "warning" ? "text-amber-800" : "text-slate-900";

  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={cn("mt-2 flex items-center gap-1 text-sm font-semibold tabular-nums", toneClass)}>
        {value}
        {trailing}
      </p>
    </div>
  );
}

export function WidgetComingSoon({ text = "Coming Soon" }: { text?: string }) {
  return (
    <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
      {text}
    </div>
  );
}
