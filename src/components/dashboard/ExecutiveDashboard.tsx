"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { memo, useEffect, useState } from "react";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { InvestmentsWidget } from "@/components/dashboard/InvestmentsWidget";
import { LiabilitiesWidget } from "@/components/dashboard/LiabilitiesWidget";
import { MonthlyReviewSummaryWidget } from "@/components/dashboard/MonthlyReviewSummaryWidget";
import { NetWorthWidget } from "@/components/dashboard/NetWorthWidget";
import { RetirementHeroWidget } from "@/components/dashboard/RetirementHeroWidget";
import { UpcomingWidget } from "@/components/dashboard/UpcomingWidget";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import type { ExecutiveDashboardData } from "@/components/dashboard/dashboardTypes";

type DashboardOptionalWidgetsComponent = ComponentType<{ data: ExecutiveDashboardData }>;

interface ExecutiveDashboardProps {
  loading: boolean;
  optionalLoading?: boolean;
  data: ExecutiveDashboardData | null;
  error?: string | null;
}

export const ExecutiveDashboard = memo(function ExecutiveDashboard({ loading, optionalLoading = false, data, error }: ExecutiveDashboardProps) {
  const [OptionalWidgets, setOptionalWidgets] = useState<DashboardOptionalWidgetsComponent | null>(null);

  useEffect(() => {
    let isMounted = true;

    void import("./DashboardOptionalWidgets")
      .then((module) => {
        if (isMounted) {
          setOptionalWidgets(() => module.DashboardOptionalWidgets);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOptionalWidgets(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <DashboardLoadingSkeleton />;
  }

  if (error) {
    return (
      <DashboardCard className="max-w-3xl">
        <h3 className="text-lg font-semibold text-rose-700">Unable to load Executive Dashboard</h3>
        <p className="mt-2 text-sm leading-6 text-rose-700/90">{error}</p>
      </DashboardCard>
    );
  }

  if (!data) {
    return (
      <DashboardCard className="max-w-3xl">
        <h3 className="text-lg font-semibold text-slate-900">Dashboard data is unavailable</h3>
        <p className="mt-2 text-sm text-slate-600">Coming Soon</p>
      </DashboardCard>
    );
  }

  if (data.emptyState) {
    return (
      <DashboardCard className="max-w-3xl text-center">
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900">Add financial data to unlock Project North Star</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">Capture assets, liabilities, and investments to render your executive dashboard.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/assets">Add Asset</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/liabilities">Add Liability</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/investments">Add Investment</Link>
          </Button>
        </div>
      </DashboardCard>
    );
  }

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-10">
      <DashboardHeader
        dateLabel={todayLabel}
        insight={data.dailyInsight || "Coming Soon"}
        health={{
          score: data.financialHealth.score,
          rating: data.financialHealth.rating,
          detail: data.financialHealth.detail,
          components: data.financialHealth.components,
        }}
      />

      <RetirementHeroWidget retirement={data.retirement} />

      <section className="grid gap-5 lg:grid-cols-2">
        <NetWorthWidget
          netWorth={data.executiveSummary.netWorth}
          plannedNetWorth={data.executiveSummary.plannedNetWorth}
          netWorthVariance={data.executiveSummary.netWorthVariance}
          topContributors={data.executiveSummary.topContributors}
          lastMonthlyReview={data.executiveSummary.lastMonthlyReview}
        />
        <MonthlyReviewSummaryWidget summary={data.monthlyReviewSummary} />
      </section>

      {optionalLoading || OptionalWidgets === null ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <OptionalWidgetSkeleton title="Recommended actions" />
          <OptionalWidgetSkeleton title="Goal funding heatmap" />
          <OptionalWidgetSkeleton title="Net worth trend" />
          <OptionalWidgetSkeleton title="Asset allocation drift" />
        </section>
      ) : (
        <OptionalWidgets data={data} />
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <InvestmentsWidget
          available
          currentPortfolio={data.investments.currentPortfolio}
          plannedPortfolio={data.investments.plannedPortfolio}
          portfolioVariance={data.investments.portfolioVariance}
          monthlyInvestment={data.investments.monthlyInvestment}
        />
        <LiabilitiesWidget
          available
          outstanding={data.loans.outstanding}
          plannedOutstanding={data.loans.plannedOutstanding}
          outstandingVariance={data.loans.outstandingVariance}
          emi={data.loans.emi}
        />
        <UpcomingWidget available={data.upcoming.available} items={data.upcoming.items} />
      </section>
    </div>
  );
});


function OptionalWidgetSkeleton({ title }: { title: string }) {
  return (
    <DashboardCard>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <div className="mt-4 h-40 animate-pulse rounded-2xl bg-slate-100" />
      <p className="mt-3 text-sm text-slate-500">Loading optional dashboard data...</p>
    </DashboardCard>
  );
}

function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="h-56 rounded-3xl bg-slate-100" />
      <section className="grid gap-7 lg:grid-cols-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-80 rounded-3xl bg-slate-100" />
        ))}
      </section>
    </div>
  );
}
