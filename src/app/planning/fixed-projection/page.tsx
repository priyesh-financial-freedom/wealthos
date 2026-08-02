import Link from "next/link";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { createProjectionReadServerService } from "@/services/projection/ProjectionReadService";

function formatProjectionValue(value: number | null) {
  if (value == null) {
    return "Data required";
  }

  return formatCurrency(value, { maximumFractionDigits: 0 });
}

export default async function FixedProjectionPage() {
  const service = createProjectionReadServerService();
  const projection = await service.getLatestLockedFixedProjection().catch(() => null);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Fixed Projection"
          description="Review the month-wise fixed projection output for key financial buckets."
          summary="Original locked plan from July 2026"
        />

        {!projection ? (
          <ContentCard className="space-y-4">
            <EmptyState title="No Fixed Projection has been generated yet." description="Set assumptions before generating Fixed Projection." />
            <div className="flex justify-center">
              <Button asChild variant="outline">
                <Link href="/planning/my-financial-plan">Generate Fixed Projection</Link>
              </Button>
            </div>
          </ContentCard>
        ) : (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <DashboardCard>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Plan Version</p>
                <p className="mt-2 text-base font-semibold text-slate-900">v{projection.plan.version_no}</p>
              </DashboardCard>
              <DashboardCard>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start Month</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{projection.plan.start_month}</p>
              </DashboardCard>
              <DashboardCard>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">End Month</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{projection.plan.horizon_end_month}</p>
              </DashboardCard>
              <DashboardCard>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{projection.plan.status}</p>
              </DashboardCard>
              <DashboardCard>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last Generated</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{formatDate(projection.plan.locked_at ?? projection.plan.updated_at)}</p>
              </DashboardCard>
            </section>

            <ContentCard>
              <div className="overflow-x-auto">
                <table className="min-w-[1200px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2">Cash</th>
                      <th className="px-3 py-2">Mutual Funds</th>
                      <th className="px-3 py-2">Stocks</th>
                      <th className="px-3 py-2">EPF</th>
                      <th className="px-3 py-2">PPF</th>
                      <th className="px-3 py-2">NPS</th>
                      <th className="px-3 py-2">Financial Assets Total</th>
                      <th className="px-3 py-2">Non-Financial Assets Total</th>
                      <th className="px-3 py-2">Liabilities</th>
                      <th className="px-3 py-2">Net Worth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection.monthRows.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{row.month}</td>
                        <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.cash)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.mutual_funds)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.stocks)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.epf)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.ppf)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.nps)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.financial_assets_total)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.non_financial_assets_total)}</td>
                        <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.liabilities)}</td>
                        <td className="px-3 py-2 text-slate-900">{formatProjectionValue(row.net_worth)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContentCard>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
