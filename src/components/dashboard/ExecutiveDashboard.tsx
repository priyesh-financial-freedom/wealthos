"use client";

import Link from "next/link";
import { memo, useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Banknote,
  ChevronRight,
  CircleDollarSign,
  LineChart,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet2,
} from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/feedback";
import { formatCurrency, truncateLabel } from "@/lib/formatters";
import { calculateTotalAssetBase } from "@/services/finance";
import type { Asset } from "@/types/asset";
import type { Investment } from "@/types/investment";
import type {
  DashboardTrendPoint,
  ExecutiveInsight,
  FinanceSummarySnapshot,
  FinancialHealthSnapshot,
} from "@/services/finance";
import type { MonthlyHistoryModel } from "@/services/monthlySnapshots";
import type { RetirementExecutiveSummary } from "@/types/retirementAccount";

interface ActivityItem {
  title: string;
  detail: string;
  time: string;
}

interface ExecutiveDashboardProps {
  loading: boolean;
  emptyState: boolean;
  summary: FinanceSummarySnapshot;
  health: FinancialHealthSnapshot;
  historyModel: MonthlyHistoryModel;
  trendData: DashboardTrendPoint[];
  topAssets: Asset[];
  topInvestments: Investment[];
  insights: ExecutiveInsight[];
  activityItems: ActivityItem[];
  retirementSummary?: RetirementExecutiveSummary | null;
}

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

const MetricCard = memo(function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Banknote;
  tone?: "default" | "positive" | "warning";
}) {
  const toneStyles = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <DashboardCard className={`transition-all duration-300 hover:-translate-y-1 ${toneStyles[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{detail}</p>
    </DashboardCard>
  );
});

const InsightCard = memo(function InsightCard({ insight }: { insight: ExecutiveInsight }) {
  const toneStyles = {
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    neutral: "border-slate-200 bg-slate-50 text-slate-900",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 ${toneStyles[insight.tone]}`}>
      <p className="text-sm font-semibold">{insight.title}</p>
      <p className="mt-2 text-sm opacity-90">{insight.detail}</p>
    </div>
  );
});

const TimelineRow = memo(function TimelineRow({ item }: { item: ActivityItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{item.title}</p>
          <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{item.time}</span>
      </div>
    </div>
  );
});

const TrendChartCard = memo(function TrendChartCard({ data }: { data: DashboardTrendPoint[] }) {
  const gradientId = useId();

  return (
    <DashboardCard className="h-full">
      <div className="mb-4 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Net Worth Trend</h3>
            <p className="text-sm text-slate-600">Monthly snapshots across assets, investments, and liabilities</p>
          </div>
          <LineChart className="h-4 w-4 text-slate-400" />
        </div>
      </div>
      {data.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
          Close a month to unlock this historical view.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`${gradientId}-networth`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id={`${gradientId}-investments`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => truncateLabel(String(value), 10)} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} labelFormatter={(value) => String(value)} />
              <Area type="monotone" dataKey="netWorth" stroke="#0f172a" fill={`url(#${gradientId}-networth)`} strokeWidth={2.5} />
              <Area type="monotone" dataKey="investments" stroke="#0f766e" fill={`url(#${gradientId}-investments)`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardCard>
  );
});

const GrowthChartCard = memo(function GrowthChartCard({ data }: { data: MonthlyHistoryModel["records"] }) {
  const growthData = [...data]
    .slice()
    .sort((left, right) => (left.snapshot.snapshot_year - right.snapshot.snapshot_year) || (left.snapshot.snapshot_month - right.snapshot.snapshot_month))
    .map((record) => ({
      month: record.monthLabel,
      growth: record.snapshot.growth_from_previous_month,
    }));

  return (
    <DashboardCard className="h-full">
      <div className="mb-4 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Monthly Growth</h3>
            <p className="text-sm text-slate-600">Month-over-month change from monthly snapshot closes</p>
          </div>
          <TrendingUp className="h-4 w-4 text-slate-400" />
        </div>
      </div>
      {growthData.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
          No monthly closes yet.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthData}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} interval={0} height={50} tickFormatter={(value) => truncateLabel(String(value), 10)} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} labelFormatter={(value) => String(value)} />
              <Bar dataKey="growth" radius={[8, 8, 0, 0]} fill="#0f172a" barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardCard>
  );
});

const AllocationChartCard = memo(function AllocationChartCard({
  title,
  description,
  data,
  emptyLabel,
}: {
  title: string;
  description: string;
  data: Array<{ name: string; value: number }>;
  emptyLabel: string;
}) {
  const gradientId = useId();

  return (
    <DashboardCard className="h-full">
      <div className="mb-4 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <CircleDollarSign className="h-4 w-4 text-slate-400" />
        </div>
      </div>
      {data.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={102} paddingAngle={3} stroke="none">
                  {data.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} labelFormatter={(value) => String(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="font-medium text-slate-700">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900">{formatCurrency(item.value, { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-slate-900 to-slate-500 transition-all duration-700" />
      </div>
      <span className="sr-only" id={gradientId} />
    </DashboardCard>
  );
});

const HealthScoreCard = memo(function HealthScoreCard({ health }: { health: FinancialHealthSnapshot }) {
  const circumference = 2 * Math.PI * 48;
  const progress = circumference - (health.score / 100) * circumference;

  return (
    <DashboardCard className="h-full overflow-hidden border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-300">Financial Health Score</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">{health.label}</h3>
          <p className="mt-3 max-w-md text-sm text-slate-300">{health.detail}</p>
        </div>
        <ShieldCheck className="h-5 w-5 text-slate-300" />
      </div>

      <div className="mt-6 flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="white"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={progress}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl font-semibold leading-none">{health.score}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-300">/100</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {health.factors.map((factor) => (
            <div key={factor.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-300">{factor.label}</p>
                <p className={`text-sm font-semibold ${factor.tone === "positive" ? "text-emerald-300" : factor.tone === "warning" ? "text-amber-300" : "text-slate-100"}`}>{factor.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
});

const HoldingListCard = memo(function HoldingListCard({
  title,
  subtitle,
  holdings,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  holdings: Array<{ name: string; value: number; detail: string }>;
  emptyLabel: string;
}) {
  return (
    <DashboardCard className="h-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 text-slate-400" />
      </div>
      {holdings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{emptyLabel}</div>
      ) : (
        <div className="space-y-3">
          {holdings.map((holding, index) => (
            <div key={`${holding.name}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{holding.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{holding.detail}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(holding.value, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
});

export const ExecutiveDashboard = memo(function ExecutiveDashboard({
  loading,
  emptyState,
  summary,
  health,
  historyModel,
  trendData,
  topAssets,
  topInvestments,
  insights,
  activityItems,
  retirementSummary,
}: ExecutiveDashboardProps) {
  if (loading) {
    return <DashboardSkeleton />;
  }

  const latestClose = historyModel.latest;
  const totalAssetBase = calculateTotalAssetBase(summary);

  return (
    <div className="space-y-8">
      {emptyState ? (
        <DashboardCard className="overflow-hidden border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-0 text-white shadow-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <div>
              <p className="text-sm font-medium text-slate-300">Executive empty state</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Capture your first holdings to unlock the wealth cockpit.</h3>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">Add assets, investments, and liabilities so WealthOS can compute net worth, cash position, concentration, and monthly momentum.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                  <Link href="/assets">Add Asset</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/investments">Add Investment</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/liabilities">Add Liability</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Net Worth", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
                { label: "Assets", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
                { label: "Investments", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
                { label: "Liabilities", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
                { label: "Cash", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
                { label: "Health Score", value: "0/100" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <p className="text-sm text-slate-300">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Net Worth" value={formatCurrency(summary.netWorth, { maximumFractionDigits: 0 })} detail="Total assets minus liabilities" icon={Wallet2} tone={summary.netWorth >= 0 ? "positive" : "warning"} />
            <MetricCard title="Assets" value={formatCurrency(totalAssetBase, { maximumFractionDigits: 0 })} detail="Bank, investments, fixed deposits, metals, retirement, and real estate" icon={CircleDollarSign} />
            <MetricCard title="Investments" value={formatCurrency(summary.totalInvestments, { maximumFractionDigits: 0 })} detail="Market value of the portfolio" icon={TrendingUp} tone={summary.totalInvestments > 0 ? "positive" : "default"} />
            <MetricCard title="Liabilities" value={formatCurrency(summary.totalLiabilities, { maximumFractionDigits: 0 })} detail="Outstanding debt obligations" icon={Banknote} tone={summary.totalLiabilities > totalAssetBase * 0.5 ? "warning" : "default"} />
            <MetricCard title="Cash" value={formatCurrency(summary.cashHoldings, { maximumFractionDigits: 0 })} detail="Liquid balances and cash equivalents" icon={PiggyBank} tone={summary.cashRatio >= 0.1 ? "positive" : "warning"} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <DashboardCard className="overflow-hidden border-[#2b2414] bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.22),_transparent_35%),linear-gradient(135deg,#09090b_0%,#111827_55%,#1f2937_100%)] text-white shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-amber-200/80">Retirement Corpus</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">{formatCurrency(retirementSummary?.totalRetirementAssets ?? 0, { maximumFractionDigits: 0 })}</p>
                  <p className="mt-3 max-w-md text-sm text-slate-300">Dedicated EPF, PPF, and NPS holdings tracked outside the legacy modules.</p>
                </div>
                <PiggyBank className="h-5 w-5 text-slate-300" />
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Retirement Coverage</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                    {retirementSummary?.totalRetirementAssets && summary.netWorth > 0
                      ? `${((retirementSummary.totalRetirementAssets / summary.netWorth) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">
                    Retirement module now tracks balances with standardized recurring contribution schedules across PPF, EPF, and NPS.
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-slate-400" />
              </div>
            </DashboardCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <TrendChartCard data={trendData.length > 0 ? trendData : historyModel.trendData} />
            <HealthScoreCard health={health} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <AllocationChartCard
              title="Asset Allocation"
              description="Current mix of owned assets by type"
              data={summary.assetAllocation}
              emptyLabel="No assets yet. Add holdings to view allocation."
            />
            <GrowthChartCard data={historyModel.records} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <DashboardCard className="h-full">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Recent Activity Timeline</h3>
                  <p className="text-sm text-slate-600">Latest closings and record updates across the family office</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
              {activityItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">No recent activity yet.</div>
              ) : (
                <div className="space-y-3">
                  {activityItems.map((item) => (
                    <TimelineRow key={`${item.title}-${item.time}`} item={item} />
                  ))}
                </div>
              )}
              {latestClose ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
                  <p className="text-sm text-slate-300">Latest snapshot</p>
                  <p className="mt-2 text-xl font-semibold">{latestClose.monthLabel}</p>
                  <p className="mt-2 text-sm text-slate-300">Net worth {formatCurrency(latestClose.snapshot.net_worth, { maximumFractionDigits: 0 })} with month-over-month growth of {formatCurrency(latestClose.snapshot.growth_from_previous_month, { maximumFractionDigits: 0 })}.</p>
                </div>
              ) : null}
            </DashboardCard>

            <DashboardCard className="h-full">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">AI Insight Cards</h3>
                  <p className="text-sm text-slate-600">Key changes and executive observations</p>
                </div>
                <Sparkles className="h-4 w-4 text-slate-400" />
              </div>
              {insights.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">No insights yet.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {insights.map((insight) => (
                    <InsightCard key={insight.title} insight={insight} />
                  ))}
                </div>
              )}
            </DashboardCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <HoldingListCard
              title="Top Assets"
              subtitle="Largest asset holdings by current value"
              holdings={topAssets.map((asset) => ({
                name: asset.asset_name,
                value: asset.current_value,
                detail: asset.institution ?? asset.asset_type.replaceAll("_", " "),
              }))}
              emptyLabel="No assets yet."
            />
            <HoldingListCard
              title="Top Investments"
              subtitle="Largest investment holdings by current value"
              holdings={topInvestments.map((investment) => ({
                name: investment.investment_name,
                value: investment.current_value,
                detail: `${investment.category} • ${investment.region}`,
              }))}
              emptyLabel="No investments yet."
            />
          </section>
        </>
      )}
    </div>
  );
});

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-32 rounded bg-slate-200" />
            <div className="mt-4 h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="h-[24rem] rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-[24rem] rounded-2xl border border-slate-200 bg-slate-100" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="h-[24rem] rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-[24rem] rounded-2xl border border-slate-200 bg-slate-100" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="h-[20rem] rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-[20rem] rounded-2xl border border-slate-200 bg-slate-100" />
      </div>
      <LoadingSpinner label="Loading executive dashboard..." />
    </div>
  );
}
