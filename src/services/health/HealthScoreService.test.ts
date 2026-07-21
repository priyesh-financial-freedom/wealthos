import { describe, expect, it } from "vitest";

import { HealthScoreService } from "./HealthScoreService";
import type { FinancialGoalWithProgress } from "@/types/financialGoal";
import type { SimulationResult } from "@/services/simulation";

const baseSummary = {
  totalAssets: 4500000,
  totalInvestments: 3200000,
  totalLiabilities: 1800000,
  totalBalanceSheetAssets: 7700000,
  netWorth: 5900000,
  debtRatio: 1800000 / 7700000,
  monthlyEmi: 55000,
  cashHoldings: 900000,
  cashRatio: 900000 / 7700000,
  liquidityRatio: 900000 / 1800000,
  investmentRatio: 0.41,
  retirementRatio: 0.17,
  realEstateRatio: 0.28,
  assetAllocation: [
    { name: "Cash & Bank", value: 900000 },
    { name: "Investments", value: 2800000 },
    { name: "Retirement", value: 1300000 },
    { name: "Real Estate", value: 2100000 },
    { name: "Other Assets", value: 600000 },
  ],
  liabilityAllocation: [
    { name: "Home Loan", value: 1200000 },
    { name: "Car Loan", value: 300000 },
    { name: "Other Liabilities", value: 300000 },
  ],
  largestAsset: null,
  largestLiability: null,
  categoryTotals: {
    cashAndBank: 900000,
    investments: 2800000,
    retirement: 1300000,
    fixedDeposits: 400000,
    goldAndSilver: 0,
    realEstate: 2100000,
    vehicles: 300000,
    otherAssets: 1200000,
    homeLoan: 1200000,
    carLoan: 300000,
    creditCards: 0,
    personalLoan: 0,
    otherLiabilities: 300000,
  },
  assetSections: [],
  liabilitySections: [],
};

const goals: FinancialGoalWithProgress[] = [
  {
    id: "goal-1",
    user_id: "user-1",
    name: "Retirement Corpus",
    goal_type: "RETIREMENT",
    target_amount: 5000000,
    target_date: "2035-12-31",
    priority: "HIGH",
    status: "ON_TRACK",
    funding_source: null,
    linked_scenario_id: null,
    notes: null,
    is_completed: false,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    progress: {
      goal_id: "goal-1",
      target_amount: 5000000,
      projected_amount: 4600000,
      progress_percent: 92,
      status: "ON_TRACK",
      projection_month: "2035-12",
    },
    linked_scenario_name: null,
  },
  {
    id: "goal-2",
    user_id: "user-1",
    name: "Education Fund",
    goal_type: "EDUCATION",
    target_amount: 1500000,
    target_date: "2030-06-30",
    priority: "MEDIUM",
    status: "NEEDS_ATTENTION",
    funding_source: null,
    linked_scenario_id: null,
    notes: null,
    is_completed: false,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    progress: {
      goal_id: "goal-2",
      target_amount: 1500000,
      projected_amount: 900000,
      progress_percent: 60,
      status: "NEEDS_ATTENTION",
      projection_month: "2030-06",
    },
    linked_scenario_name: null,
  },
  {
    id: "goal-3",
    user_id: "user-1",
    name: "Vacation Home",
    goal_type: "HOME_PURCHASE",
    target_amount: 3000000,
    target_date: "2029-03-31",
    priority: "LOW",
    status: "AT_RISK",
    funding_source: null,
    linked_scenario_id: null,
    notes: null,
    is_completed: false,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    progress: {
      goal_id: "goal-3",
      target_amount: 3000000,
      projected_amount: 600000,
      progress_percent: 20,
      status: "AT_RISK",
      projection_month: "2029-03",
    },
    linked_scenario_name: null,
  },
];

const simulation: SimulationResult = {
  summary: {
    snapshotId: "health-score",
    projectionStart: "2026-01",
    projectionEnd: "2036-12",
    snapshotCount: 132,
    openingNetWorth: 5900000,
    finalNetWorth: 11400000,
    netWorthChange: 5500000,
  },
  monthlySnapshots: [],
  goalReadiness: { status: "not-evaluated", message: "Not evaluated" },
  cashFlowForecast: {
    points: [
      { month: "2026-10", value: 850000, delta: -30000 },
      { month: "2026-11", value: 820000, delta: -30000 },
      { month: "2026-12", value: 870000, delta: 50000 },
    ],
  },
  netWorthProjection: { points: [] },
  assetProjection: { points: [] },
  liabilityProjection: { points: [] },
  metadata: {
    snapshotId: "health-score",
    projectionStart: "2026-01",
    projectionEnd: "2036-12",
    scenarioOverridesApplied: false,
    assumptionCount: 7,
    eventCount: 0,
    timelineMonths: 132,
  },
  executionTime: 1,
  simulationVersion: "test",
};

const monthlyHistory = {
  records: [
    {
      snapshot: {
        snapshot_month: 4,
        snapshot_year: 2026,
        assets_total: 7300000,
        liabilities_total: 2000000,
        investments_total: 0,
        net_worth: 5300000,
        growth_from_previous_month: 40000,
      },
      monthLabel: "Apr 2026",
    },
    {
      snapshot: {
        snapshot_month: 5,
        snapshot_year: 2026,
        assets_total: 7400000,
        liabilities_total: 1940000,
        investments_total: 0,
        net_worth: 5460000,
        growth_from_previous_month: 160000,
      },
      monthLabel: "May 2026",
    },
    {
      snapshot: {
        snapshot_month: 6,
        snapshot_year: 2026,
        assets_total: 7700000,
        liabilities_total: 1800000,
        investments_total: 0,
        net_worth: 5900000,
        growth_from_previous_month: 440000,
      },
      monthLabel: "Jun 2026",
    },
  ],
} as never;

function createService() {
  return new HealthScoreService({
    balanceSheetLoader: async () => ({ summary: baseSummary as never }),
    goalsLoader: async () => goals,
    simulationLoader: async () => simulation,
    monthlyHistoryLoader: async () => monthlyHistory,
    monthlyReviewVarianceLoader: async () => 120000,
  });
}

describe("HealthScoreService", () => {
  it("calculates liquidity component score", async () => {
    const service = createService();
    const score = await service.calculateHealthScore();
    const liquidity = score.components.find((component) => component.key === "liquidity");

    expect(liquidity).toBeTruthy();
    expect(liquidity?.score).toBeGreaterThan(60);
  });

  it("calculates debt component score", async () => {
    const service = createService();
    const score = await service.calculateHealthScore();
    const debt = score.components.find((component) => component.key === "debt");

    expect(debt).toBeTruthy();
    expect(debt?.score).toBeGreaterThan(50);
  });

  it("calculates goals component score", async () => {
    const service = createService();
    const score = await service.calculateHealthScore();
    const goalsComponent = score.components.find((component) => component.key === "goals");

    expect(goalsComponent).toBeTruthy();
    expect(goalsComponent?.score).toBeLessThan(90);
    expect(score.watchItems.some((item) => item.includes("at risk"))).toBe(true);
  });

  it("calculates retirement component score", async () => {
    const service = createService();
    const score = await service.calculateHealthScore();
    const retirement = score.components.find((component) => component.key === "retirement");

    expect(retirement).toBeTruthy();
    expect(retirement?.score).toBeGreaterThan(55);
  });

  it("calculates weighted overall score and grade", async () => {
    const service = createService();
    const score = await service.calculateHealthScore();

    expect(score.overallScore).toBeGreaterThan(0);
    expect(["A+", "A", "B", "C", "Needs Attention"]).toContain(score.grade);
    expect(score.components).toHaveLength(6);
  });

  it("returns actionable recommendations", async () => {
    const service = createService();
    const score = await service.calculateHealthScore();

    expect(score.recommendations.length).toBeGreaterThan(0);
    expect(score.recommendations.join(" ")).toMatch(/revisit funding|retirement|rebalance|emergency/i);
  });
});
