import { describe, expect, it, vi } from "vitest";

import { DecisionEngine } from "./DecisionEngine";
import type { DecisionRecommendation } from "./DecisionTypes";
import type { HealthScore } from "@/types/healthScore";

function createHealthScore(overrides?: Partial<HealthScore>): HealthScore {
  return {
    overallScore: 72,
    grade: "C",
    strengths: [],
    watchItems: [],
    recommendations: [],
    trend: [],
    components: [
      { key: "liquidity", label: "Liquidity", weight: 20, score: 75, weightedScore: 15, detail: "Cash ratio 10.0% and liquidity coverage 0.55x." },
      { key: "debt", label: "Debt", weight: 15, score: 61, weightedScore: 9.15, detail: "Debt ratio 42.0% with monthly review variance 120,000." },
      { key: "goals", label: "Goals", weight: 25, score: 68, weightedScore: 17, detail: "1 completed, 1 on-track, 1 at-risk goals." },
      { key: "retirement", label: "Retirement", weight: 20, score: 62, weightedScore: 12.4, detail: "Retirement allocation 13.0% with projected net-worth change 800000." },
      { key: "diversification", label: "Diversification", weight: 10, score: 64, weightedScore: 6.4, detail: "Diversification spans 3 categories with largest share 56.0%." },
      { key: "emergencyFund", label: "Emergency Fund", weight: 10, score: 58, weightedScore: 5.8, detail: "Emergency coverage is 3.5 months based on cash flow and EMI commitments." },
    ],
    ...overrides,
  };
}

function createEngine(overrides?: {
  healthScore?: HealthScore;
  debtRatio?: number;
  goalProgresses?: number[];
  cashFlowDelta?: number;
}) {
  const repositoryState: DecisionRecommendation[] = [];

  const repository = {
    listRecommendations: vi.fn(async () => [...repositoryState]),
    upsertRecommendations: vi.fn(async (items: DecisionRecommendation[]) => {
      repositoryState.splice(0, repositoryState.length, ...items);
    }),
    updateStatus: vi.fn(async (id: string, status: "Open" | "Dismissed") => {
      const target = repositoryState.find((item) => item.id === id);
      if (target) {
        target.status = status;
      }
    }),
  };

  const goals = (overrides?.goalProgresses ?? [65]).map((progress, index) => ({
    id: `goal-${index + 1}`,
    user_id: "user-1",
    name: `Goal ${index + 1}`,
    goal_type: "CUSTOM",
    target_amount: 1000000,
    target_date: "2030-12-31",
    priority: "MEDIUM",
    status: progress >= 70 ? "ON_TRACK" : "NEEDS_ATTENTION",
    funding_source: null,
    linked_scenario_id: null,
    notes: null,
    is_completed: false,
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z",
    progress: {
      goal_id: `goal-${index + 1}`,
      target_amount: 1000000,
      projected_amount: 650000,
      progress_percent: progress,
      status: progress >= 70 ? "ON_TRACK" : "NEEDS_ATTENTION",
      projection_month: "2030-12",
    },
    linked_scenario_name: null,
  }));

  const engine = new DecisionEngine({
    repository: repository as never,
    balanceSheetLoader: vi.fn(async () => ({
      summary: {
        debtRatio: overrides?.debtRatio ?? 0.42,
        totalAssets: 10000000,
        totalInvestments: 3000000,
        totalLiabilities: 5500000,
        totalBalanceSheetAssets: 13000000,
        netWorth: 7500000,
        monthlyEmi: 95000,
        cashHoldings: 800000,
        cashRatio: 0.06,
        liquidityRatio: 0.14,
        investmentRatio: 0.45,
        retirementRatio: 0.1,
        realEstateRatio: 0.32,
        categoryTotals: {
          cashAndBank: 800000,
          investments: 3000000,
          retirement: 1300000,
          fixedDeposits: 400000,
          goldAndSilver: 0,
          realEstate: 3500000,
          vehicles: 500000,
          otherAssets: 4500000,
          homeLoan: 4200000,
          carLoan: 500000,
          creditCards: 300000,
          personalLoan: 300000,
          otherLiabilities: 200000,
        },
        assetAllocation: [
          { name: "Real Estate", value: 3500000 },
          { name: "Investments", value: 3000000 },
          { name: "Other Assets", value: 4500000 },
        ],
        liabilityAllocation: [
          { name: "Home Loan", value: 4200000 },
          { name: "Other Liabilities", value: 1300000 },
        ],
        largestAsset: null,
        largestLiability: null,
        assetSections: [],
        liabilitySections: [],
      },
    })),
    healthScoreLoader: vi.fn(async () => createHealthScore(overrides?.healthScore)),
    goalsLoader: vi.fn(async () => goals as never),
    scenarioLoader: vi.fn(async () => [{ id: "scenario-1", is_active: true, is_default: false }] as never),
    scenarioSimulationLoader: vi.fn(async () => ({
      summary: {
        snapshotId: "scenario-1",
        projectionStart: "2026-01",
        projectionEnd: "2031-12",
        snapshotCount: 72,
        openingNetWorth: 1000000,
        finalNetWorth: 1500000,
        netWorthChange: 500000,
      },
      monthlySnapshots: [],
      goalReadiness: { status: "not-evaluated", message: "n/a" },
      cashFlowForecast: { points: [{ month: "2031-12", value: 150000, delta: overrides?.cashFlowDelta ?? -75000 }] },
      netWorthProjection: { points: [] },
      assetProjection: { points: [] },
      liabilityProjection: { points: [] },
      metadata: { snapshotId: "scenario-1", projectionStart: "2026-01", projectionEnd: "2031-12", scenarioOverridesApplied: true, assumptionCount: 7, eventCount: 0, timelineMonths: 72 },
      executionTime: 1,
      simulationVersion: "test",
    })),
    monthlyReviewLoader: vi.fn(async () => ({ summary: { projectionVariance: 100000 } } as never)),
    baselineSimulationLoader: vi.fn(async () => ({
      summary: {
        snapshotId: "baseline",
        projectionStart: "2026-01",
        projectionEnd: "2031-12",
        snapshotCount: 72,
        openingNetWorth: 1000000,
        finalNetWorth: 1400000,
        netWorthChange: 400000,
      },
      monthlySnapshots: [],
      goalReadiness: { status: "not-evaluated", message: "n/a" },
      cashFlowForecast: { points: [{ month: "2031-12", value: 100000, delta: -20000 }] },
      netWorthProjection: { points: [] },
      assetProjection: { points: [] },
      liabilityProjection: { points: [] },
      metadata: { snapshotId: "baseline", projectionStart: "2026-01", projectionEnd: "2031-12", scenarioOverridesApplied: false, assumptionCount: 7, eventCount: 0, timelineMonths: 72 },
      executionTime: 1,
      simulationVersion: "test",
    })),
    now: () => new Date("2026-07-21T00:00:00.000Z"),
  });

  return { engine, repository };
}

describe("DecisionEngine", () => {
  it("creates emergency fund recommendation rule", async () => {
    const { engine } = createEngine();
    const recommendations = await engine.generateRecommendations();

    const target = recommendations.find((item) => item.id === "decision-emergency-fund");
    expect(target).toBeTruthy();
    expect(target?.priority).toBe("High");
    expect(target?.confidence).toBeGreaterThan(0.8);
  });

  it("creates retirement score recommendation rule", async () => {
    const { engine } = createEngine();
    const recommendations = await engine.generateRecommendations();

    const target = recommendations.find((item) => item.id === "decision-retirement-score");
    expect(target).toBeTruthy();
    expect(target?.category).toBe("Retirement");
    expect(target?.confidence).toBe(0.88);
  });

  it("creates debt ratio recommendation rule", async () => {
    const { engine } = createEngine({ debtRatio: 0.52 });
    const recommendations = await engine.generateRecommendations();

    const target = recommendations.find((item) => item.id === "decision-debt-ratio");
    expect(target).toBeTruthy();
    expect(target?.priority).toBe("Critical");
    expect(target?.severity).toBe("Red");
  });

  it("creates goal progress recommendation rule", async () => {
    const { engine } = createEngine({ goalProgresses: [65, 75, 35] });
    const recommendations = await engine.generateRecommendations();

    const goalRules = recommendations.filter((item) => item.id.startsWith("decision-goal-progress-"));
    expect(goalRules).toHaveLength(2);
    expect(goalRules.some((item) => item.priority === "High")).toBe(true);
  });

  it("creates portfolio rebalance recommendation rule", async () => {
    const { engine } = createEngine();
    const recommendations = await engine.generateRecommendations();

    const target = recommendations.find((item) => item.id === "decision-portfolio-rebalance");
    expect(target).toBeTruthy();
    expect(target?.category).toBe("Portfolio");
  });

  it("creates cash-flow recommendation rule", async () => {
    const { engine } = createEngine({ cashFlowDelta: -120000 });
    const recommendations = await engine.generateRecommendations();

    const target = recommendations.find((item) => item.id === "decision-cashflow-pressure");
    expect(target).toBeTruthy();
    expect(target?.priority).toBe("High");
  });

  it("prioritizes recommendations by priority then confidence", async () => {
    const { engine } = createEngine();
    const sorted = engine.prioritizeRecommendations([
      {
        id: "a",
        title: "A",
        category: "Debt",
        priority: "Medium",
        severity: "Amber",
        reason: "a",
        recommendedAction: "a",
        expectedBenefit: "a",
        confidence: 0.9,
        status: "Open",
        createdAt: "2026-07-21T00:00:00.000Z",
      },
      {
        id: "b",
        title: "B",
        category: "Debt",
        priority: "High",
        severity: "Amber",
        reason: "b",
        recommendedAction: "b",
        expectedBenefit: "b",
        confidence: 0.6,
        status: "Open",
        createdAt: "2026-07-21T00:00:00.000Z",
      },
      {
        id: "c",
        title: "C",
        category: "Debt",
        priority: "High",
        severity: "Amber",
        reason: "c",
        recommendedAction: "c",
        expectedBenefit: "c",
        confidence: 0.95,
        status: "Open",
        createdAt: "2026-07-21T00:00:00.000Z",
      },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["c", "b", "a"]);
  });

  it("persists dismiss status through refresh", async () => {
    const { engine } = createEngine();
    const initial = await engine.refreshRecommendations();
    const target = initial[0];

    await engine.dismissRecommendation(target.id);
    const refreshed = await engine.refreshRecommendations();

    expect(refreshed.find((item) => item.id === target.id)?.status).toBe("Dismissed");
  });
});
