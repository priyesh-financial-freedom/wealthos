import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ExecutiveDashboard } from "./ExecutiveDashboard";

const populatedData = {
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
  },
  loans: {
    outstanding: 600000,
    emi: 30000,
    interestRate: 9.5,
    activeLoans: 2,
  },
  goals: {
    total: 1,
    onTrack: 1,
    atRisk: 0,
    completed: 0,
    items: [
      {
        id: "goal-1",
        name: "Retirement",
        progressPercent: 65,
        targetAmount: 1000000,
        gap: 350000,
      },
    ],
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
    components: [
      {
        key: "savingsRate" as const,
        label: "Savings Rate",
        score: 18,
        maxScore: 20,
        status: "green" as const,
        reason: "Savings rate is supporting long-term planning.",
      },
    ],
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
    items: [
      {
        id: "event-1",
        name: "SIP Contribution",
        date: "2026-07-28",
        amount: 12000,
        module: "investments",
        type: "contribution",
      },
    ],
  },
};

describe("ExecutiveDashboard", () => {
  it("renders loading state", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading data={null} error={null} />);
    expect(html).toContain("animate-pulse");
  });

  it("renders error state", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading={false} data={null} error="Something failed" />);
    expect(html).toContain("Something failed");
  });

  it("renders empty state", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading={false} data={{ ...populatedData, emptyState: true }} error={null} />);
    expect(html).toContain("Add financial data to unlock Project North Star");
  });

  it("renders all required sections", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading={false} optionalLoading data={populatedData} error={null} />);

    expect(html).toContain("Project North Star");
    expect(html).toContain("Financial Health Score");
    expect(html).toContain("Where am I today");
    expect(html).toContain("Recommended actions");
    expect(html).toContain("Loading optional dashboard data...");
    expect(html).toContain("Investments");
    expect(html).toContain("Liabilities");
    expect(html).toContain("Corpus Progress vs Plan");
    expect(html).toContain("What&#x27;s coming up");
  });

  it("uses semantically accurate retirement labels", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading={false} data={populatedData} error={null} />);

    expect(html).toContain("Planned Corpus at Projection End");
    expect(html).toContain("Current vs Planned Corpus Ratio");
    expect(html).toContain("Plan Alignment Status");
    expect(html).not.toContain("Required corpus");
    expect(html).not.toContain("Corpus survival status");
    expect(html).toContain("not yet a full retirement sufficiency calculation");
  });

  it("renders no-data state messages for retirement while optional sections stay deferred", () => {
    const html = renderToStaticMarkup(
      <ExecutiveDashboard
        loading={false}
        optionalLoading={false}
        data={{
          ...populatedData,
          retirement: {
            ...populatedData.retirement,
            available: false,
          },
        }}
        error={null}
      />,
    );

    expect(html).toContain("Data required");
    expect(html).toContain("Loading optional dashboard data...");
  });

  it("renders negative monthly review variance and goal gap text", () => {
    const html = renderToStaticMarkup(
      <ExecutiveDashboard
        loading={false}
        data={{
          ...populatedData,
          monthlyReviewSummary: {
            ...populatedData.monthlyReviewSummary,
            netWorthChange: -5000,
          },
          goals: {
            ...populatedData.goals,
            heatmap: [
              {
                id: "goal-gap",
                name: "Education",
                targetDate: "2030-12-31",
                fundingPercent: 40,
                gapOrSurplus: -10000,
                status: "At Risk",
              },
            ],
          },
        }}
        error={null}
      />,
    );

    expect(html).toContain("-₹5,000");
    expect(html).toContain("Gap");
  });

  it("keeps core dashboard rendering available while optional widgets are still loading", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading={false} optionalLoading data={populatedData} error={null} />);

    expect(html).toContain("Project North Star");
    expect(html).toContain("Financial Health Score");
    expect(html).toContain("Corpus Progress vs Plan");
    expect(html).toContain("Loading optional dashboard data...");
  });
});
