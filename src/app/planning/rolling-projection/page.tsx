import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/formatters";
import { createProjectionReadServerService } from "@/services/projection/ProjectionReadService";

function formatProjectionValue(value: number | null) {
  if (value == null) {
    return "Data required";
  }

  return formatCurrency(value, { maximumFractionDigits: 0 });
}

export default async function RollingProjectionPage() {
  const service = createProjectionReadServerService();
  const projection = await service.getLatestLockedRollingProjection().catch(() => null);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Rolling Projection"
          description="Review the latest rolling forecast produced from month-end rebasing."
          summary="Latest forecast rebased from month-end actuals"
        />

        {!projection ? (
          <ContentCard>
            <EmptyState
              title="No Rolling Projection is available yet."
              description="Close a Monthly Review period to generate a Rolling Projection."
            />
          </ContentCard>
        ) : (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <DashboardCard>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rolling Version</p>
                <p className="mt-2 text-base font-semibold text-slate-900">v{projection.plan.version_no}</p>
              </DashboardCard>
              <DashboardCard>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Linked Fixed Plan</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{projection.linkedFixedVersionNo == null ? "Data required" : `v${projection.linkedFixedVersionNo}`}</p>
              </DashboardCard>
              <DashboardCard>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rebased From Month</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{projection.rebasedFromMonth ?? "Data required"}</p>
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
