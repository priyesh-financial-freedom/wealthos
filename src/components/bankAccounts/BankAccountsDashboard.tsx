"use client";

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowDownCircle, ArrowUpCircle, CircleDollarSign, Droplets } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { BankAccountsDashboardModel } from "@/types/bankAccount";

interface BankAccountsDashboardProps {
  model: BankAccountsDashboardModel;
  emptyState: boolean;
}

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1"];

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatRatio(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value.toFixed(2)}x`;
}

export function BankAccountsDashboard({ model, emptyState }: BankAccountsDashboardProps) {
  if (emptyState) {
    return (
      <DashboardCard className="overflow-hidden border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-0 text-white shadow-xl">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <p className="text-sm font-medium text-slate-300">Banking empty state</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Add your first bank account and monthly updates to unlock liquidity analytics.</h3>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">Track opening/closing balance, inflow, outflow, and earned interest with month-by-month cash intelligence.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Total Cash", value: "$0" },
              { label: "Monthly Inflow", value: "$0" },
              { label: "Monthly Outflow", value: "$0" },
              { label: "Liquidity Ratio", value: "—" },
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total Cash" value={formatCurrency(model.totalCash)} subtitle="Current liquid position" icon={CircleDollarSign} tone="positive" />
        <MetricCard title="Monthly Inflow" value={formatCurrency(model.monthlyInflow)} subtitle="Total deposits in latest month" icon={ArrowUpCircle} tone="positive" />
        <MetricCard title="Monthly Outflow" value={formatCurrency(model.monthlyOutflow)} subtitle="Total withdrawals in latest month" icon={ArrowDownCircle} tone="warning" />
        <MetricCard title="Liquidity Ratio" value={formatRatio(model.liquidityRatio)} subtitle="Cash / total liabilities" icon={Droplets} tone={model.liquidityRatio && model.liquidityRatio >= 1 ? "positive" : "default"} />
        <MetricCard title="Interest Earned" value={formatCurrency(model.latestInterestEarned)} subtitle="Latest month estimated interest" icon={Activity} tone="default" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard>
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Cash Trend</h3>
            <p className="text-sm text-slate-600">Rolling 12-month trend for cash, inflow, and outflow</p>
          </div>
          {model.cashTrend.length === 0 ? (
            <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
              Add monthly updates to unlock trend analytics.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={model.cashTrend}>
                  <defs>
                    <linearGradient id="cashTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f172a" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0f172a" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="cashInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="cashOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#be123c" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#be123c" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`} />
                  <Area type="monotone" dataKey="totalCash" stroke="#0f172a" fill="url(#cashTotal)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="inflow" stroke="#059669" fill="url(#cashInflow)" strokeWidth={2.2} />
                  <Area type="monotone" dataKey="outflow" stroke="#be123c" fill="url(#cashOutflow)" strokeWidth={2.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>

        <DashboardCard>
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Type Allocation</h3>
            <p className="text-sm text-slate-600">Cash split across account types</p>
          </div>
          {model.accountTypeAllocation.length === 0 ? (
            <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">No accounts added yet.</div>
          ) : (
            <div className="grid gap-4">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={model.accountTypeAllocation} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90}>
                      {model.accountTypeAllocation.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {model.accountTypeAllocation.map((item, index) => (
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
        </DashboardCard>
      </section>
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
  tone?: "default" | "positive" | "warning";
}) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-rose-200 bg-rose-50 text-rose-900",
  };

  return (
    <DashboardCard className={toneClasses[tone]}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{subtitle}</p>
    </DashboardCard>
  );
}
