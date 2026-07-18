"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Coins, Landmark, Layers3, PiggyBank, TrendingUp, WalletCards } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { RetirementDashboardModel } from "@/types/retirementAccount";

interface RetirementDashboardProps {
  model: RetirementDashboardModel;
  emptyState: boolean;
}

const COLORS = ["#f59e0b", "#0f172a", "#15803d"];

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

export function RetirementDashboard({ model, emptyState }: RetirementDashboardProps) {
  if (emptyState) {
    return (
      <DashboardCard className="overflow-hidden border-[#2b2414] bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.24),_transparent_35%),linear-gradient(135deg,#09090b_0%,#111827_55%,#1f2937_100%)] p-0 text-white shadow-xl">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div>
            <p className="text-sm font-medium text-amber-200/80">Retirement vault</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Bring EPF, PPF, and NPS into one premium retirement command center.</h3>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">Track balances, contribution discipline, and long-term compounding with monthly retirement snapshots.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Total Corpus", value: "$0" },
              { label: "Monthly Contribution", value: "$0" },
              { label: "Annual Growth", value: "—" },
              { label: "Allocation", value: "0%" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-sm text-slate-300">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </DashboardCard>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <MetricCard title="Total Retirement Corpus" value={formatMoney(model.totalCorpus)} subtitle="Combined EPF, PPF, and NPS" icon={WalletCards} tone="dark" />
        <MetricCard title="EPF Balance" value={formatMoney(model.balancesByType.EPF)} subtitle="Provident fund position" icon={Landmark} />
        <MetricCard title="PPF Balance" value={formatMoney(model.balancesByType.PPF)} subtitle="Public provident corpus" icon={PiggyBank} />
        <MetricCard title="NPS Balance" value={formatMoney(model.balancesByType.NPS)} subtitle="National pension exposure" icon={Layers3} />
        <MetricCard title="Monthly Contribution" value={formatMoney(model.monthlyContribution)} subtitle="Latest monthly contribution run-rate" icon={Coins} tone="positive" />
        <MetricCard title="Annual Growth" value={formatPercent(model.annualGrowthPercent)} subtitle={formatMoney(model.annualGrowthAmount)} icon={TrendingUp} tone="positive" />
        <MetricCard title="Retirement Allocation %" value={formatPercent(model.retirementAllocationPercent)} subtitle="Share of total tracked net worth" icon={ArrowUpRight} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard>
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Retirement Growth</h3>
            <p className="text-sm text-slate-600">Total retirement corpus, contributions, and interest across the latest 12 months</p>
          </div>
          {model.trend.length === 0 ? (
            <EmptyChartState label="Add monthly retirement snapshots to unlock the compounding curve." />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={model.trend}>
                  <defs>
                    <linearGradient id="ret-total" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f172a" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0f172a" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="ret-contribution" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                  <Area type="monotone" dataKey="total" stroke="#0f172a" fill="url(#ret-total)" strokeWidth={2.6} />
                  <Area type="monotone" dataKey="contribution" stroke="#f59e0b" fill="url(#ret-contribution)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>

        <DashboardCard>
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">EPF vs PPF vs NPS Allocation</h3>
            <p className="text-sm text-slate-600">Current split of retirement capital by retirement account type</p>
          </div>
          {model.allocation.length === 0 ? (
            <EmptyChartState label="No retirement accounts added yet." />
          ) : (
            <div className="grid gap-4">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={model.allocation} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={3}>
                      {model.allocation.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {model.allocation.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{formatMoney(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DashboardCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DashboardCard>
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Contribution History</h3>
            <p className="text-sm text-slate-600">Monthly inflow into retirement assets</p>
          </div>
          {model.contributionHistory.length === 0 ? (
            <EmptyChartState label="Contribution history appears here after monthly snapshots are added." />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.contributionHistory}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                  <Bar dataKey="contribution" radius={[10, 10, 0, 0]} fill="#f59e0b" barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>

        <DashboardCard>
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Yearly Growth</h3>
            <p className="text-sm text-slate-600">Annual corpus expansion based on monthly snapshot closes</p>
          </div>
          {model.yearlyGrowth.length === 0 ? (
            <EmptyChartState label="Yearly growth will populate after the first monthly close cycle." />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.yearlyGrowth}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                  <Bar dataKey="growth" radius={[10, 10, 0, 0]} fill="#0f172a" barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>
      </section>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "dark";
}) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    dark: "border-[#2b2414] bg-[linear-gradient(135deg,#09090b_0%,#111827_60%,#1f2937_100%)] text-white",
  };

  return (
    <DashboardCard className={toneClasses[tone]}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${tone === "dark" ? "text-slate-300" : "text-slate-500"}`}>{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone === "dark" ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className={`mt-4 text-sm ${tone === "dark" ? "text-slate-300" : "text-slate-600"}`}>{subtitle}</p>
    </DashboardCard>
  );
}