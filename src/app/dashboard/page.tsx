"use client";

import { useEffect, useMemo, useState } from "react";

import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  buildExecutiveInsights,
  buildFinancialHealthScore,
  getRecentAssets,
  getRecentLiabilities,
  getTopAssets,
} from "@/services/finance";
import { buildInvestmentInsights, buildInvestmentSummary, getTopInvestments, getRecentInvestments } from "@/services/investments";
import { buildMonthlyHistoryModel, getMonthlyHistory } from "@/services/monthlySnapshots";
import { buildBalanceSheetTrendFallback, getBalanceSheetData, type BalanceSheetSummary } from "@/services/balanceSheet";
import { buildRetirementDashboardModel, buildRetirementExecutiveSummary, getMonthlyRetirementSnapshots } from "@/services/retirement";
import { getUniversalDashboardSummary } from "@/services/universalAccounts";
import type { Asset } from "@/types/asset";
import type { Liability } from "@/types/liability";
import type { Investment } from "@/types/investment";
import type { MonthlyHistoryRecord } from "@/services/monthlySnapshots";
import type { RetirementExecutiveSummary } from "@/types/retirementAccount";
import type { UniversalDashboardSummary } from "@/types/universalAccount";

export default function DashboardPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [historyRecords, setHistoryRecords] = useState<MonthlyHistoryRecord[]>([]);
  const [summary, setSummary] = useState<BalanceSheetSummary | null>(null);
  const [retirementSummary, setRetirementSummary] = useState<RetirementExecutiveSummary | null>(null);
  const [universalSummary, setUniversalSummary] = useState<UniversalDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const [balanceSheetData, history, retirementSnapshots, universal] = await Promise.all([
          getBalanceSheetData(),
          getMonthlyHistory(),
          getMonthlyRetirementSnapshots().catch(() => []),
          getUniversalDashboardSummary().catch(() => null),
        ]);
        if (isMounted) {
          const retirementModel = buildRetirementDashboardModel(
            balanceSheetData.retirementAccounts,
            retirementSnapshots,
            balanceSheetData.summary.netWorth - balanceSheetData.summary.categoryTotals.retirement,
          );

          setAssets(balanceSheetData.assets);
          setLiabilities(balanceSheetData.liabilities);
          setInvestments(balanceSheetData.investments);
          setHistoryRecords(history);
          setSummary(balanceSheetData.summary);
          setRetirementSummary(buildRetirementExecutiveSummary(retirementModel));
          setUniversalSummary(universal);
          setError(null);
        }
      } catch (error) {
        if (isMounted) {
          setError(error instanceof Error ? error.message : "Unable to refresh dashboard");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    const handleRefresh = () => {
      void loadDashboard();
    };

    void loadDashboard();

    const handleFocus = () => {
      handleRefresh();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("wealthos:finance-data-updated", handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("wealthos:finance-data-updated", handleRefresh);
    };
  }, []);

  const investmentSummary = useMemo(() => buildInvestmentSummary(investments), [investments]);
  const historyModel = useMemo(() => buildMonthlyHistoryModel(historyRecords), [historyRecords]);
  const universalTrendFallback = useMemo(
    () =>
      (universalSummary?.trend ?? []).map((entry) => ({
        month: entry.month,
        assets: entry.total,
        liabilities: 0,
        netWorth: entry.total,
        investments: entry.inflow,
      })),
    [universalSummary],
  );
  const trendData = useMemo(() => {
    if (!summary) {
      return [];
    }
    if (historyModel.trendData.length > 0) {
      return historyModel.trendData;
    }
    if (universalTrendFallback.length > 0) {
      return universalTrendFallback;
    }
    return buildBalanceSheetTrendFallback(summary);
  }, [historyModel.trendData, summary, universalTrendFallback]);
  const topAssets = useMemo(() => getTopAssets(assets), [assets]);
  const topInvestments = useMemo(() => getTopInvestments(investments), [investments]);
  const recentAssets = useMemo(() => getRecentAssets(assets), [assets]);
  const recentInvestments = useMemo(() => getRecentInvestments(investments), [investments]);
  const recentLiabilities = useMemo(() => getRecentLiabilities(liabilities), [liabilities]);
  const latestGrowth = historyModel.latest?.snapshot.growth_from_previous_month ?? 0;
  const activeSummary = summary;
  const overallCapital = Math.max((activeSummary?.totalAssets ?? 0) + (activeSummary?.totalInvestments ?? 0), 1);
  const largestAssetShare = activeSummary?.largestAsset ? Number(activeSummary.largestAsset.current_value ?? 0) / overallCapital : 0;
  const largestInvestmentShare = investmentSummary.largestHolding ? Number(investmentSummary.largestHolding.current_value ?? 0) / overallCapital : 0;
  const health = useMemo(
    () => buildFinancialHealthScore({ summary: activeSummary ?? { totalAssets: 0, totalInvestments: 0, totalLiabilities: 0, netWorth: 0, debtRatio: 0, monthlyEmi: 0, cashHoldings: 0, cashRatio: 0, assetAllocation: [], liabilityAllocation: [], largestAsset: null, largestLiability: null }, latestMonthlyGrowth: latestGrowth, largestAssetShare, largestInvestmentShare }),
    [activeSummary, largestAssetShare, largestInvestmentShare, latestGrowth],
  );
  const insights = useMemo(
    () => {
      if (!activeSummary) {
        return [...historyModel.review].slice(0, 4);
      }

      const universalInsights = universalSummary
        ? [
            {
              title: "Universal account engine synced",
              detail: `Universal portfolio tracks $${universalSummary.totalCurrentValue.toLocaleString()} across ${universalSummary.allocation.length} account types.`,
              tone: "neutral" as const,
            },
          ]
        : [];

      return [...buildExecutiveInsights(activeSummary, assets, liabilities, investments), ...buildInvestmentInsights(investmentSummary), ...universalInsights, ...historyModel.review].slice(0, 4);
    },
    [activeSummary, assets, historyModel.review, investmentSummary, liabilities, investments, universalSummary],
  );
  const activityItems = useMemo(
    () => [
      ...(historyModel.latest
        ? [
            {
              title: `${historyModel.latest.monthLabel} close completed`,
              detail: `Net worth closed at $${historyModel.latest.snapshot.net_worth.toLocaleString()} after the latest monthly snapshot.`,
              time: formatRelativeTime(historyModel.latest.snapshot.closed_at),
            },
          ]
        : []),
      ...recentAssets.map((asset) => ({
        title: asset.asset_name,
        detail: `${asset.asset_type.replaceAll("_", " ")} • $${asset.current_value.toLocaleString()}`,
        time: formatRelativeTime(asset.created_at),
      })),
      ...recentInvestments.map((investment) => ({
        title: investment.investment_name,
        detail: `${investment.category} • $${investment.current_value.toLocaleString()}`,
        time: formatRelativeTime(investment.created_at),
      })),
      ...recentLiabilities.map((liability) => ({
        title: liability.account_name,
        detail: `${liability.liability_type} • $${liability.outstanding_amount.toLocaleString()}`,
        time: formatRelativeTime(liability.created_at),
      })),
    ].slice(0, 8),
    [historyModel.latest, recentAssets, recentInvestments, recentLiabilities],
  );
  const hasFinancialData = (activeSummary?.totalBalanceSheetAssets ?? 0) > 0 || (activeSummary?.totalLiabilities ?? 0) > 0;
  const hasUniversalData = (universalSummary?.totalCurrentValue ?? 0) > 0;

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Executive Dashboard"
          description="A premium command center for wealth, debt, concentration, and liquidity."
        />

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <ExecutiveDashboard
          loading={loading}
          emptyState={!hasFinancialData && !hasUniversalData}
          summary={activeSummary ?? { totalAssets: 0, totalInvestments: 0, totalLiabilities: 0, netWorth: 0, debtRatio: 0, monthlyEmi: 0, cashHoldings: 0, cashRatio: 0, assetAllocation: [], liabilityAllocation: [], largestAsset: null, largestLiability: null }}
          trendData={trendData}
          health={health}
          topAssets={topAssets}
          topInvestments={topInvestments}
          insights={insights}
          activityItems={activityItems}
          historyModel={historyModel}
          retirementSummary={retirementSummary}
        />
      </PageContainer>
    </AppLayout>
  );
}

function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "Recently updated";
  }

  const delta = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
