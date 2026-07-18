"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Building2, Landmark, ShieldAlert, TrendingUp, Wallet } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/feedback";
import { buildMonthlyHistoryModel, getMonthlyHistory } from "@/services/monthlySnapshots";
import { getBalanceSheetData, type BalanceSheetSection, type BalanceSheetSummary } from "@/services/balanceSheet";
import type { MonthlyHistoryRecord } from "@/services/monthlySnapshots";

const ASSET_COLORS = ["#0f172a", "#334155", "#15803d", "#f59e0b", "#b45309", "#0f766e", "#7c3aed", "#94a3b8"];
const LIABILITY_COLORS = ["#7f1d1d", "#b91c1c", "#dc2626", "#f97316", "#7c2d12"];

const emptySummary: BalanceSheetSummary = {
  totalAssets: 0,
  totalInvestments: 0,
  totalLiabilities: 0,
  totalBalanceSheetAssets: 0,
  netWorth: 0,
  debtRatio: 0,
  monthlyEmi: 0,
  cashHoldings: 0,
  cashRatio: 0,
  liquidityRatio: null,
  investmentRatio: 0,
  retirementRatio: 0,
  realEstateRatio: 0,
  assetAllocation: [],
  liabilityAllocation: [],
  largestAsset: null,
  largestLiability: null,
  categoryTotals: {
    cashAndBank: 0,
    investments: 0,
    retirement: 0,
    fixedDeposits: 0,
    goldAndSilver: 0,
    realEstate: 0,
    vehicles: 0,
    otherAssets: 0,
    homeLoan: 0,
    carLoan: 0,
    creditCards: 0,
    personalLoan: 0,
    otherLiabilities: 0,
  },
  assetSections: [],
  liabilitySections: [],
};

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

export default function BalanceSheetPage() {
  const [summary, setSummary] = useState<BalanceSheetSummary>(emptySummary);
  const [historyRecords, setHistoryRecords] = useState<MonthlyHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadBalanceSheet() {
      try {
        setLoading(true);
        const [balanceSheetData, history] = await Promise.all([getBalanceSheetData(), getMonthlyHistory().catch(() => [])]);
        if (!mounted) {
          return;
        }

        setSummary(balanceSheetData.summary);
        setHistoryRecords(history);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load balance sheet");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadBalanceSheet();

    const handleRefresh = () => {
      void loadBalanceSheet();
    };

    window.addEventListener("wealthos:finance-data-updated", handleRefresh);

    return () => {
      mounted = false;
      window.removeEventListener("wealthos:finance-data-updated", handleRefresh);
    };
  }, []);

  const historyModel = useMemo(() => buildMonthlyHistoryModel(historyRecords), [historyRecords]);
  const monthlyGrowthData = useMemo(
    () =>
      historyModel.records
        .slice()
        .sort((left, right) => (left.snapshot.snapshot_year - right.snapshot.snapshot_year) || (left.snapshot.snapshot_month - right.snapshot.snapshot_month))
        .map((record) => ({ month: record.monthLabel, growth: record.snapshot.growth_from_previous_month })),
    [historyModel.records],
  );

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Balance Sheet"
          description="A live financial statement that aggregates assets, investments, retirement accounts, bank balances, and liabilities into one executive balance sheet."
        />

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {loading ? <BalanceSheetSkeleton /> : (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard title="Net Worth" value={formatMoney(summary.netWorth)} subtitle="Total assets minus total liabilities" icon={Wallet} tone={summary.netWorth >= 0 ? "dark" : "warning"} />
              <MetricCard title="Debt Ratio" value={formatPercent(summary.debtRatio)} subtitle="Liabilities as a share of total balance sheet assets" icon={ShieldAlert} />
              <MetricCard title="Liquidity Ratio" value={summary.liquidityRatio === null ? "—" : `${summary.liquidityRatio.toFixed(2)}x`} subtitle="Cash & bank divided by liabilities" icon={Landmark} tone="positive" />
              <MetricCard title="Investment %" value={formatPercent(summary.investmentRatio)} subtitle="Investments, fixed deposits, and precious metals" icon={TrendingUp} />
              <MetricCard title="Retirement %" value={formatPercent(summary.retirementRatio)} subtitle="Retirement share of total assets" icon={Building2} />
              <MetricCard title="Real Estate %" value={formatPercent(summary.realEstateRatio)} subtitle={`Cash % ${formatPercent(summary.cashRatio)}`} icon={ArrowUpRight} />
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <StatementColumn title="Assets" subtitle="Automatically aggregated from live data in assets, investments, retirement, and bank tables." sections={summary.assetSections} />
              <StatementColumn title="Liabilities" subtitle="Automatically aggregated from live debt records without manual totals." sections={summary.liabilitySections} />
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <TotalCard title="Total Assets" value={formatMoney(summary.totalBalanceSheetAssets)} subtitle="All asset-side categories combined" tone="positive" />
              <TotalCard title="Total Liabilities" value={formatMoney(summary.totalLiabilities)} subtitle="All liability-side categories combined" tone="warning" />
              <TotalCard title="Net Worth" value={formatMoney(summary.netWorth)} subtitle="Current family-office balance sheet result" tone={summary.netWorth >= 0 ? "dark" : "warning"} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <DashboardCard>
                <div className="mb-4 space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">Asset Allocation</h3>
                  <p className="text-sm text-slate-600">Current balance sheet asset mix across cash, investments, retirement, and long-duration holdings</p>
                </div>
                {summary.assetAllocation.length === 0 ? (
                  <EmptyChart label="No asset-side holdings are available yet." />
                ) : (
                  <AllocationChart data={summary.assetAllocation} colors={ASSET_COLORS} />
                )}
              </DashboardCard>

              <DashboardCard>
                <div className="mb-4 space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">Liability Allocation</h3>
                  <p className="text-sm text-slate-600">Outstanding balance split by liability class</p>
                </div>
                {summary.liabilityAllocation.length === 0 ? (
                  <EmptyChart label="No liability records are available yet." />
                ) : (
                  <AllocationChart data={summary.liabilityAllocation} colors={LIABILITY_COLORS} />
                )}
              </DashboardCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <DashboardCard>
                <div className="mb-4 space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">Net Worth Trend</h3>
                  <p className="text-sm text-slate-600">Monthly balance sheet progression from the close-month engine</p>
                </div>
                {historyModel.trendData.length === 0 ? (
                  <EmptyChart label="Close a month to store balance sheet totals and unlock historical trend analysis." />
                ) : (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyModel.trendData}>
                        <defs>
                          <linearGradient id="bs-networth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0f172a" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#0f172a" stopOpacity={0.04} />
                          </linearGradient>
                          <linearGradient id="bs-investments" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#15803d" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#15803d" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                        <Area type="monotone" dataKey="netWorth" stroke="#0f172a" fill="url(#bs-networth)" strokeWidth={2.5} />
                        <Area type="monotone" dataKey="investments" stroke="#15803d" fill="url(#bs-investments)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </DashboardCard>

              <DashboardCard>
                <div className="mb-4 space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">Monthly Growth</h3>
                  <p className="text-sm text-slate-600">Month-over-month balance sheet change captured during close month</p>
                </div>
                {monthlyGrowthData.length === 0 ? (
                  <EmptyChart label="Monthly growth will appear once the first month is closed." />
                ) : (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyGrowthData}>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                        <Bar dataKey="growth" radius={[10, 10, 0, 0]} fill="#0f172a" barSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </DashboardCard>
            </section>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning" | "dark";
}) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    dark: "border-[#2b2414] bg-[linear-gradient(135deg,#09090b_0%,#111827_60%,#1f2937_100%)] text-white",
  };

  return (
    <DashboardCard className={toneClasses[tone]}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${tone === "dark" ? "text-slate-300" : "text-slate-500"}`}>{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone === "dark" ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className={`mt-4 text-sm ${tone === "dark" ? "text-slate-300" : "text-slate-600"}`}>{subtitle}</p>
    </DashboardCard>
  );
}

function StatementColumn({ title, subtitle, sections }: { title: string; subtitle: string; sections: BalanceSheetSection[] }) {
  return (
    <DashboardCard className="overflow-hidden">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className="space-y-3">
        {sections.map((section) => (
          <Link
            key={section.label}
            href={section.href}
            className="group block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                <p className="mt-1 text-sm text-slate-600">{section.description}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-900">{formatMoney(section.value)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400 group-hover:text-slate-500">Drill down</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}

function TotalCard({ title, value, subtitle, tone = "default" }: { title: string; value: string; subtitle: string; tone?: "default" | "positive" | "warning" | "dark" }) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-rose-200 bg-rose-50 text-rose-900",
    dark: "border-[#2b2414] bg-[linear-gradient(135deg,#09090b_0%,#111827_60%,#1f2937_100%)] text-white",
  };

  return (
    <DashboardCard className={toneClasses[tone]}>
      <p className={`text-sm font-medium ${tone === "dark" ? "text-slate-300" : "text-slate-500"}`}>{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-3 text-sm ${tone === "dark" ? "text-slate-300" : "text-slate-600"}`}>{subtitle}</p>
    </DashboardCard>
  );
}

function AllocationChart({ data, colors }: { data: Array<{ name: string; value: number }>; colors: string[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={104} paddingAngle={3}>
              {data.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="font-medium text-slate-700">{item.name}</span>
            </div>
            <span className="font-semibold text-slate-900">{formatMoney(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function BalanceSheetSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <DashboardCard key={index} className="h-32 animate-pulse bg-slate-100">
            <div />
          </DashboardCard>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardCard className="h-[28rem] animate-pulse bg-slate-100">
          <div />
        </DashboardCard>
        <DashboardCard className="h-[28rem] animate-pulse bg-slate-100">
          <div />
        </DashboardCard>
      </div>
      <DashboardCard>
        <LoadingSpinner label="Loading balance sheet engine..." />
      </DashboardCard>
    </div>
  );
}