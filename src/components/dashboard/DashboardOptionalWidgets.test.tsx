import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardOptionalWidgets } from "./DashboardOptionalWidgets";

const optionalData = {
  emptyState: false,
  dailyInsight: "Liquidity is healthy.",
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
    total: 1,
    onTrack: 1,
    atRisk: 0,
    completed: 0,
    items: [],
    heatmap: [
      {
        id: "goal-1",
        name: "Retirement",
        targetDate: "2035-12-31",
        fundingPercent: 65,
        gapOrSurplus: -350000,
        status: "Watch" as const,
      },
    ],
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
    points: [
      { month: "Apr 2026", actual: 1000000, planned: 980000 },
      { month: "May 2026", actual: 1080000, planned: 1020000 },
    ],
  },
  assetAllocationDrift: {
    available: true,
    message: "Set target allocation in Assumptions.",
    rows: [
      {
        assetClass: "Equity" as const,
        currentPercent: 45,
        targetPercent: null,
        driftPercent: null,
        needsAction: false,
      },
    ],
  },
  monthlyReviewSummary: {
    available: true,
    month: "Jul 2026",
    netWorthChange: 25000,
    savingsRate: 22,
    debtReduction: 14000,
    goalProgress: 65,
    retirementReadinessChange: 2.4,
    ctaLabel: "Update Monthly Review" as const,
  },
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

describe("DashboardOptionalWidgets", () => {
  it("renders the optional dashboard section after core data is available", () => {
    const html = renderToStaticMarkup(<DashboardOptionalWidgets data={optionalData} />);

    expect(html).toContain("Recommended actions");
    expect(html).toContain("Goal funding heatmap");
    expect(html).toContain("Planned vs actual net worth trend");
    expect(html).toContain("Asset allocation drift");
  });

  it("renders empty states for optional widgets without misleading zeroes", () => {
    const html = renderToStaticMarkup(
      <DashboardOptionalWidgets
        data={{
          ...optionalData,
          recommendedActions: [],
          goals: {
            ...optionalData.goals,
            heatmap: [],
          },
          netWorthTrend: {
            available: false,
            message: "Add monthly snapshots to view net worth trend.",
            points: [],
          },
          assetAllocationDrift: {
            available: false,
            message: "Set assumptions to calculate this metric",
            rows: [],
          },
        }}
      />,
    );

    expect(html).toContain("Data required");
    expect(html).toContain("Add monthly snapshots to view net worth trend.");
    expect(html).toContain("Set assumptions to calculate this metric");
  });
});