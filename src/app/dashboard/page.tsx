"use client";

import { useEffect, useState } from "react";

import { ActivityList } from "@/components/dashboard/ActivityList";
import { AIInsightCard } from "@/components/dashboard/AIInsightCard";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { AllocationChart } from "@/components/finance/AllocationChart";
import { ExecutiveSummary } from "@/components/finance/ExecutiveSummary";
import { FinanceSummary } from "@/components/finance/FinanceSummary";
import { NetWorthTrendChart } from "@/components/finance/NetWorthTrendChart";
import { RatioCard } from "@/components/finance/RatioCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAssets } from "@/services/assets";
import { buildDashboardSummary } from "@/services/finance";
import { getLiabilities } from "@/services/liabilities";
import { ArrowUpRight } from "lucide-react";

const trendData = [
  { month: "Jan", value: 485000 },
  { month: "Feb", value: 492000 },
  { month: "Mar", value: 501000 },
  { month: "Apr", value: 509000 },
  { month: "May", value: 518000 },
  { month: "Jun", value: 527000 },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState(() => buildDashboardSummary([], []));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        const [assets, liabilities] = await Promise.all([getAssets(), getLiabilities()]);
        setSummary(buildDashboardSummary(assets, liabilities));
      } finally {
        setLoading(false);
      }
    }

    void loadSummary();
  }, []);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Executive Dashboard"
          description="A refined view of wealth, liquidity, and decision-ready insights for the modern executive."
        />

        <ExecutiveSummary summary={summary} />
        <FinanceSummary summary={summary} />

        <section className="grid gap-4 md:grid-cols-3">
          <RatioCard title="Largest Asset" value={summary.largestAsset ? `$${summary.largestAsset.current_value.toLocaleString()}` : "—"} detail={summary.largestAsset ? summary.largestAsset.asset_name : "No assets yet"} />
          <RatioCard title="Largest Liability" value={summary.largestLiability ? `$${summary.largestLiability.outstanding_amount.toLocaleString()}` : "—"} detail={summary.largestLiability ? summary.largestLiability.account_name : "No liabilities yet"} />
          <RatioCard title="Coverage" value={`${Math.max(0, 100 - Math.round(summary.debtRatio * 100)).toFixed(0)}%`} detail="Residual equity buffer relative to assets" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <AllocationChart title="Asset Allocation" description="Current mix across core buckets" data={summary.assetAllocation} />
          <AllocationChart title="Liability Allocation" description="Current mix across debt obligations" data={summary.liabilityAllocation} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <NetWorthTrendChart data={trendData} />
            <DashboardCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <SectionHeader title="Recent Activity" description="Latest movements and account updates" />
                <div className="flex items-center gap-1 text-sm font-medium text-slate-600">
                  View all <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
              <ActivityList />
            </DashboardCard>
          </div>

          <div className="space-y-6">
            <DashboardCard>
              <SectionHeader title="Quick Actions" description="Create or update core wealth records" />
              <div className="mt-4">
                <QuickActions />
              </div>
            </DashboardCard>
            <AIInsightCard />
          </div>
        </section>

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading financial summary…</div> : null}
      </PageContainer>
    </AppLayout>
  );
}
