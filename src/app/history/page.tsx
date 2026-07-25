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
import { calculateDebtRatio } from "@/services/finance";
import { supabase } from "@/lib/supabase/client";
import { snapshotReadModel, snapshotWriteService, type SnapshotHistoryRecord } from "@/services/snapshots";
import type { MonthlySnapshot } from "@/types/monthlySnapshot";

interface HistorySnapshot {
  id: string;
  snapshot_month: number;
  snapshot_year: number;
  status: string;
  assets_total: number;
  liabilities_total: number;
  investments_total: number;
  net_worth: number;
  growth_from_previous_month: number;
  growth_from_previous_year: number;
  cash_and_bank_total: number;
}

interface MonthlyHistoryRecord {
  snapshot: HistorySnapshot;
  monthLabel: string;
}

interface MonthlyComparisonMetric {
  label: string;
  current: number;
  previous: number | null;
  delta: number;
  deltaPercent: number | null;
  tone: "positive" | "warning" | "neutral";
  inverse?: boolean;
}

interface MonthlyComparisonWindow {
  title: string;
  subtitle: string;
  metrics: MonthlyComparisonMetric[];
}

interface MonthlyTrendPoint {
  month: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  investments: number;
}

interface MonthlyReviewInsight {
  title: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}

interface MonthlyHistoryModel {
  records: MonthlyHistoryRecord[];
  latest: MonthlyHistoryRecord | null;
  previousMonth: MonthlyHistoryRecord | null;
  sameMonthLastYear: MonthlyHistoryRecord | null;
  comparisons: MonthlyComparisonWindow[];
  trendData: MonthlyTrendPoint[];
  review: MonthlyReviewInsight[];
  timeline: MonthlyHistoryRecord[];
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function parseMonthKey(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  return {
    snapshot_year: Number(yearText),
    snapshot_month: Number(monthText),
  };
}

function snapshotSort(left: MonthlyHistoryRecord, right: MonthlyHistoryRecord) {
  if (left.snapshot.snapshot_year !== right.snapshot.snapshot_year) {
    return right.snapshot.snapshot_year - left.snapshot.snapshot_year;
  }

  return right.snapshot.snapshot_month - left.snapshot.snapshot_month;
}

function compactRecent(records: MonthlyHistoryRecord[], limit = 12) {
  return [...records].sort((left, right) => (left.snapshot.snapshot_year - right.snapshot.snapshot_year) || (left.snapshot.snapshot_month - right.snapshot.snapshot_month)).slice(-limit);
}

function getSnapshotValue(snapshot: MonthlyHistoryRecord | null, key: "netWorth" | "assets" | "liabilities" | "investments") {
  if (!snapshot) {
    return 0;
  }

  switch (key) {
    case "assets":
      return snapshot.snapshot.assets_total;
    case "liabilities":
      return snapshot.snapshot.liabilities_total;
    case "investments":
      return snapshot.snapshot.investments_total;
    case "netWorth":
    default:
      return snapshot.snapshot.net_worth;
  }
}

function buildMetric(label: string, current: number, previous: number | null, inverse = false): MonthlyComparisonMetric {
  const delta = previous === null ? 0 : current - previous;
  const deltaPercent = previous && previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  const direction = inverse ? -delta : delta;
  const tone: MonthlyComparisonMetric["tone"] = previous === null ? "neutral" : direction > 0 ? "positive" : direction < 0 ? "warning" : "neutral";

  return {
    label,
    current,
    previous,
    delta,
    deltaPercent,
    tone,
    inverse,
  };
}

function formatIndianCurrency(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 10000000) {
    return `${sign}₹${(absolute / 10000000).toFixed(1)} crore`;
  }

  if (absolute >= 100000) {
    return `${sign}₹${(absolute / 100000).toFixed(1)} lakh`;
  }

  return `${sign}₹${absolute.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

async function loadCashTotalsBySnapshotId(records: SnapshotHistoryRecord[]) {
  const snapshotIds = records
    .map((record) => record.metadata.snapshotId)
    .filter((value): value is string => Boolean(value));

  if (snapshotIds.length === 0) {
    return new Map<string, number>();
  }

  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { data, error } = await supabase
    .from("monthly_snapshots")
    .select("id, cash_and_bank_total")
    .in("id", snapshotIds);

  if (error) {
    throw new Error(error.message);
  }

  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    totals.set(String(row.id), toNumber((row as { cash_and_bank_total?: number | string | null }).cash_and_bank_total));
  }

  return totals;
}

function buildHistoryRecords(records: SnapshotHistoryRecord[], cashTotalsBySnapshotId: Map<string, number>): MonthlyHistoryRecord[] {
  const mapped = records.map((record) => {
    const parsed = parseMonthKey(record.monthKey);
    const snapshotId = record.metadata.snapshotId ?? record.monthKey;

    return {
      monthLabel: record.monthLabel,
      snapshot: {
        id: snapshotId,
        snapshot_month: parsed.snapshot_month,
        snapshot_year: parsed.snapshot_year,
        status: record.metadata.status ?? "closed",
        assets_total: toNumber(record.totals.assets),
        liabilities_total: toNumber(record.totals.liabilities),
        investments_total: toNumber(record.totals.investments),
        net_worth: toNumber(record.totals.netWorth),
        growth_from_previous_month: 0,
        growth_from_previous_year: 0,
        cash_and_bank_total: cashTotalsBySnapshotId.get(snapshotId) ?? 0,
      },
    } satisfies MonthlyHistoryRecord;
  }).sort(snapshotSort);

  for (const record of mapped) {
    const previousMonth = mapped.find((candidate) => (
      candidate !== record
      && (
        candidate.snapshot.snapshot_year < record.snapshot.snapshot_year
        || (
          candidate.snapshot.snapshot_year === record.snapshot.snapshot_year
          && candidate.snapshot.snapshot_month < record.snapshot.snapshot_month
        )
      )
    )) ?? null;

    const previousYear = mapped.find((candidate) => (
      candidate.snapshot.snapshot_year === record.snapshot.snapshot_year - 1
      && candidate.snapshot.snapshot_month === record.snapshot.snapshot_month
    )) ?? null;

    record.snapshot.growth_from_previous_month = previousMonth
      ? record.snapshot.net_worth - previousMonth.snapshot.net_worth
      : 0;
    record.snapshot.growth_from_previous_year = previousYear
      ? record.snapshot.net_worth - previousYear.snapshot.net_worth
      : 0;
  }

  return mapped;
}

function buildMonthlyHistoryModel(records: MonthlyHistoryRecord[]): MonthlyHistoryModel {
  const ordered = [...records].sort(snapshotSort);
  const latest = ordered[0] ?? null;
  const previousMonth = latest ? ordered.find((record) => record !== latest && (record.snapshot.snapshot_year < latest.snapshot.snapshot_year || (record.snapshot.snapshot_year === latest.snapshot.snapshot_year && record.snapshot.snapshot_month < latest.snapshot.snapshot_month))) ?? null : null;
  const sameMonthLastYear = latest ? ordered.find((record) => record.snapshot.snapshot_year === latest.snapshot.snapshot_year - 1 && record.snapshot.snapshot_month === latest.snapshot.snapshot_month) ?? null : null;
  const recent = compactRecent(ordered, 12);
  const trendData = recent
    .slice()
    .sort((left, right) => (left.snapshot.snapshot_year - right.snapshot.snapshot_year) || (left.snapshot.snapshot_month - right.snapshot.snapshot_month))
    .map((record) => ({
      month: record.monthLabel,
      netWorth: record.snapshot.net_worth,
      assets: record.snapshot.assets_total,
      liabilities: record.snapshot.liabilities_total,
      investments: record.snapshot.investments_total,
    }));

  const comparisons: MonthlyComparisonWindow[] = [
    {
      title: "Current vs Last Month",
      subtitle: latest ? `${latest.monthLabel} against the previous close` : "No closed month yet",
      metrics: [
        buildMetric("Net worth", getSnapshotValue(latest, "netWorth"), getSnapshotValue(previousMonth, "netWorth")),
        buildMetric("Assets", getSnapshotValue(latest, "assets"), getSnapshotValue(previousMonth, "assets")),
        buildMetric("Liabilities", getSnapshotValue(latest, "liabilities"), getSnapshotValue(previousMonth, "liabilities"), true),
        buildMetric("Investments", getSnapshotValue(latest, "investments"), getSnapshotValue(previousMonth, "investments")),
      ],
    },
    {
      title: "Current vs Same Month Last Year",
      subtitle: latest ? `${latest.monthLabel} year-over-year comparison` : "No closed month yet",
      metrics: [
        buildMetric("Net worth", getSnapshotValue(latest, "netWorth"), getSnapshotValue(sameMonthLastYear, "netWorth")),
        buildMetric("Assets", getSnapshotValue(latest, "assets"), getSnapshotValue(sameMonthLastYear, "assets")),
        buildMetric("Liabilities", getSnapshotValue(latest, "liabilities"), getSnapshotValue(sameMonthLastYear, "liabilities"), true),
        buildMetric("Investments", getSnapshotValue(latest, "investments"), getSnapshotValue(sameMonthLastYear, "investments")),
      ],
    },
  ];

  const review: MonthlyReviewInsight[] = [];

  if (!latest) {
    review.push({ title: "Start the closing cycle", detail: "Close the first month to begin recording historical performance, growth, and debt movement.", tone: "neutral" });
  } else {
    const netWorthDelta = latest.snapshot.growth_from_previous_month;
    const liabilityDelta = latest.snapshot.liabilities_total - (previousMonth?.snapshot.liabilities_total ?? latest.snapshot.liabilities_total);
    const investmentShare = latest.snapshot.assets_total + latest.snapshot.investments_total > 0 ? latest.snapshot.investments_total / (latest.snapshot.assets_total + latest.snapshot.investments_total) : 0;
    const previousInvestmentShare = previousMonth && previousMonth.snapshot.assets_total + previousMonth.snapshot.investments_total > 0
      ? previousMonth.snapshot.investments_total / (previousMonth.snapshot.assets_total + previousMonth.snapshot.investments_total)
      : investmentShare;
    const cashShare = latest.snapshot.cash_and_bank_total / Math.max(latest.snapshot.assets_total, 1);
    const debtRatio = calculateDebtRatio(latest.snapshot.assets_total + latest.snapshot.investments_total, latest.snapshot.liabilities_total);
    const previousDebtRatio = previousMonth ? calculateDebtRatio(previousMonth.snapshot.assets_total + previousMonth.snapshot.investments_total, previousMonth.snapshot.liabilities_total) : debtRatio;

    review.push({
      title: netWorthDelta >= 0 ? "Net worth improved" : "Net worth softened",
      detail: `${netWorthDelta >= 0 ? "Net worth increased by" : "Net worth declined by"} ${formatIndianCurrency(Math.abs(netWorthDelta))} since the last close.`,
      tone: netWorthDelta >= 0 ? "positive" : "warning",
    });

    if (liabilityDelta !== 0) {
      review.push({
        title: liabilityDelta < 0 ? "Debt balance reduced" : "Debt balance moved higher",
        detail: `${liabilityDelta < 0 ? "Liabilities reduced by" : "Liabilities increased by"} ${formatIndianCurrency(Math.abs(liabilityDelta))} versus the prior month.`,
        tone: liabilityDelta < 0 ? "positive" : "warning",
      });
    }

    if (investmentShare > previousInvestmentShare + 0.02) {
      review.push({
        title: "Investment allocation increased",
        detail: `Investments now represent ${(investmentShare * 100).toFixed(0)}% of combined assets and investments, up from ${(previousInvestmentShare * 100).toFixed(0)}% last month.`,
        tone: "positive",
      });
    }

    if (cashShare >= 0.25) {
      review.push({
        title: "Cash exceeds target",
        detail: `Liquid reserves sit at ${(cashShare * 100).toFixed(0)}% of total assets, which gives the board room for near-term flexibility.`,
        tone: "positive",
      });
    }

    if (debtRatio < previousDebtRatio) {
      review.push({
        title: "Debt ratio improved",
        detail: `Debt ratio moved from ${(previousDebtRatio * 100).toFixed(1)}% to ${(debtRatio * 100).toFixed(1)}%.`,
        tone: "positive",
      });
    }

    if (sameMonthLastYear) {
      const yearOverYearDelta = latest.snapshot.net_worth - sameMonthLastYear.snapshot.net_worth;
      review.push({
        title: "Year-over-year context",
        detail: `${yearOverYearDelta >= 0 ? "Net worth is up" : "Net worth is down"} ${formatIndianCurrency(Math.abs(yearOverYearDelta))} compared with the same month last year.`,
        tone: yearOverYearDelta >= 0 ? "positive" : "warning",
      });
    }
  }

  return {
    records: ordered,
    latest,
    previousMonth,
    sameMonthLastYear,
    comparisons,
    trendData,
    review: review.slice(0, 4),
    timeline: ordered.slice(0, 6),
  };
}

async function loadHistoryRecords() {
  const snapshotHistory = await snapshotReadModel.loadHistory({ source: "legacy-monthly-snapshot" });
  const cashTotalsBySnapshotId = await loadCashTotalsBySnapshotId(snapshotHistory);
  return buildHistoryRecords(snapshotHistory, cashTotalsBySnapshotId);
}

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

function isSameCalendarMonth(snapshot: { snapshot_month: number; snapshot_year: number } | null) {
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
      const history = await loadHistoryRecords();
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
        const history = await loadHistoryRecords();
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
      const snapshot = await snapshotWriteService.closeCurrentMonthSnapshot();
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
