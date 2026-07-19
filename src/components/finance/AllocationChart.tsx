"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { AllocationItem } from "@/services/finance";

interface AllocationChartProps {
  title: string;
  description: string;
  data: AllocationItem[];
}

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

export function AllocationChart({ title, description, data }: AllocationChartProps) {
  return (
    <DashboardCard className="h-full">
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90}>
              {data.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `₹${Number(value ?? 0).toLocaleString("en-IN")}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span>{item.name}</span>
            </div>
            <span className="font-medium text-slate-900">₹{item.value.toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
