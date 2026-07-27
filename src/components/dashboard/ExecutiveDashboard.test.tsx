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
};

describe("ExecutiveDashboard", () => {
  it("renders loading state", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading data={null} error={null} />);
    expect(html).toContain("Loading executive dashboard");
  });

  it("renders error state", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading={false} data={null} error="Something failed" />);
    expect(html).toContain("Something failed");
  });

  it("renders empty state", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading={false} data={{ ...populatedData, emptyState: true }} error={null} />);
    expect(html).toContain("Add financial data to unlock the executive dashboard");
  });

  it("renders all required sections", () => {
    const html = renderToStaticMarkup(<ExecutiveDashboard loading={false} data={populatedData} error={null} />);

    expect(html).toContain("Net Worth");
    expect(html).toContain("Total Assets");
    expect(html).toContain("Total Liabilities");
    expect(html).toContain("Monthly Savings");
    expect(html).toContain("Investments");
    expect(html).toContain("Loans");
    expect(html).toContain("Goals");
    expect(html).toContain("Monthly Summary");
  });
});
