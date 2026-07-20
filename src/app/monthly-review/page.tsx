"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, CalendarRange, Scale, TrendingDown, TrendingUp } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { monthlyReviewService, type MonthlyReviewEntityComparison, type MonthlyReviewWorkspace } from "@/services/projection/MonthlyReviewService";

function tone(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-700";
}

function displayPercent(value: number | null) {
  return value === null ? "—" : formatPercent(value, { digits: 1, multiply: false });
}

function ContributorList({ items }: { items: MonthlyReviewEntityComparison[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No contribution data available.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.rowKey} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">{item.entityName}</p>
              <p className="text-xs text-slate-500">{item.entityTypeLabel}</p>
            </div>
            <p className={`text-sm font-semibold ${tone(item.netWorthChangeContribution)}`}>{formatCurrency(item.netWorthChangeContribution, { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryCards({ workspace }: { workspace: MonthlyReviewWorkspace }) {
  const summary = workspace.summary;

  if (!summary) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <DashboardCard>
        <div className="flex items-center gap-2 text-slate-600">
          <CalendarRange className="h-4 w-4" />
          <p className="text-xs uppercase tracking-wide">Closed Period</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-slate-900">{workspace.selectedPeriod?.label ?? "—"}</p>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center gap-2 text-slate-600">
          <Scale className="h-4 w-4" />
          <p className="text-xs uppercase tracking-wide">Net Worth</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(summary.netWorth, { maximumFractionDigits: 0 })}</p>
        <p className={`mt-1 text-sm ${tone(summary.projectionVariance)}`}>{formatCurrency(summary.projectionVariance, { maximumFractionDigits: 0 })} vs projection</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Total Assets</p>
        <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(summary.totalAssets, { maximumFractionDigits: 0 })}</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Total Liabilities</p>
        <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(summary.totalLiabilities, { maximumFractionDigits: 0 })}</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Month-over-Month Change</p>
        <p className={`mt-2 text-xl font-semibold ${tone(summary.monthOverMonthChange)}`}>{formatCurrency(summary.monthOverMonthChange, { maximumFractionDigits: 0 })}</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Year-to-Date Change</p>
        <p className={`mt-2 text-xl font-semibold ${tone(summary.yearToDateChange)}`}>{formatCurrency(summary.yearToDateChange, { maximumFractionDigits: 0 })}</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Largest Positive Variance</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">{summary.largestPositiveVariance?.entityName ?? "—"}</p>
        <p className={`mt-1 text-sm ${tone(summary.largestPositiveVariance?.absoluteVariance ?? 0)}`}>{summary.largestPositiveVariance ? formatCurrency(summary.largestPositiveVariance.absoluteVariance, { maximumFractionDigits: 0 }) : "—"}</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Largest Negative Variance</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">{summary.largestNegativeVariance?.entityName ?? "—"}</p>
        <p className={`mt-1 text-sm ${tone(summary.largestNegativeVariance?.absoluteVariance ?? 0)}`}>{summary.largestNegativeVariance ? formatCurrency(summary.largestNegativeVariance.absoluteVariance, { maximumFractionDigits: 0 }) : "—"}</p>
      </DashboardCard>
    </div>
  );
}

function KpiTable({ workspace }: { workspace: MonthlyReviewWorkspace }) {
  return (
    <DashboardCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-900">KPI Comparison</h3>
        <p className="text-sm text-slate-500">Projected versus actual performance across capital buckets and total balance sheet metrics.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">KPI</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Projected</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actual</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Absolute Variance</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Variance %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {workspace.kpis.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.projected, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.actual, { maximumFractionDigits: 0 })}</td>
                <td className={`px-4 py-3 text-right font-medium ${tone(row.absoluteVariance)}`}>{formatCurrency(row.absoluteVariance, { maximumFractionDigits: 0 })}</td>
                <td className={`px-4 py-3 text-right font-medium ${tone(row.absoluteVariance)}`}>{displayPercent(row.percentageVariance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

function EntityTable({ rows }: { rows: MonthlyReviewEntityComparison[] }) {
  return (
    <DashboardCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-900">Entity Review</h3>
        <p className="text-sm text-slate-500">Read-only comparison for every closed-period financial entity.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Entity</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Bucket</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Opening</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Projected</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actual</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Absolute Variance</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Variance %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row) => (
              <tr key={row.rowKey}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{row.entityName}</p>
                  <p className="text-xs text-slate-500">{row.entityTypeLabel}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.itemLabel}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.openingValue, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.projectedValue, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.actualValue, { maximumFractionDigits: 0 })}</td>
                <td className={`px-4 py-3 text-right font-medium ${tone(row.absoluteVariance)}`}>{formatCurrency(row.absoluteVariance, { maximumFractionDigits: 0 })}</td>
                <td className={`px-4 py-3 text-right font-medium ${tone(row.absoluteVariance)}`}>{displayPercent(row.percentageVariance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

export default function MonthlyReviewPage() {
  const [workspace, setWorkspace] = useState<MonthlyReviewWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCloseId, setSelectedCloseId] = useState<string>("");

  async function loadWorkspace(closeId?: string) {
    try {
      setLoading(true);
      setError(null);
      const nextWorkspace = await monthlyReviewService.getMonthlyReviewWorkspace(closeId);
      setWorkspace(nextWorkspace);
      setSelectedCloseId(nextWorkspace.selectedPeriod?.closeId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load monthly review");
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const assetRows = useMemo(() => (workspace?.entities ?? []).filter((row) => row.itemType === "asset"), [workspace]);
  const liabilityRows = useMemo(() => (workspace?.entities ?? []).filter((row) => row.itemType === "liability"), [workspace]);

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Monthly Review"
            description="Read-only comparison of the projection universe against closed actual month-end snapshots for every entity and KPI."
          />
          <div className="w-full max-w-xs">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Closed Period</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedCloseId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedCloseId(value);
                void loadWorkspace(value);
              }}
              disabled={loading || (workspace?.periods.length ?? 0) === 0}
            >
              {(workspace?.periods ?? []).map((period) => (
                <option key={period.closeId} value={period.closeId}>{period.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        {loading ? <LoadingSpinner label="Loading monthly review..." /> : null}

        {!loading && workspace && workspace.selectedPeriod === null ? (
          <DashboardCard>
            <p className="text-sm text-slate-600">No closed month-end periods are available yet.</p>
          </DashboardCard>
        ) : null}

        {!loading && workspace && workspace.summary ? (
          <div className="space-y-6">
            <SummaryCards workspace={workspace} />

            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardCard>
                <div className="mb-4 flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-slate-600" />
                  <h3 className="text-base font-semibold text-slate-900">Top Contributors To Net Worth Change</h3>
                </div>
                <ContributorList items={workspace.summary.topContributors} />
              </DashboardCard>

              <DashboardCard>
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                  <h3 className="text-base font-semibold text-slate-900">Executive Highlights</h3>
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    Projection variance is <span className={tone(workspace.summary.projectionVariance)}>{formatCurrency(workspace.summary.projectionVariance, { maximumFractionDigits: 0 })}</span> against the closed period baseline.
                  </p>
                  <p>
                    Month-over-month net worth moved <span className={tone(workspace.summary.monthOverMonthChange)}>{formatCurrency(workspace.summary.monthOverMonthChange, { maximumFractionDigits: 0 })}</span>.
                  </p>
                  <p>
                    Year-to-date net worth moved <span className={tone(workspace.summary.yearToDateChange)}>{formatCurrency(workspace.summary.yearToDateChange, { maximumFractionDigits: 0 })}</span>.
                  </p>
                  <p>
                    Largest positive variance: <span className="font-medium text-slate-900">{workspace.summary.largestPositiveVariance?.entityName ?? "—"}</span>.
                  </p>
                  <p>
                    Largest negative variance: <span className="font-medium text-slate-900">{workspace.summary.largestNegativeVariance?.entityName ?? "—"}</span>.
                  </p>
                </div>
              </DashboardCard>
            </div>

            <KpiTable workspace={workspace} />
            <EntityTable rows={assetRows} />
            <EntityTable rows={liabilityRows} />
          </div>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}