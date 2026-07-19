"use client";

import Link from "next/link";
import { memo, useId, type ComponentType } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartPie, CircleDollarSign, TrendingUp, Wallet2 } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/feedback";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { AllocationItem } from "@/services/finance";
import type { InvestmentSummarySnapshot } from "@/services/investments";

interface InvestmentDashboardProps {
  loading: boolean;
  emptyState: boolean;
  summary: InvestmentSummarySnapshot;
}

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

const MetricCard = memo(function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning";
}) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <DashboardCard className={`transition-all duration-300 hover:-translate-y-1 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{detail}</p>
    </DashboardCard>
  );
});

const DonutChartCard = memo(function DonutChartCard({ title, description, data, emptyLabel }: { title: string; description: string; data: AllocationItem[]; emptyLabel: string }) {
  const gradientId = useId();

  return (
    <DashboardCard className="h-full">
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {data.length === 0 ? (
        <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={66} outerRadius={104} paddingAngle={3} stroke="none">
                  {data.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} labelFormatter={(value) => String(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="font-medium text-slate-700">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900">{formatCurrency(item.value, { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-slate-900 to-slate-500 transition-all duration-700" />
      </div>
      <span className="sr-only" id={gradientId} />
    </DashboardCard>
  );
});
export const InvestmentDashboard = memo(function InvestmentDashboard({ loading, emptyState, summary }: InvestmentDashboardProps) {
  if (loading) {
    return <DashboardSkeleton />;
  }
  const gainPercent = summary.costBasis > 0 ? summary.overallGain / summary.costBasis : null;

  return (
    <div className="space-y-8">
      {emptyState ? (
        <DashboardCard className="overflow-hidden border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-0 text-white shadow-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <div>
              <p className="text-sm font-medium text-slate-300">Investment empty state</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Capture your first position to unlock simple performance and allocation tracking.</h3>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">Add mutual funds, stocks, ETFs, fixed income, or alternatives and WealthOS will calculate invested value, current value, and gains automatically.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                  <Link href="#investment-form">Add Investment</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/assets">Open Assets</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Total Invested", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
                { label: "Current Value", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
                { label: "Gain/Loss", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
                { label: "Gain %", value: "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <p className="text-sm text-slate-300">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Invested" value={formatCurrency(summary.costBasis, { maximumFractionDigits: 0 })} detail="Total amount invested" icon={ChartPie} />
        <MetricCard title="Current Value" value={formatCurrency(summary.totalInvestmentValue, { maximumFractionDigits: 0 })} detail="Market value of the portfolio" icon={CircleDollarSign} tone={summary.totalInvestmentValue > 0 ? "positive" : "default"} />
        <MetricCard title="Gain/Loss" value={formatCurrency(summary.overallGain, { maximumFractionDigits: 0 })} detail="Current value minus cost basis" icon={Wallet2} tone={summary.overallGain >= 0 ? "positive" : "warning"} />
        <MetricCard title="Gain %" value={formatPercent(gainPercent, { digits: 2 })} detail="Overall gain relative to invested capital" icon={TrendingUp} tone={summary.overallGain >= 0 ? "positive" : "warning"} />
      </section>

      <section className="grid gap-6">
        <DonutChartCard title="Asset Allocation" description="Current mix across asset classes" data={summary.assetAllocation} emptyLabel="No holdings yet. Add investments to view allocation." />
      </section>
    </div>
  );
});

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-32 rounded bg-slate-200" />
            <div className="mt-4 h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="h-[26rem] rounded-2xl border border-slate-200 bg-slate-100" />
      <LoadingSpinner label="Loading investment dashboard..." />
    </div>
  );
}