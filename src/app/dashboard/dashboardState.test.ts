import { describe, expect, it } from "vitest";

import { mergeOptionalDashboardData } from "./dashboardState";

describe("mergeOptionalDashboardData", () => {
  it("returns the current dashboard when no core data exists yet", () => {
    expect(mergeOptionalDashboardData(null, { recommendedActions: [] })).toBeNull();
  });

  it("merges optional dashboard payload into the existing core dashboard", () => {
    const current = {
      asOfLabel: "Jul 2026",
      emptyState: false,
      executiveSummary: {
        netWorth: 1200000,
        assets: 1800000,
        liabilities: 600000,
        monthlySavings: 45000,
        topContributors: [],
        lastMonthlyReview: null,
      },
      investments: {
        currentPortfolio: 700000,
        monthlyInvestment: 20000,
        projectedValue: 760000,
        expectedCagr: 11.5,
        plannedPortfolio: null,
        portfolioVariance: null,
      },
      loans: {
        outstanding: 600000,
        emi: 30000,
        interestRate: 9.5,
        activeLoans: 2,
        plannedOutstanding: null,
        outstandingVariance: null,
      },
      goals: {
        total: 0,
        onTrack: 0,
        atRisk: 0,
        completed: 0,
        items: [],
        heatmap: [],
      },
      monthlySummary: {
        income: 130000,
        expenses: 90000,
        savings: 40000,
        investments: 20000,
        netWorthChange: 25000,
      },
      financialHealth: {
        score: 88,
        label: "Strong",
        detail: "Balance sheet quality is strong.",
        rating: "Excellent" as const,
        components: [],
      },
      recommendedActions: [],
      netWorthTrend: {
        available: false,
        message: "Loading trend data...",
        points: [] as Array<{ month: string; actual: number | null; planned: number | null }>,
      },
      assetAllocationDrift: {
        available: true,
        message: "Loading drift data...",
        rows: [],
      },
      monthlyReviewSummary: {
        available: false,
        month: null,
        netWorthChange: null,
        savingsRate: null,
        debtReduction: null,
        goalProgress: null,
        retirementReadinessChange: null,
        ctaLabel: "Start Monthly Review" as const,
      },
      dailyInsight: "Liquidity is healthy.",
      retirement: {
        available: true,
        totalRetirementAssets: 450000,
        accountsCount: 3,
        plannedTotalRetirementAssets: null,
        retirementVariance: null,
        readinessPercent: null,
        plannedCorpusAtHorizonEnd: null,
        gapOrSurplusVsPlannedCorpus: null,
        retirementDate: null,
        projectionEndDate: null,
        planAlignmentStatus: "Data required",
        status: "Watch" as const,
      },
      upcoming: {
        available: true,
        items: [],
      },
    };

    const merged = mergeOptionalDashboardData(current, {
      recommendedActions: [
        {
          id: "action-1",
          title: "Increase retirement contributions",
          priority: "High" as const,
          reason: "Retirement score is below threshold.",
          nextStep: "Raise monthly retirement contributions.",
        },
      ],
      netWorthTrend: {
        available: true,
        message: null,
        points: [{ month: "Apr 2026", actual: 1000000, planned: 980000 }],
      },
    });

    expect(merged?.recommendedActions).toHaveLength(1);
    expect(merged?.netWorthTrend.available).toBe(true);
    expect(merged?.netWorthTrend.points).toHaveLength(1);
    expect(merged?.dailyInsight).toBe("Liquidity is healthy.");
  });
});