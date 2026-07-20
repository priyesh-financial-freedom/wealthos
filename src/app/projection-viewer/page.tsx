"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Calculator, CalendarRange, Search, TrendingUp } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { assumptionsService, DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import { projectionEventsService, projectionEngine, type ProjectionResult } from "@/services/projection";
import type { MonthlyLedgerEntry, MonthlySnapshot, ProjectedEntity, ProjectionScenario } from "@/types/projection";

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function monthLabel(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function numberTone(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-600";
}

function balanceTile(label: string, value: number) {
  return (
    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{formatInr(value)}</p>
    </div>
  );
}

function LedgerTable({ entries }: { entries: MonthlyLedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No ledger entries for this month.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="max-h-80 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Type</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Event</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Target</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Source</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Amount</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Base</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Monthly Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {entries.map((entry) => (
              <tr key={`${entry.eventId}:${entry.entryType}:${entry.amount}:${entry.month}`}>
                <td className="px-3 py-2 text-slate-700">{entry.entryType}</td>
                <td className="px-3 py-2 text-slate-900">{entry.eventName}</td>
                <td className="px-3 py-2 capitalize text-slate-700">{entry.target}</td>
                <td className="px-3 py-2 capitalize text-slate-700">{entry.source}</td>
                <td className={`px-3 py-2 text-right font-medium ${numberTone(entry.amount)}`}>{formatInr(entry.amount)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{entry.baseAmount ? formatInr(entry.baseAmount) : "-"}</td>
                <td className="px-3 py-2 text-right text-slate-700">{entry.monthlyRate ? `${(entry.monthlyRate * 100).toFixed(3)}%` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectedEntitiesTable({ entities }: { entities: ProjectedEntity[] }) {
  if (entities.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No projected entities for this month.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="max-h-80 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Entity</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Kind</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Opening</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Contribution</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Growth</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Other</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {entities.map((entity) => (
              <tr key={entity.id}>
                <td className="px-3 py-2 text-slate-900">{entity.name}</td>
                <td className="px-3 py-2 text-slate-700">{entity.kind}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatInr(entity.openingBalance)}</td>
                <td className={`px-3 py-2 text-right ${numberTone(entity.contributionActivity)}`}>{formatInr(entity.contributionActivity)}</td>
                <td className={`px-3 py-2 text-right ${numberTone(entity.growthActivity)}`}>{formatInr(entity.growthActivity)}</td>
                <td className={`px-3 py-2 text-right ${numberTone(entity.otherActivity)}`}>{formatInr(entity.otherActivity)}</td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">{formatInr(entity.closingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProjectionViewerPage() {
  const [projection, setProjection] = useState<ProjectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  async function loadProjection() {
    try {
      setLoading(true);
      setError(null);

      const assumptionsBundle = await assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY);
      const events = await projectionEventsService.listEvents(DEFAULT_SCENARIO_KEY).catch(() => []);

      const scenario: ProjectionScenario = {
        id: DEFAULT_SCENARIO_KEY,
        name: "Default projection",
        description: "In-memory projection viewer for debugging.",
        startMonth: assumptionsBundle.planning.startMonth,
        planningHorizonYear: assumptionsBundle.planning.endYear,
        assumptions: [],
        events,
        isDefault: true,
      };

      const result = await projectionEngine.runProjection(scenario);
      setProjection(result);

      const latest = result.snapshots[result.snapshots.length - 1];
      setSelectedMonthKey(latest?.month ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run projection");
      setProjection(null);
      setSelectedMonthKey(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjection();
  }, []);

  const snapshots = projection?.snapshots ?? [];

  const selectedSnapshot = useMemo(() => {
    if (!selectedMonthKey) {
      return null;
    }

    return snapshots.find((snapshot) => snapshot.month === selectedMonthKey) ?? null;
  }, [selectedMonthKey, snapshots]);

  const summary = useMemo(() => {
    if (snapshots.length === 0) {
      return null;
    }

    const first = snapshots[0];
    const latest = snapshots[snapshots.length - 1];

    return {
      first,
      latest,
      netWorthDelta: latest.closingBalances.netWorth - first.openingBalances.netWorth,
      assetDelta: latest.closingBalances.assets - first.openingBalances.assets,
      liabilityDelta: latest.closingBalances.liabilities - first.openingBalances.liabilities,
    };
  }, [snapshots]);

  const trendData = useMemo(
    () => snapshots.map((snapshot) => ({
      month: monthLabel(snapshot.month),
      netWorth: snapshot.closingBalances.netWorth,
      assets: snapshot.closingBalances.assets,
      liabilities: snapshot.closingBalances.liabilities,
    })),
    [snapshots],
  );

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Projection Viewer"
          description="Read-only validation screen for projection timeline, ledger execution, and monthly balance transitions."
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Scenario: <span className="font-medium text-slate-900">{projection?.scenario.name ?? "Default projection"}</span> · Mode: <span className="font-medium text-slate-900">Read-only, in-memory output</span>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        {loading ? <LoadingSpinner label="Running projection engine..." /> : null}

        {!loading && !projection ? (
          <DashboardCard>
            <p className="text-sm text-slate-600">Projection data is not available.</p>
          </DashboardCard>
        ) : null}

        {!loading && summary ? (
          <>
            <div className="grid gap-4 lg:grid-cols-4">
              <DashboardCard className="p-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-wide">Final Net Worth</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatInr(summary.latest.closingBalances.netWorth)}</p>
                <p className={`text-sm ${numberTone(summary.netWorthDelta)}`}>{summary.netWorthDelta >= 0 ? "+" : ""}{formatInr(summary.netWorthDelta)} from start</p>
              </DashboardCard>

              <DashboardCard className="p-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <Activity className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-wide">Final Assets</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatInr(summary.latest.closingBalances.assets)}</p>
                <p className={`text-sm ${numberTone(summary.assetDelta)}`}>{summary.assetDelta >= 0 ? "+" : ""}{formatInr(summary.assetDelta)} from start</p>
              </DashboardCard>

              <DashboardCard className="p-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calculator className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-wide">Final Liabilities</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatInr(summary.latest.closingBalances.liabilities)}</p>
                <p className={`text-sm ${numberTone(summary.liabilityDelta)}`}>{summary.liabilityDelta >= 0 ? "+" : ""}{formatInr(summary.liabilityDelta)} from start</p>
              </DashboardCard>

              <DashboardCard className="p-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <CalendarRange className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-wide">Timeline</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{snapshots.length}</p>
                <p className="text-sm text-slate-600">months · {summary.first.month} to {summary.latest.month}</p>
              </DashboardCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardCard>
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-slate-900">Net Worth Trend</h3>
                  <p className="text-sm text-slate-600">Monthly closing net worth from projection output.</p>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="projectionNetWorthFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => formatCompact(Number(value ?? 0))} />
                      <Tooltip formatter={(value) => formatInr(Number(value ?? 0))} />
                      <Area type="monotone" dataKey="netWorth" stroke="#0f766e" fill="url(#projectionNetWorthFill)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </DashboardCard>

              <DashboardCard>
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-slate-900">Assets vs Liabilities</h3>
                  <p className="text-sm text-slate-600">Closing monthly totals used in net worth movement.</p>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => formatCompact(Number(value ?? 0))} />
                      <Tooltip formatter={(value) => formatInr(Number(value ?? 0))} />
                      <Line type="monotone" dataKey="assets" stroke="#1d4ed8" strokeWidth={2.3} dot={false} />
                      <Line type="monotone" dataKey="liabilities" stroke="#dc2626" strokeWidth={2.3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </DashboardCard>
            </div>

            <DashboardCard>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900">Monthly Timeline</h3>
                <p className="text-sm text-slate-600">Opening balances, ledger execution, and closing balances for each month.</p>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Month</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Opening Net Worth</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Opening Assets</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Opening Liabilities</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Projected Entities</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Ledger Entries</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Growth</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Closing Net Worth</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Drill-down</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {snapshots.map((snapshot) => (
                      <tr key={snapshot.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">{monthLabel(snapshot.month)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatInr(snapshot.openingBalances.netWorth)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatInr(snapshot.openingBalances.assets)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatInr(snapshot.openingBalances.liabilities)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{snapshot.projectedEntities.length}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{snapshot.monthlyLedger.length}</td>
                        <td className={`px-3 py-2 text-right font-medium ${numberTone(snapshot.growth)}`}>{formatInr(snapshot.growth)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatInr(snapshot.closingBalances.netWorth)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            onClick={() => {
                              setSelectedMonthKey(snapshot.month);
                              setDrillDownOpen(true);
                            }}
                          >
                            <Search className="h-3.5 w-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashboardCard>
          </>
        ) : null}

        <Dialog open={drillDownOpen} onOpenChange={setDrillDownOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{selectedSnapshot ? `Projection Drill-down · ${monthLabel(selectedSnapshot.month)}` : "Projection Drill-down"}</DialogTitle>
            </DialogHeader>

            {selectedSnapshot ? (
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Opening Balances</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {balanceTile("Assets", selectedSnapshot.openingBalances.assets)}
                      {balanceTile("Liabilities", selectedSnapshot.openingBalances.liabilities)}
                      {balanceTile("Investments", selectedSnapshot.openingBalances.investments)}
                      {balanceTile("Retirement", selectedSnapshot.openingBalances.retirement)}
                      {balanceTile("Cash", selectedSnapshot.openingBalances.cash)}
                      {balanceTile("Net Worth", selectedSnapshot.openingBalances.netWorth)}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Closing Balances</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {balanceTile("Assets", selectedSnapshot.closingBalances.assets)}
                      {balanceTile("Liabilities", selectedSnapshot.closingBalances.liabilities)}
                      {balanceTile("Investments", selectedSnapshot.closingBalances.investments)}
                      {balanceTile("Retirement", selectedSnapshot.closingBalances.retirement)}
                      {balanceTile("Cash", selectedSnapshot.closingBalances.cash)}
                      {balanceTile("Net Worth", selectedSnapshot.closingBalances.netWorth)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Contributions</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{formatInr(selectedSnapshot.contributions)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Growth</p>
                    <p className={`mt-1 text-base font-semibold ${numberTone(selectedSnapshot.growth)}`}>{formatInr(selectedSnapshot.growth)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Ledger Entries</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{selectedSnapshot.monthlyLedger.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Events Applied</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{selectedSnapshot.eventsApplied.length}</p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Projected Entities</h4>
                  <ProjectedEntitiesTable entities={selectedSnapshot.projectedEntities} />
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Monthly Ledger</h4>
                  <LedgerTable entries={selectedSnapshot.monthlyLedger} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">No month selected.</p>
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AppLayout>
  );
}
