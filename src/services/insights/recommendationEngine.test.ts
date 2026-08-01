import { describe, expect, it } from "vitest";

import { buildDashboardRecommendations } from "./recommendationEngine";
import type { DecisionRecommendation } from "@/services/decision";

const summary = {
  debtRatio: 0.42,
  totalAssets: 100,
  totalInvestments: 100,
  totalLiabilities: 50,
  netWorth: 150,
  monthlyEmi: 10,
  cashHoldings: 20,
  cashRatio: 0.1,
  assetAllocation: [],
  liabilityAllocation: [],
  largestAsset: null,
  largestLiability: null,
  totalBalanceSheetAssets: 200,
  liquidityRatio: 0.5,
  investmentRatio: 0.2,
  retirementRatio: 0.1,
  realEstateRatio: 0.2,
  categoryTotals: {
    cashAndBank: 20,
    investments: 80,
    retirement: 20,
    fixedDeposits: 15,
    goldAndSilver: 5,
    realEstate: 40,
    vehicles: 10,
    otherAssets: 10,
    homeLoan: 40,
    carLoan: 10,
    creditCards: 0,
    personalLoan: 0,
    otherLiabilities: 0,
  },
  assetSections: [],
  liabilitySections: [],
};

describe("buildDashboardRecommendations", () => {
  it("maps decision engine priorities deterministically", () => {
    const recommendations: DecisionRecommendation[] = [
      {
        id: "r-1",
        title: "Increase Retirement Contributions",
        category: "Retirement",
        priority: "Critical",
        severity: "Red",
        reason: "Retirement score is low.",
        recommendedAction: "Raise EPF/PPF/NPS monthly contribution.",
        expectedBenefit: "Higher corpus",
        confidence: 0.91,
        status: "Open",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "r-2",
        title: "Portfolio Rebalance",
        category: "Portfolio",
        priority: "Low",
        severity: "Amber",
        reason: "Diversification score is moderate.",
        recommendedAction: "Rebalance allocations.",
        expectedBenefit: "Lower concentration",
        confidence: 0.7,
        status: "Open",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ];

    const output = buildDashboardRecommendations({
      decisionRecommendations: recommendations,
      balanceSheetSummary: summary,
      goals: [],
      monthlySavings: 1000,
      hasMonthlyReview: true,
      maxItems: 5,
    });

    expect(output[0].priority).toBe("High");
    expect(output[1].priority).toBe("Low");
  });

  it("orders recommendations by mapped priority", () => {
    const recommendations: DecisionRecommendation[] = [
      {
        id: "r-low",
        title: "Low priority",
        category: "Portfolio",
        priority: "Low",
        severity: "Amber",
        reason: "low",
        recommendedAction: "low",
        expectedBenefit: "low",
        confidence: 0.7,
        status: "Open",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "r-high",
        title: "High priority",
        category: "Debt",
        priority: "High",
        severity: "Red",
        reason: "high",
        recommendedAction: "high",
        expectedBenefit: "high",
        confidence: 0.9,
        status: "Open",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "r-medium",
        title: "Medium priority",
        category: "Goals",
        priority: "Medium",
        severity: "Amber",
        reason: "medium",
        recommendedAction: "medium",
        expectedBenefit: "medium",
        confidence: 0.8,
        status: "Open",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ];

    const output = buildDashboardRecommendations({
      decisionRecommendations: recommendations,
      balanceSheetSummary: summary,
      goals: [],
      monthlySavings: 1000,
      hasMonthlyReview: true,
      maxItems: 5,
    });

    expect(output.map((item) => item.id)).toEqual(["r-high", "r-medium", "r-low"]);
  });

  it("falls back to rule-based actions when recommendations are unavailable", () => {
    const output = buildDashboardRecommendations({
      decisionRecommendations: [],
      balanceSheetSummary: summary,
      goals: [],
      monthlySavings: -2500,
      hasMonthlyReview: false,
      maxItems: 5,
    });

    expect(output.length).toBeGreaterThanOrEqual(3);
    expect(output.some((item) => item.title.includes("Cash Flow") || item.title.includes("Monthly Actuals"))).toBe(true);
  });

  it("returns stable low-priority fallback when core risk signals are absent", () => {
    const output = buildDashboardRecommendations({
      decisionRecommendations: [],
      balanceSheetSummary: { ...summary, debtRatio: 0.2 },
      goals: [],
      monthlySavings: 20000,
      hasMonthlyReview: true,
      maxItems: 5,
    });

    expect(output[0].title).toContain("Asset Allocation Drift");
    expect(output[0].priority).toBe("Low");
  });
});
