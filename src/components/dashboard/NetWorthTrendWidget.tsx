"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetHeader } from "@/components/dashboard/WidgetPrimitives";
import { formatCurrency } from "@/lib/formatters";
import type { ExecutiveDashboardData } from "@/components/dashboard/dashboardTypes";

interface NetWorthTrendWidgetProps {
  trend: ExecutiveDashboardData["netWorthTrend"];
}

export function NetWorthTrendWidget({ trend }: NetWorthTrendWidgetProps) {
  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Net worth" title="Planned vs actual net worth trend" icon={TrendingUp} iconTone="blue" />

      {!trend.available ? (
        <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">{trend.message ?? "No monthly snapshots yet"}</div>
      ) : (
        <div className="mt-6 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend.points}>
              <defs>
                <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} />
              <Legend />
              <Area type="monotone" dataKey="actual" name="Actual" stroke="#0f766e" fill="url(#actualFill)" strokeWidth={2.2} connectNulls />
              <Area type="monotone" dataKey="planned" name="Planned" stroke="#1e293b" fill="transparent" strokeDasharray="5 5" strokeWidth={2} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardCard>
  );
}
