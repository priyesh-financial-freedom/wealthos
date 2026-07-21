"use client";

import { useEffect, useMemo, useState } from "react";

import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/formatters";
import {
  buildExecutiveInsights,
  getRecentAssets,
  getRecentLiabilities,
  getTopAssets,
} from "@/services/finance";
import { buildInvestmentInsights, buildInvestmentSummary, getTopInvestments, getRecentInvestments } from "@/services/investments";
import { buildMonthlyHistoryModel, getMonthlyHistory } from "@/services/monthlySnapshots";
import { buildBalanceSheetTrendFallback, getBalanceSheetData, type BalanceSheetSummary } from "@/services/balanceSheet";
import { buildRetirementDashboardModel, buildRetirementExecutiveSummary } from "@/services/retirement";
import { getUniversalDashboardSummary } from "@/services/universalAccounts";
import { healthScoreService, type HealthScore } from "@/services/health";
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
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const [balanceSheetData, history, universal] = await Promise.all([
          getBalanceSheetData(),
          getMonthlyHistory(),
          getUniversalDashboardSummary().catch(() => null),
        ]);
        const historyModel = buildMonthlyHistoryModel(history);
        const calculatedHealthScore = await healthScoreService.calculateHealthScore({
          summary: balanceSheetData.summary,
          monthlyHistory: historyModel,
        });

        if (isMounted) {
          const retirementModel = buildRetirementDashboardModel(balanceSheetData.retirementAccounts);

          setAssets(balanceSheetData.assets);
          setLiabilities(balanceSheetData.liabilities);
          setInvestments(balanceSheetData.investments);
          setHistoryRecords(history);
          setSummary(balanceSheetData.summary);
          setRetirementSummary(buildRetirementExecutiveSummary(retirementModel));
          setUniversalSummary(universal);
          setHealthScore(calculatedHealthScore);
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
  const activeSummary = summary;
  const insights = useMemo(
    () => {
      if (!activeSummary) {
        return [...historyModel.review].slice(0, 4);
      }

      const universalInsights = universalSummary
        ? [
            {
              title: "Universal account engine synced",
              detail: `Universal portfolio tracks ${formatCurrency(universalSummary.totalCurrentValue, { maximumFractionDigits: 0 })} across ${universalSummary.allocation.length} account types.`,
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
              detail: `Net worth closed at ${formatCurrency(historyModel.latest.snapshot.net_worth, { maximumFractionDigits: 0 })} after the latest monthly snapshot.`,
              time: formatRelativeTime(historyModel.latest.snapshot.closed_at),
            },
          ]
        : []),
      ...recentAssets.map((asset) => ({
        title: asset.asset_name,
        detail: `${asset.asset_type.replaceAll("_", " ")} • ${formatCurrency(asset.current_value, { maximumFractionDigits: 0 })}`,
        time: formatRelativeTime(asset.created_at),
      })),
      ...recentInvestments.map((investment) => ({
        title: investment.investment_name,
        detail: `${investment.category} • ${formatCurrency(investment.current_value, { maximumFractionDigits: 0 })}`,
        time: formatRelativeTime(investment.created_at),
      })),
      ...recentLiabilities.map((liability) => ({
        title: liability.account_name,
        detail: `${liability.liability_type} • ${formatCurrency(liability.outstanding_amount, { maximumFractionDigits: 0 })}`,
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
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Executive Dashboard" }]} />
        <PageHeader
          title="Executive Dashboard"
          description="A premium command center for wealth, debt, concentration, and liquidity."
        />

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <ExecutiveDashboard
            loading={loading}
            emptyState={!hasFinancialData && !hasUniversalData}
            summary={activeSummary ?? { totalAssets: 0, totalInvestments: 0, totalLiabilities: 0, netWorth: 0, debtRatio: 0, monthlyEmi: 0, cashHoldings: 0, cashRatio: 0, assetAllocation: [], liabilityAllocation: [], largestAsset: null, largestLiability: null }}
            trendData={trendData}
            health={healthScore ?? { overallScore: 0, grade: "Needs Attention", components: [], strengths: [], watchItems: [], recommendations: [], trend: [] }}
            topAssets={topAssets}
            topInvestments={topInvestments}
            insights={insights}
            activityItems={activityItems}
            historyModel={historyModel}
            retirementSummary={retirementSummary}
          />
        </ContentContainer>
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
