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
  },
  dailyInsight: "Liquidity is healthy.",
  retirement: {
    available: true,
    totalRetirementAssets: 450000,
    accountsCount: 3,
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
    const html = renderToStaticMarkup(<ExecutiveDashboard loading={false} data={populatedData} error={null} />);

    expect(html).toContain("Project North Star");
    expect(html).toContain("Financial Health Score");
    expect(html).toContain("Where Am I Today");
    expect(html).toContain("Where Should I Focus");
    expect(html).toContain("Investments");
    expect(html).toContain("Liabilities");
    expect(html).toContain("Retirement");
    expect(html).toContain("What&#x27;s Coming Up");
  });
});
