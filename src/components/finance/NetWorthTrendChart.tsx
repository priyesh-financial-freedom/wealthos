"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DashboardCard } from "@/components/dashboard/DashboardCard";

interface NetWorthTrendChartProps {
  data: Array<{ month: string; value: number }>;
}

export function NetWorthTrendChart({ data }: NetWorthTrendChartProps) {
  return (
    <DashboardCard className="h-full">
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-slate-900">Net Worth Summary</h3>
        <p className="text-sm text-slate-600">Projected trend from current balances</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#0f172a" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <Tooltip formatter={(value) => `$${Number(value ?? 0).toLocaleString()}`} />
            <Area type="monotone" dataKey="value" stroke="#0f172a" fill="url(#netWorthFill)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}
