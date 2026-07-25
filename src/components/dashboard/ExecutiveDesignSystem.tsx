"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface ExecutiveKpiCardProps {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "blue" | "emerald" | "purple" | "amber" | "red" | "cyan";
}

const KPI_TONES: Record<NonNullable<ExecutiveKpiCardProps["tone"]>, string> = {
  blue: "from-blue-600/14 to-blue-500/5 text-blue-700",
  emerald: "from-emerald-600/14 to-emerald-500/5 text-emerald-700",
  purple: "from-violet-600/16 to-fuchsia-500/6 text-violet-700",
  amber: "from-amber-500/18 to-amber-400/6 text-amber-700",
  red: "from-rose-600/16 to-rose-500/6 text-rose-700",
  cyan: "from-cyan-600/16 to-cyan-500/6 text-cyan-700",
};

export function ExecutiveKpiCard({ title, value, detail, icon: Icon, tone = "blue" }: ExecutiveKpiCardProps) {
  return (
    <article className="executive-card rounded-[22px] border border-executive-slate-200 bg-white p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_58px_-34px_rgba(37,99,235,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="executive-label">{title}</p>
          <p className="mt-3 text-[1.65rem] font-semibold leading-none tracking-[-0.02em] text-executive-slate-900">{value}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br", KPI_TONES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-executive-slate-500">{detail}</p>
    </article>
  );
}

export function InsightCard({ title, caption, children, className }: { title: string; caption?: string; children: React.ReactNode; className?: string }) {
  return (
    <article className={cn("executive-card rounded-[22px] border border-executive-slate-200 bg-white p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="executive-section-title">{title}</h3>
          {caption ? <p className="mt-1 text-sm text-executive-slate-500">{caption}</p> : null}
        </div>
      </div>
      {children}
    </article>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-executive-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-executive-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}

export function StatusBadge({ tone, label }: { tone: "critical" | "high" | "medium" | "low" | "positive"; label: string }) {
  const toneClass = {
    critical: "border-rose-200 bg-rose-50 text-rose-700",
    high: "border-amber-200 bg-amber-50 text-amber-700",
    medium: "border-blue-200 bg-blue-50 text-blue-700",
    low: "border-slate-200 bg-slate-100 text-slate-700",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[tone];

  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide", toneClass)}>{label}</span>;
}

export function MetricChip({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "blue" | "emerald" | "amber" | "purple" | "cyan" }) {
  const toneClass = {
    slate: "border-slate-200 bg-slate-100 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    purple: "border-violet-200 bg-violet-50 text-violet-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  }[tone];

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs", toneClass)}>
      <span className="font-medium">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function ProgressBar({ value, colorClass = "bg-blue-600" }: { value: number; colorClass?: string }) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={cn("h-full rounded-full transition-all duration-500", colorClass)} style={{ width: `${normalized}%` }} />
    </div>
  );
}

export function ProgressRing({ value, label, tone = "blue" }: { value: number; label: string; tone?: "blue" | "emerald" | "purple" | "amber" | "cyan" }) {
  const normalized = Math.max(0, Math.min(100, value));
  const radius = 46;
  const stroke = 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;
  const strokeClass = {
    blue: "stroke-blue-600",
    emerald: "stroke-emerald-500",
    purple: "stroke-violet-600",
    amber: "stroke-amber-500",
    cyan: "stroke-cyan-500",
  }[tone];

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-label={label}>
        <circle cx="60" cy="60" r={radius} strokeWidth={stroke} className="fill-none stroke-slate-200" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn("fill-none transition-all duration-500", strokeClass)}
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.35rem] font-semibold tracking-[-0.02em] text-executive-slate-900">{Math.round(normalized)}</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-executive-slate-500">{label}</span>
      </div>
    </div>
  );
}

export function ExecutiveEmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="executive-card rounded-[22px] border border-dashed border-executive-slate-200 bg-white/90 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold tracking-[-0.01em] text-executive-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-executive-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

export function DashboardRefreshBanner({ message }: { message: string }) {
  return (
    <div className="executive-surface flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-800">
      <CheckCircle2 className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <div className="executive-card rounded-[22px] border border-rose-200 bg-rose-50 p-6 text-rose-800">
      <h3 className="text-base font-semibold">Dashboard requires attention</h3>
      <p className="mt-2 text-sm">{message}</p>
    </div>
  );
}

export function LoadingExecutiveState() {
  return (
    <div className="space-y-6">
      <div className="h-44 animate-pulse rounded-[28px] bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-[22px] bg-slate-100" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-[22px] bg-slate-100" />
        <div className="h-80 animate-pulse rounded-[22px] bg-slate-100" />
      </div>
      <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading executive dashboard...</span>
      </div>
    </div>
  );
}
