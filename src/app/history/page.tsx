"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRightLeft, CalendarCheck2, CheckCircle2, Clock3, LineChart as LineChartIcon, ShieldCheck } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import {
  buildMonthlyHistoryModel,
  closeCurrentMonthSnapshot,
  getMonthlyHistory,
  type MonthlyComparisonWindow,
  type MonthlyHistoryRecord,
  type MonthlyReviewInsight,
  type MonthlyTrendPoint,
} from "@/services/monthlySnapshots";
import type { MonthlySnapshot } from "@/types/monthlySnapshot";

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
}

function monthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function isSameCalendarMonth(snapshot: MonthlySnapshot | null) {
  if (!snapshot) {
    return false;
  }

  const now = new Date();
  return snapshot.snapshot_month === now.getMonth() + 1 && snapshot.snapshot_year === now.getFullYear();
}

function metricToneClasses(tone: "positive" | "warning" | "neutral") {
  if (tone === "positive") {
    return "text-emerald-700";
  }

  if (tone === "warning") {
    return "text-rose-700";
  }

  return "text-slate-700";
}

function TrendCard({
  title,
  subtitle,
  data,
  dataKey,
  color,
  type,
}: {
  title: string;
  subtitle: string;
  data: MonthlyTrendPoint[];
  dataKey: "netWorth" | "assets" | "liabilities" | "investments";
  color: string;
  type: "area" | "line";
}) {
  return (
    <DashboardCard>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === "area" ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`${dataKey}Fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value) => formatInr(Number(value ?? 0))} />
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${dataKey}Fill)`} strokeWidth={2.5} />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value) => formatInr(Number(value ?? 0))} />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}

function ComparisonCard({ window }: { window: MonthlyComparisonWindow }) {
  return (
    <DashboardCard>
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{window.title}</h3>
        <p className="text-sm text-slate-600">{window.subtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {window.metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatInr(metric.current)}</p>
            <p className="text-xs text-slate-500">Baseline: {metric.previous === null ? "Not available" : formatInr(metric.previous)}</p>
            <p className={`mt-2 text-sm font-medium ${metricToneClasses(metric.tone)}`}>
              {metric.previous === null
                ? "Waiting for baseline month"
                : `${metric.delta >= 0 ? "+" : "-"}${formatInr(Math.abs(metric.delta))} (${formatPercent(metric.deltaPercent)})`}
            </p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function BoardReview({ review }: { review: MonthlyReviewInsight[] }) {
  return (
    <DashboardCard>
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-slate-700" />
        <h3 className="text-base font-semibold text-slate-900">Monthly Board Review</h3>
      </div>
      <div className="space-y-3">
        {review.map((item) => (
          <div key={item.title} className="rounded-xl border border-slate-200 p-3">
            <p className={`text-sm font-semibold ${metricToneClasses(item.tone)}`}>{item.title}</p>
            <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-6">
      <DashboardCard>
        <LoadingSpinner label="Loading monthly snapshots..." />
      </DashboardCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardCard className="h-64 animate-pulse bg-slate-100">
          <div />
        </DashboardCard>
        <DashboardCard className="h-64 animate-pulse bg-slate-100">
          <div />
        </DashboardCard>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardCard className="h-72 animate-pulse bg-slate-100">
          <div />
        </DashboardCard>
        <DashboardCard className="h-72 animate-pulse bg-slate-100">
          <div />
        </DashboardCard>
      </div>
    </div>
  );
}

function Timeline({ records }: { records: MonthlyHistoryRecord[] }) {
  return (
    <DashboardCard>
      <div className="mb-4 flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-slate-700" />
        <h3 className="text-base font-semibold text-slate-900">Professional Timeline</h3>
      </div>
      <div className="space-y-4">
        {records.map((record, index) => (
          <div key={record.snapshot.id} className="relative pl-8">
            {index < records.length - 1 ? <span className="absolute left-3 top-6 h-[calc(100%+0.5rem)] w-px bg-slate-200" /> : null}
            <span className="absolute left-1 top-1.5 h-4 w-4 rounded-full border-2 border-slate-200 bg-emerald-500" />
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-900">{record.monthLabel}</p>
                <p className="text-xs uppercase tracking-wide text-emerald-700">{record.snapshot.status}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">Net worth closed at {formatInr(record.snapshot.net_worth)}.</p>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

export default function HistoryPage() {
  const [records, setRecords] = useState<MonthlyHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [closedSnapshot, setClosedSnapshot] = useState<MonthlySnapshot | null>(null);

  async function refreshHistory() {
    try {
      setLoading(true);
      const history = await getMonthlyHistory();
      setRecords(history);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load monthly history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialHistory() {
      try {
        const history = await getMonthlyHistory();
        if (isMounted) {
          setRecords(history);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load monthly history");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadInitialHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(null), 4500);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const model = useMemo(() => buildMonthlyHistoryModel(records), [records]);
  const latestSnapshot = model.latest?.snapshot ?? null;
  const currentMonthClosed = isSameCalendarMonth(latestSnapshot);
  const closeMonthLabel = monthLabel(new Date().getMonth() + 1, new Date().getFullYear());

  async function handleCloseMonth() {
    setClosing(true);
    setError(null);
    setNotice(null);

    try {
      const snapshot = await closeCurrentMonthSnapshot();
      setClosedSnapshot(snapshot);
      setNotice(`Month closed successfully for ${monthLabel(snapshot.snapshot_month, snapshot.snapshot_year)}.`);
      await refreshHistory();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to close month");
    } finally {
      setClosing(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="History"
            description="Monthly financial closing and snapshots for net worth, debt movement, investment growth, and board-ready review."
          />
          <Button onClick={() => setCloseDialogOpen(true)} disabled={closing || currentMonthClosed}>
            {currentMonthClosed ? "Month Already Closed" : "Close Month"}
          </Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        <Dialog
          open={closeDialogOpen}
          onOpenChange={(nextOpen) => {
            setCloseDialogOpen(nextOpen);
            if (!nextOpen) {
              setClosedSnapshot(null);
            }
          }}
        >
          <DialogContent>
            {closedSnapshot ? (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Confirmation Screen</DialogTitle>
                </DialogHeader>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5" />
                    <div>
                      <p className="font-semibold">{monthLabel(closedSnapshot.snapshot_month, closedSnapshot.snapshot_year)} has been closed.</p>
                      <p className="mt-1 text-sm">Historical data has been captured without overwriting previous months.</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <p>Assets: {formatInr(closedSnapshot.assets_total)}</p>
                  <p>Investments: {formatInr(closedSnapshot.investments_total)}</p>
                  <p>Liabilities: {formatInr(closedSnapshot.liabilities_total)}</p>
                  <p>Net Worth: {formatInr(closedSnapshot.net_worth)}</p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setCloseDialogOpen(false)}>Done</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <DialogHeader>
                  <DialogTitle>Financial Closing Dialog</DialogTitle>
                </DialogHeader>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Close month for {closeMonthLabel}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    This workflow captures all Assets, Investments, and Liabilities into immutable monthly snapshot tables.
                    If this month is already closed, the system will block duplicate closing.
                  </p>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>1. Capture all Assets</p>
                  <p>2. Capture all Investments</p>
                  <p>3. Capture all Liabilities</p>
                  <p>4. Save snapshots and summary</p>
                  <p>5. Confirm close status</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCloseDialogOpen(false)} disabled={closing}>
                    Cancel
                  </Button>
                  <Button onClick={handleCloseMonth} disabled={closing || currentMonthClosed}>
                    {closing ? "Closing..." : "Confirm Close Month"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {loading ? (
          <HistorySkeleton />
        ) : records.length === 0 ? (
          <DashboardCard>
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <CalendarCheck2 className="h-5 w-5 text-slate-700" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">No Month Closed Yet</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Start the monthly closing cycle to build historical snapshots for board review, trend charts, and comparison analytics.
              </p>
              <Button className="mt-4" onClick={() => setCloseDialogOpen(true)}>
                Start with Close Month
              </Button>
            </div>
          </DashboardCard>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard>
                <p className="text-xs uppercase tracking-wide text-slate-500">Latest Closed Month</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{model.latest?.monthLabel ?? "-"}</p>
              </DashboardCard>
              <DashboardCard>
                <p className="text-xs uppercase tracking-wide text-slate-500">Net Worth</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{formatInr(model.latest?.snapshot.net_worth ?? 0)}</p>
              </DashboardCard>
              <DashboardCard>
                <p className="text-xs uppercase tracking-wide text-slate-500">Month Growth</p>
                <p className={`mt-2 text-xl font-semibold ${(model.latest?.snapshot.growth_from_previous_month ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {(model.latest?.snapshot.growth_from_previous_month ?? 0) >= 0 ? "+" : "-"}
                  {formatInr(Math.abs(model.latest?.snapshot.growth_from_previous_month ?? 0))}
                </p>
              </DashboardCard>
              <DashboardCard>
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {model.latest?.snapshot.status ?? "closed"}
                </div>
              </DashboardCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardCard>
                <div className="mb-4 flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-slate-700" />
                  <h3 className="text-base font-semibold text-slate-900">Month History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-2 py-2">Month</th>
                        <th className="px-2 py-2">Net Worth</th>
                        <th className="px-2 py-2">Assets</th>
                        <th className="px-2 py-2">Liabilities</th>
                        <th className="px-2 py-2">Investments</th>
                        <th className="px-2 py-2">Growth</th>
                        <th className="px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.records.map((record) => (
                        <tr key={record.snapshot.id} className="border-b border-slate-100">
                          <td className="px-2 py-2 font-medium text-slate-900">{record.monthLabel}</td>
                          <td className="px-2 py-2 text-slate-700">{formatInr(record.snapshot.net_worth)}</td>
                          <td className="px-2 py-2 text-slate-700">{formatInr(record.snapshot.assets_total)}</td>
                          <td className="px-2 py-2 text-slate-700">{formatInr(record.snapshot.liabilities_total)}</td>
                          <td className="px-2 py-2 text-slate-700">{formatInr(record.snapshot.investments_total)}</td>
                          <td className={`px-2 py-2 font-medium ${record.snapshot.growth_from_previous_month >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {record.snapshot.growth_from_previous_month >= 0 ? "+" : "-"}
                            {formatInr(Math.abs(record.snapshot.growth_from_previous_month))}
                          </td>
                          <td className="px-2 py-2">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium uppercase text-emerald-700">
                              {record.snapshot.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DashboardCard>

              <Timeline records={model.timeline} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {model.comparisons.map((window) => (
                <ComparisonCard key={window.title} window={window} />
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <TrendCard
                title="Net Worth Trend"
                subtitle="Closed month trajectory"
                data={model.trendData}
                dataKey="netWorth"
                color="#0f172a"
                type="area"
              />
              <TrendCard
                title="Asset Growth"
                subtitle="Asset base trend month by month"
                data={model.trendData}
                dataKey="assets"
                color="#0f766e"
                type="line"
              />
              <TrendCard
                title="Debt Reduction"
                subtitle="Liability balance over time"
                data={model.trendData}
                dataKey="liabilities"
                color="#be123c"
                type="line"
              />
              <TrendCard
                title="Investment Growth"
                subtitle="Investment portfolio trend"
                data={model.trendData}
                dataKey="investments"
                color="#4338ca"
                type="area"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <DashboardCard>
                <div className="mb-3 flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-slate-700" />
                  <h3 className="text-base font-semibold text-slate-900">Executive Summary</h3>
                </div>
                <p className="text-sm text-slate-600">
                  Monthly closing gives leadership a consistent baseline to review net worth trajectory, debt changes,
                  investment positioning, and liquidity posture without overwriting history.
                </p>
                <div className="mt-4 space-y-2">
                  {model.review.map((insight) => (
                    <div key={insight.title} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm">
                      <p className={`font-semibold ${metricToneClasses(insight.tone)}`}>{insight.title}</p>
                      <p className="mt-0.5 text-slate-600">{insight.detail}</p>
                    </div>
                  ))}
                </div>
              </DashboardCard>

              <BoardReview review={model.review} />
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
