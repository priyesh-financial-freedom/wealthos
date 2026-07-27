"use client";

import Link from "next/link";
import { memo } from "react";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FocusWidget } from "@/components/dashboard/FocusWidget";
import { InvestmentsWidget } from "@/components/dashboard/InvestmentsWidget";
import { LiabilitiesWidget } from "@/components/dashboard/LiabilitiesWidget";
import { NetWorthWidget } from "@/components/dashboard/NetWorthWidget";
import { RetirementWidget } from "@/components/dashboard/RetirementWidget";
import { UpcomingWidget } from "@/components/dashboard/UpcomingWidget";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import type { ExecutiveDashboardData } from "@/services/dashboard";

interface ExecutiveDashboardProps {
  loading: boolean;
  data: ExecutiveDashboardData | null;
  error?: string | null;
}

export const ExecutiveDashboard = memo(function ExecutiveDashboard({ loading, data, error }: ExecutiveDashboardProps) {
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
        }}
      />

      <section className="grid gap-7 lg:grid-cols-2">
        <NetWorthWidget
          netWorth={data.executiveSummary.netWorth}
          plannedNetWorth={data.executiveSummary.plannedNetWorth}
          netWorthVariance={data.executiveSummary.netWorthVariance}
          topContributors={data.executiveSummary.topContributors}
          lastMonthlyReview={data.executiveSummary.lastMonthlyReview}
        />
        <FocusWidget
          goalsAtRisk={data.goals.atRisk}
          goalsOnTrack={data.goals.onTrack}
          monthlySavings={data.executiveSummary.monthlySavings}
          hasLiabilities={data.loans.outstanding > 0}
        />
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
        <RetirementWidget
          available={data.retirement.available}
          totalRetirementAssets={data.retirement.totalRetirementAssets}
          plannedTotalRetirementAssets={data.retirement.plannedTotalRetirementAssets}
          retirementVariance={data.retirement.retirementVariance}
          accountsCount={data.retirement.accountsCount}
        />
        <UpcomingWidget available={data.upcoming.available} items={data.upcoming.items} />
      </section>
    </div>
  );
});

function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="h-56 rounded-3xl bg-slate-100" />
      <section className="grid gap-7 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-80 rounded-3xl bg-slate-100" />
        ))}
      </section>
    </div>
  );
}
