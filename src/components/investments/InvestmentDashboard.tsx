"use client";

import Link from "next/link";
import { memo, useId, type ComponentType } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, ChartPie, CircleDollarSign, Landmark, Layers3, Sparkles, TrendingUp, Wallet2 } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/feedback";
import type { AllocationItem } from "@/services/finance";
import type { Investment } from "@/types/investment";
import type { InvestmentInsight, InvestmentSummarySnapshot } from "@/services/investments";

interface InvestmentDashboardProps {
  loading: boolean;
  emptyState: boolean;
  summary: InvestmentSummarySnapshot;
  topInvestments: Investment[];
  recentInvestments: Investment[];
  insights: InvestmentInsight[];
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

const InsightCard = memo(function InsightCard({ insight }: { insight: InvestmentInsight }) {
  const toneClasses = {
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    neutral: "border-slate-200 bg-slate-50 text-slate-900",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 ${toneClasses[insight.tone]}`}>
      <p className="text-sm font-semibold">{insight.title}</p>
      <p className="mt-2 text-sm opacity-90">{insight.detail}</p>
    </div>
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
                <Tooltip formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`} />
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
                <span className="font-semibold text-slate-900">${item.value.toLocaleString()}</span>
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

const TrendChartCard = memo(function TrendChartCard({ data }: { data: Array<{ month: string; totalValue: number; investedCost: number }> }) {
  const gradientId = useId();

  return (
    <DashboardCard className="h-full">
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-slate-900">Assets vs Liabilities Trend</h3>
        <p className="text-sm text-slate-600">Placeholder historical data until history exists</p>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`${gradientId}-value`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#0f172a" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id={`${gradientId}-cost`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f766e" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#0f766e" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <Tooltip formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`} />
            <Area type="monotone" dataKey="totalValue" stroke="#0f172a" fill={`url(#${gradientId}-value)`} strokeWidth={2.5} />
            <Area type="monotone" dataKey="investedCost" stroke="#0f766e" fill={`url(#${gradientId}-cost)`} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
});

const TopInvestmentsCard = memo(function TopInvestmentsCard({ investments }: { investments: Investment[] }) {
  const data = investments.map((investment) => ({ name: investment.investment_name, value: investment.current_value }));

  return (
    <DashboardCard className="h-full">
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-slate-900">Top 10 Assets</h3>
        <p className="text-sm text-slate-600">Largest holdings by current value</p>
      </div>
      {data.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
          No investments yet. Add a holding to populate your top assets.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={120} tick={{ fill: "#334155", fontSize: 12 }} />
              <Tooltip formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`} />
              <Bar dataKey="value" radius={[0, 10, 10, 0]} fill="#0f172a" barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardCard>
  );
});

const ActivityRow = memo(function ActivityRow({ title, detail, time }: { title: string; detail: string; time: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{detail}</p>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{time}</span>
      </div>
    </div>
  );
});

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "Recently updated";
  }

  const delta = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export const InvestmentDashboard = memo(function InvestmentDashboard({ loading, emptyState, summary, topInvestments, recentInvestments, insights }: InvestmentDashboardProps) {
  if (loading) {
    return <DashboardSkeleton />;
  }

  const trendData = [
    { month: "Jan", totalValue: Math.max(summary.totalInvestmentValue * 0.92, 0), investedCost: Math.max(summary.costBasis * 0.95, 0) },
    { month: "Feb", totalValue: Math.max(summary.totalInvestmentValue * 0.95, 0), investedCost: Math.max(summary.costBasis * 0.96, 0) },
    { month: "Mar", totalValue: Math.max(summary.totalInvestmentValue * 0.97, 0), investedCost: Math.max(summary.costBasis * 0.98, 0) },
    { month: "Apr", totalValue: Math.max(summary.totalInvestmentValue * 1.01, 0), investedCost: summary.costBasis },
    { month: "May", totalValue: Math.max(summary.totalInvestmentValue * 1.03, 0), investedCost: summary.costBasis },
    { month: "Jun", totalValue: Math.max(summary.totalInvestmentValue * 1.06, 0), investedCost: summary.costBasis },
  ];

  return (
    <div className="space-y-8">
      {emptyState ? (
        <DashboardCard className="overflow-hidden border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-0 text-white shadow-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <div>
              <p className="text-sm font-medium text-slate-300">Investment empty state</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Capture your first position to unlock performance, allocation, and return analytics.</h3>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">Add mutual funds, stocks, ETFs, fixed income, or alternatives and WealthOS will calculate portfolio value, gain, CAGR, and XIRR.</p>
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
                { label: "Total Value", value: "$0" },
                { label: "Today's Gain/Loss", value: "$0" },
                { label: "XIRR", value: "—" },
                { label: "CAGR", value: "—" },
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Total Investment Value" value={formatMoney(summary.totalInvestmentValue)} detail="Market value of the portfolio" icon={CircleDollarSign} tone={summary.totalInvestmentValue > 0 ? "positive" : "default"} />
        <MetricCard title="Today's Gain/Loss" value={formatMoney(summary.todaysGainLoss)} detail="Move since the latest pricing update" icon={TrendingUp} tone={summary.todaysGainLoss >= 0 ? "positive" : "warning"} />
        <MetricCard title="Overall Gain" value={formatMoney(summary.overallGain)} detail="Current value minus cost basis" icon={Wallet2} tone={summary.overallGain >= 0 ? "positive" : "warning"} />
        <MetricCard title="XIRR" value={formatPercent(summary.xirr)} detail="Money-weighted return across holdings" icon={Landmark} tone={summary.xirr && summary.xirr > 0 ? "positive" : "default"} />
        <MetricCard title="CAGR" value={formatPercent(summary.cagr)} detail="Annualized growth rate from purchase date" icon={Layers3} tone={summary.cagr && summary.cagr > 0 ? "positive" : "default"} />
        <MetricCard title="Cost Basis" value={formatMoney(summary.costBasis)} detail="Total amount invested" icon={ChartPie} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <DonutChartCard title="Asset Allocation" description="Current mix across asset classes" data={summary.assetAllocation} emptyLabel="No holdings yet. Add investments to view allocation." />
        <DonutChartCard title="Sector Allocation" description="Exposure by sector or theme" data={summary.sectorAllocation} emptyLabel="No sector data yet." />
        <DonutChartCard title="AMC Allocation" description="Current concentration by manager or issuer" data={summary.amcAllocation} emptyLabel="No AMC data yet." />
        <DonutChartCard title="Equity vs Debt" description="Portfolio balance across market-linked and income instruments" data={summary.equityDebtAllocation} emptyLabel="No allocation data yet." />
        <DonutChartCard title="Domestic vs International" description="Geographic exposure across your portfolio" data={summary.regionAllocation} emptyLabel="No regional data yet." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <TrendChartCard data={trendData} />
        <TopInvestmentsCard investments={topInvestments} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <DashboardCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Executive Insights</h3>
              <p className="text-sm text-slate-600">Dynamic observations from current holdings</p>
            </div>
            <Sparkles className="h-4 w-4 text-slate-400" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {insights.length > 0 ? insights.map((insight) => <InsightCard key={insight.title} insight={insight} />) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">No insights yet.</div>}
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
              <p className="text-sm text-slate-600">Latest investments added</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </div>
          <div className="space-y-3">
            {recentInvestments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">No recent investments yet.</div>
            ) : (
              recentInvestments.map((investment) => (
                <ActivityRow key={investment.id} title={investment.investment_name} detail={`${investment.category} • ${investment.region}`} time={formatRelativeTime(investment.created_at)} />
              ))
            )}
          </div>
        </DashboardCard>
      </section>
    </div>
  );
});

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-32 rounded bg-slate-200" />
            <div className="mt-4 h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-[22rem] rounded-2xl border border-slate-200 bg-slate-100" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-[26rem] rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-[26rem] rounded-2xl border border-slate-200 bg-slate-100" />
      </div>
      <LoadingSpinner label="Loading investment dashboard..." />
    </div>
  );
}