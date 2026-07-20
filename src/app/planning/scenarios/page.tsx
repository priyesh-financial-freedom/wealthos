import Link from "next/link";

import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { formatDate } from "@/lib/formatters";
import { planningScenarioService } from "@/services/planning/scenarios";

export default async function PlanningScenariosPage() {
  let scenarioCount = 0;
  let scenarios: Array<{ id: string; name: string; description: string | null; updated_at: string; is_default: boolean; is_active: boolean }> = [];
  let error: string | null = null;

  try {
    scenarios = await planningScenarioService.listScenarios();
    scenarioCount = scenarios.length;
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load planning scenarios.";
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Scenarios" description="Review saved planning scenarios and keep the active plan easy to find." />

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/planning">Back to Planning</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/planning">Open Dashboard</Link>
          </Button>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Scenario Count</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{scenarioCount}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Default Scenario</p>
            <p className="mt-2 text-base font-medium text-slate-900">{scenarios.find((scenario) => scenario.is_default)?.name ?? "None"}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active Scenario</p>
            <p className="mt-2 text-base font-medium text-slate-900">{scenarios.find((scenario) => scenario.is_active)?.name ?? "None"}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest Update</p>
            <p className="mt-2 text-base font-medium text-slate-900">{scenarios[0] ? formatDate(scenarios[0].updated_at) : "—"}</p>
          </DashboardCard>
        </section>

        {error ? (
          <ContentCard>
            <EmptyState title="Unable to load scenarios" description={error} />
          </ContentCard>
        ) : scenarios.length === 0 ? (
          <ContentCard>
            <EmptyState
              title="No scenarios yet"
              description="Create your first scenario from the planning workspace so it can hold assumption overrides and simulation runs."
            />
          </ContentCard>
        ) : (
          <div className="grid gap-4">
            {scenarios.map((scenario) => (
              <DashboardCard key={scenario.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{scenario.name}</h2>
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    {scenario.is_default ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">Default</span> : null}
                    {scenario.is_active ? <span className="rounded-full border border-slate-200 bg-slate-900 px-2.5 py-1 text-white">Active</span> : null}
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-600">{scenario.description ?? "No description provided."}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Updated {formatDate(scenario.updated_at)}</p>
              </DashboardCard>
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
