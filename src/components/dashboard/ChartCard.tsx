"use client";

import { ResponsiveContainer, Pie, PieChart, Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { DashboardCard } from "@/components/dashboard/DashboardCard";

interface ChartCardProps {
  title: string;
  description: string;
  chartType: "pie" | "area";
}

const pieData = [
  { name: "Equities", value: 42 },
  { name: "Fixed Income", value: 24 },
  { name: "Cash", value: 18 },
  { name: "Alternatives", value: 16 },
];

const areaData = [
  { month: "Jan", value: 485000 },
  { month: "Feb", value: 492000 },
  { month: "Mar", value: 501000 },
  { month: "Apr", value: 509000 },
  { month: "May", value: 518000 },
  { month: "Jun", value: 527000 },
];

export function ChartCard({ title, description, chartType }: ChartCardProps) {
  return (
    <DashboardCard className="h-full">
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" ? (
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} />
              <Tooltip />
            </PieChart>
          ) : (
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#0f172a" fill="url(#netWorthFill)" strokeWidth={2.5} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}
