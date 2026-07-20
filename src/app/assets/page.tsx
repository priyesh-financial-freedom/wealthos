"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LoadingSpinner } from "@/components/ui/feedback";
import { formatCurrency, formatPercent, truncateLabel } from "@/lib/formatters";
import { getBalanceSheetData } from "@/services/balanceSheet";
import { buildMonthlyHistoryModel, getMonthlyHistory } from "@/services/monthlySnapshots";

interface AssetBucket {
  name: string;
  value: number;
  count: number;
}

const CHART_COLORS = ["#0f172a", "#1d4ed8", "#0f766e", "#b45309", "#7c3aed", "#065f46", "#64748b"];

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function buildAssetBuckets(params: {
  bankAccountsValue: number;
  investmentsValue: number;
  fixedDepositsValue: number;
  goldValue: number;
  silverValue: number;
  retirementValue: number;
  realEstateValue: number;
  bankAccountsCount: number;
  investmentsCount: number;
  fixedDepositsCount: number;
  goldCount: number;
  silverCount: number;
  retirementCount: number;
  realEstateCount: number;
}): AssetBucket[] {
  return [
    {
      name: "Bank Accounts",
      value: params.bankAccountsValue,
      count: params.bankAccountsCount,
    },
    {
      name: "Investments",
      value: params.investmentsValue,
      count: params.investmentsCount,
    },
    {
      name: "Fixed Deposits",
      value: params.fixedDepositsValue,
      count: params.fixedDepositsCount,
    },
    {
      name: "Gold",
      value: params.goldValue,
      count: params.goldCount,
    },
    {
      name: "Silver",
      value: params.silverValue,
      count: params.silverCount,
    },
    {
      name: "Retirement Assets",
      value: params.retirementValue,
      count: params.retirementCount,
    },
    {
      name: "Real Estate",
      value: params.realEstateValue,
      count: params.realEstateCount,
    },
  ];
}

function EmptyStateCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { label: "Net Asset Value", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
        { label: "Previous Month Change", value: formatCurrency(0, { maximumFractionDigits: 0 }) },
        { label: "Asset Count", value: "0" },
      ].map((item) => (
        <DashboardCard key={item.label}>
          <p className="text-sm text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
        </DashboardCard>
      ))}
    </div>
  );
}

export default function AssetsPage() {
  const [buckets, setBuckets] = useState<AssetBucket[]>([]);
  const [sharedTotalAssets, setSharedTotalAssets] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousMonthChange, setPreviousMonthChange] = useState<number | null>(null);

  async function loadDashboard() {
    setError(null);

    try {
      const [historyRows, balanceSheetData] = await Promise.all([
        getMonthlyHistory().catch(() => []),
        getBalanceSheetData().catch(() => null),
      ]);

      const historyModel = buildMonthlyHistoryModel(historyRows);
      const latestAssetBase = historyModel.latest ? Number(historyModel.latest.snapshot.assets_total ?? 0) + Number(historyModel.latest.snapshot.investments_total ?? 0) : null;
      const previousAssetBase = historyModel.previousMonth ? Number(historyModel.previousMonth.snapshot.assets_total ?? 0) + Number(historyModel.previousMonth.snapshot.investments_total ?? 0) : null;

      const bankAccounts = balanceSheetData?.bankAccounts ?? [];
      const investments = balanceSheetData?.investments ?? [];
      const fixedDeposits = balanceSheetData?.fixedDeposits ?? [];
      const goldHoldings = balanceSheetData?.goldHoldings ?? [];
      const silverHoldings = balanceSheetData?.silverHoldings ?? [];
      const retirementAccounts = balanceSheetData?.retirementAccounts ?? [];
      const realEstateProperties = balanceSheetData?.realEstateProperties ?? [];

      const summary = balanceSheetData?.summary;
      const bankAccountsValue = bankAccounts
        .filter((account) => account.status !== "closed")
        .reduce((total, account) => total + Number(account.current_balance ?? 0), 0);
      const goldValue = goldHoldings.reduce((total, holding) => total + Number(holding.current_value ?? 0), 0);
      const silverValue = silverHoldings.reduce((total, holding) => total + Number(holding.current_value ?? 0), 0);

      setBuckets(
        buildAssetBuckets({
          bankAccountsValue,
          investmentsValue: summary?.categoryTotals.investments ?? 0,
          fixedDepositsValue: summary?.categoryTotals.fixedDeposits ?? 0,
          goldValue,
          silverValue,
          retirementValue: summary?.categoryTotals.retirement ?? 0,
          realEstateValue: summary?.categoryTotals.realEstate ?? 0,
          bankAccountsCount: bankAccounts.filter((account) => account.status !== "closed").length,
          investmentsCount: investments.filter((investment) => investment.category === "Mutual Funds" || investment.category === "Stocks").length,
          fixedDepositsCount: fixedDeposits.length,
          goldCount: goldHoldings.length,
          silverCount: silverHoldings.length,
          retirementCount: retirementAccounts.length,
          realEstateCount: realEstateProperties.length,
        }),
      );

      setSharedTotalAssets(balanceSheetData?.summary.totalBalanceSheetAssets ?? null);
      setPreviousMonthChange(latestAssetBase !== null && previousAssetBase !== null ? latestAssetBase - previousAssetBase : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load asset portfolio dashboard");
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      await loadDashboard();
      if (mounted) {
        setLoading(false);
      }
    }

    void initialize();

    const handleRefresh = () => {
      void loadDashboard();
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("wealthos:finance-data-updated", handleRefresh);

    return () => {
      mounted = false;
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("wealthos:finance-data-updated", handleRefresh);
    };
  }, []);

  const bucketTotalAssets = useMemo(() => sum(buckets.map((bucket) => bucket.value)), [buckets]);
  const totalAssets = sharedTotalAssets ?? bucketTotalAssets;
  const totalCount = useMemo(() => sum(buckets.map((bucket) => bucket.count)), [buckets]);
  const chartRows = useMemo(() => buckets.filter((bucket) => bucket.value > 0), [buckets]);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Assets"
          description="Executive asset portfolio dashboard aggregating balances across banking, investments, fixed deposits, metals, retirement, and real estate."
        />

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {loading ? (
          <LoadingSpinner label="Loading executive asset dashboard..." />
        ) : (
          <>
            {buckets.every((bucket) => bucket.value === 0) ? (
              <EmptyStateCards />
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <DashboardCard>
                  <p className="text-sm text-slate-500">Net Asset Value</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalAssets, { maximumFractionDigits: 0 })}</p>
                </DashboardCard>
                <DashboardCard>
                  <p className="text-sm text-slate-500">Previous Month Change</p>
                  <p className={`mt-2 text-2xl font-semibold ${previousMonthChange !== null && previousMonthChange < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {previousMonthChange === null ? "—" : formatCurrency(previousMonthChange, { maximumFractionDigits: 0 })}
                  </p>
                </DashboardCard>
                <DashboardCard>
                  <p className="text-sm text-slate-500">Asset Count</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{totalCount.toLocaleString("en-IN")}</p>
                </DashboardCard>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {buckets.map((bucket) => {
                const share = totalAssets > 0 ? bucket.value / totalAssets : 0;
                return (
                  <DashboardCard key={bucket.name}>
                    <p className="text-sm font-medium text-slate-500">{bucket.name}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(bucket.value, { maximumFractionDigits: 0 })}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatPercent(share, { digits: 1 })} of total assets</p>
                  </DashboardCard>
                );
              })}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardCard>
                <h3 className="text-base font-semibold text-slate-900">Asset Allocation</h3>
                <p className="mt-1 text-sm text-slate-600">Portfolio concentration by asset module</p>
                {chartRows.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
                    No asset records are available yet.
                  </div>
                ) : (
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartRows} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={2}>
                          {chartRows.map((entry, index) => (
                            <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </DashboardCard>

              <DashboardCard>
                <h3 className="text-base font-semibold text-slate-900">Asset Values</h3>
                <p className="mt-1 text-sm text-slate-600">Absolute value by asset module</p>
                {chartRows.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
                    No asset records are available yet.
                  </div>
                ) : (
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartRows}>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => truncateLabel(String(value), 14)} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#0f172a">
                          {chartRows.map((entry, index) => (
                            <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </DashboardCard>
            </div>
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}
