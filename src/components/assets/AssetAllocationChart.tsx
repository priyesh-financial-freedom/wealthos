"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { Asset } from "@/types/asset";

interface AssetAllocationChartProps {
  assets: Asset[];
}

export function AssetAllocationChart({ assets }: AssetAllocationChartProps) {
  const data = assets.reduce<Array<{ name: string; value: number }>>((acc, asset) => {
    const existing = acc.find((entry) => entry.name === asset.asset_type);
    if (existing) {
      existing.value += asset.current_value;
    } else {
      acc.push({ name: asset.asset_type, value: asset.current_value });
    }
    return acc;
  }, []);

  return (
    <DashboardCard className="h-full">
      <h3 className="text-base font-semibold text-slate-900">Allocation mix</h3>
      <p className="mt-1 text-sm text-slate-600">Current concentration by asset type</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={90} />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}
