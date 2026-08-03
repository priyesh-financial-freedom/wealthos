"use client";

import { AssetAllocationDriftWidget } from "@/components/dashboard/AssetAllocationDriftWidget";
import { GoalFundingHeatmapWidget } from "@/components/dashboard/GoalFundingHeatmapWidget";
import { NetWorthTrendWidget } from "@/components/dashboard/NetWorthTrendWidget";
import { RecommendedActionsWidget } from "@/components/dashboard/RecommendedActionsWidget";
import type { ExecutiveDashboardData } from "@/components/dashboard/dashboardTypes";

export function DashboardOptionalWidgets({ data }: { data: ExecutiveDashboardData }) {
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <RecommendedActionsWidget actions={data.recommendedActions} />
      <GoalFundingHeatmapWidget goals={data.goals} />
      <NetWorthTrendWidget trend={data.netWorthTrend} />
      <AssetAllocationDriftWidget drift={data.assetAllocationDrift} />
    </section>
  );
}
