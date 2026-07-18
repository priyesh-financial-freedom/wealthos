"use client";

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { UniversalDashboardSummary } from "@/types/universalAccount";

interface AccountEngineTrendCardsProps {
  summary: UniversalDashboardSummary;
}

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

export function AccountEngineTrendCards({ summary }: AccountEngineTrendCardsProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <DashboardCard>
        <div className="mb-4 space-y-1">
          <h3 className="text-base font-semibold text-slate-900">Portfolio Trend</h3>
          <p className="text-sm text-slate-600">Total value, inflow, and outflow over the last 12 months</p>
        </div>
        {summary.trend.length === 0 ? (
          <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
            Add monthly snapshots to unlock trend analytics.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.trend}>
                <defs>
                  <linearGradient id="ua-total" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="ua-inflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="ua-outflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#be123c" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#be123c" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`} />
                <Area type="monotone" dataKey="total" stroke="#0f172a" fill="url(#ua-total)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="inflow" stroke="#059669" fill="url(#ua-inflow)" strokeWidth={2.2} />
                <Area type="monotone" dataKey="outflow" stroke="#be123c" fill="url(#ua-outflow)" strokeWidth={2.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardCard>

      <DashboardCard>
        <div className="mb-4 space-y-1">
          <h3 className="text-base font-semibold text-slate-900">Allocation</h3>
          <p className="text-sm text-slate-600">Current distribution by universal account type</p>
        </div>
        {summary.allocation.length === 0 ? (
          <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
            No accounts yet.
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.allocation} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90}>
                    {summary.allocation.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {summary.allocation.slice(0, 6).map((item, index) => (
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
  );
}
