"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { PlanningModuleCard } from "@/components/planning/PlanningModuleCard";
import { PlanningStatCard } from "@/components/planning/PlanningStatCard";
import { PlanningDashboardService, type PlanningDashboardSummary } from "@/services/planning";

const statMeta: Record<keyof PlanningDashboardSummary["stats"], { label: string; detail: string }> = {
  scenarios: { label: "Scenarios", detail: "Planning scenarios currently available." },
  goals: { label: "Goals", detail: "Active goals ready for planning." },
  retirementStatus: { label: "Retirement Status", detail: "Current retirement planning readiness." },
  cashFlowStatus: { label: "Cash Flow Status", detail: "Forecasting setup for planning cash flow." },
};

export default function PlanningPage() {
  const [summary, setSummary] = useState<PlanningDashboardSummary>(PlanningDashboardService.getInitialSummary());

  useEffect(() => {
    let isMounted = true;

    void PlanningDashboardService.getSummary().then((nextSummary) => {
      if (isMounted) {
        setSummary(nextSummary);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppLayout>
      <PageContainer>
        <ContentCard className="overflow-hidden">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
            <div className="space-y-6">
              <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Planning Workspace
              </span>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{summary.hero.title}</h1>
                <p className="max-w-2xl text-lg text-slate-600 sm:text-xl">{summary.hero.subtitle}</p>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Create scenarios, define goals, plan retirement, forecast cash flow and evaluate major life decisions.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/planning/scenarios">Create Scenario</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/planning/goals">Create Goal</Link>
                </Button>
              </div>
            </div>

            <DashboardCard className="bg-slate-50">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended next action</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{summary.hero.recommendedNextAction}</p>
            </DashboardCard>
          </div>
        </ContentCard>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.entries(summary.stats) as Array<[keyof PlanningDashboardSummary["stats"], string | number]>).map(([key, value]) => (
            <PlanningStatCard key={key} label={statMeta[key].label} value={String(value)} detail={statMeta[key].detail} />
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summary.modules.map((card) => (
            <PlanningModuleCard
              key={card.id}
              title={card.title}
              description={card.description}
              statusMessage={card.status}
              actionLabel={card.actionLabel}
              href={card.actionHref}
              icon={card.icon}
            />
          ))}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Recent Planning Activity</h2>
          </div>
          {summary.recentActivity.length === 0 ? (
            <ContentCard>
              <EmptyState
                title="No planning activity yet."
                description="This section will display recent scenario runs, goal updates and retirement calculations."
              />
            </ContentCard>
          ) : (
            <div className="grid gap-4">
              {summary.recentActivity.map((activity) => (
                <DashboardCard key={activity.id} className="space-y-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <h3 className="text-base font-semibold text-slate-900">{activity.title}</h3>
                    <p className="text-sm text-slate-500">{activity.date}</p>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{activity.description}</p>
                </DashboardCard>
              ))}
            </div>
          )}
        </section>
      </PageContainer>
    </AppLayout>
  );
}
