import { describe, expect, it, vi, beforeEach } from "vitest";

const runtime = vi.hoisted(() => ({
  getBalanceSheetData: vi.fn(),
  buildAssetSummaryFromAssets: vi.fn(),
  buildCashFlowSummary: vi.fn(),
  getCashFlowSummary: vi.fn(),
  buildInvestmentSummary: vi.fn(),
  listGoals: vi.fn(),
  getAssumptionsBundle: vi.fn(),
  getRetirementSummary: vi.fn(),
  listEvents: vi.fn(),
  loadHistory: vi.fn(),
  simulationRun: vi.fn(),
  buildContext: vi.fn(),
  projectionRun: vi.fn(),
  getMonthlyReviewWorkspace: vi.fn(),
  getNetWorthTrendPoints: vi.fn(),
  calculateHealthScore: vi.fn(),
  generateRecommendations: vi.fn(),
}));

vi.mock("@/services/balanceSheet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/balanceSheet")>();

  return {
    ...actual,
    getBalanceSheetData: runtime.getBalanceSheetData,
  };
});

vi.mock("@/services/assetManagement", () => ({
  buildAssetSummaryFromAssets: runtime.buildAssetSummaryFromAssets,
}));

vi.mock("@/services/cashFlowManagement", () => ({
  buildCashFlowSummary: runtime.buildCashFlowSummary,
  cashFlowManagementService: {
    getCashFlowSummary: runtime.getCashFlowSummary,
  },
}));

vi.mock("@/services/investments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/investments")>();

  return {
    ...actual,
    buildInvestmentSummary: runtime.buildInvestmentSummary,
  };
});

vi.mock("@/services/loanManagement", () => ({
  isManagedLoanType: vi.fn((type: string) => type === "Home Loan" || type === "Car Loan" || type === "Personal Loan" || type === "Education Loan" || type === "Loan Against Property"),
}));

vi.mock("@/services/planning/goals", () => ({
  goalService: {
    listGoals: runtime.listGoals,
  },
}));

vi.mock("@/services/assumptions", () => ({
  DEFAULT_SCENARIO_KEY: "default",
  assumptionsService: {
    getAssumptionsBundle: runtime.getAssumptionsBundle,
  },
}));

vi.mock("@/services/retirement", () => ({
  getRetirementSummary: runtime.getRetirementSummary,
}));

vi.mock("@/services/projection/events", () => ({
  projectionEventsService: {
    listEvents: runtime.listEvents,
  },
}));

vi.mock("@/services/snapshots", () => ({
  snapshotReadModel: {
    loadHistory: runtime.loadHistory,
  },
}));

vi.mock("@/services/planning/scenarios", () => ({
  createPlanningScenarioProductionSimulationEngine: () => ({
    run: runtime.simulationRun,
  }),
}));

vi.mock("@/services/projection", () => ({
  projectionInputService: {
    buildContext: runtime.buildContext,
  },
  projectionEngine: {
    run: runtime.projectionRun,
  },
  monthlyReviewService: {
    getMonthlyReviewWorkspace: runtime.getMonthlyReviewWorkspace,
    getNetWorthTrendPoints: runtime.getNetWorthTrendPoints,
  },
}));

vi.mock("@/services/health", () => ({
  healthScoreService: {
    calculateHealthScore: runtime.calculateHealthScore,
  },
}));

vi.mock("@/services/decision", () => ({
  decisionEngine: {
    generateRecommendations: runtime.generateRecommendations,
  },
}));

import { ExecutiveDashboardService } from "./ExecutiveDashboardService";

describe("ExecutiveDashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    runtime.getBalanceSheetData.mockResolvedValue({
      assets: [{ id: "asset-1" }],
      investments: [{ id: "inv-1" }],
      liabilities: [
        {
          id: "loan-1",
          user_id: "user-1",
          account_name: "Mortgage",
          liability_type: "Home Loan",
          status: "active",
          outstanding_amount: 400000,
          interest_rate: 9.5,
          emi: 32000,
        },
      ],
      summary: {
        totalBalanceSheetAssets: 1500000,
        totalAssets: 900000,
        totalInvestments: 600000,
        totalLiabilities: 400000,
        netWorth: 1100000,
        debtRatio: 0.26,
        monthlyEmi: 32000,
        cashHoldings: 150000,
        cashRatio: 0.1,
        assetAllocation: [],
        liabilityAllocation: [],
        largestAsset: null,
        largestLiability: null,
        categoryTotals: {
          investments: 600000,
          retirement: 450000,
          fixedDeposits: 0,
          goldAndSilver: 0,
        },
      },
    });

    runtime.buildInvestmentSummary.mockReturnValue({
      totalInvestmentValue: 600000,
      assetAllocation: [],
      cagr: 11,
    });

    runtime.buildAssetSummaryFromAssets.mockReturnValue({
      totalAssets: 900000,
      assetCount: 1,
      largestAsset: null,
    });

    runtime.buildCashFlowSummary.mockImplementation((income, expenses, commitments) => ({
      monthlyIncome: Number(income?.[0]?.monthlyAmount ?? 0),
      monthlyAutomaticCommitments: Number(commitments?.[0]?.monthlyAmount ?? 0),
      monthlyManualExpenses: Number(expenses?.[0]?.monthlyAmount ?? 0),
      monthlyExpenses: Number(expenses?.[0]?.monthlyAmount ?? 0) + Number(commitments?.[0]?.monthlyAmount ?? 0),
      monthlySavings: Number(income?.[0]?.monthlyAmount ?? 0) - (Number(expenses?.[0]?.monthlyAmount ?? 0) + Number(commitments?.[0]?.monthlyAmount ?? 0)),
      savingsRate: 0,
    }));

    runtime.getCashFlowSummary.mockResolvedValue({
      monthlyIncome: 130000,
      monthlyAutomaticCommitments: 47000,
      monthlyManualExpenses: 60000,
      monthlyExpenses: 107000,
      monthlySavings: 23000,
      savingsRate: 0.18,
    });

    runtime.listGoals.mockResolvedValue([
      {
        id: "goal-1",
        name: "Retirement",
        status: "ON_TRACK",
        target_amount: 1000000,
        progress: {
          progress_percent: 65,
          target_amount: 1000000,
          projected_amount: 700000,
        },
      },
    ]);

    runtime.getAssumptionsBundle.mockResolvedValue({
      income: {
        monthlyIncome: 100000,
        otherMonthlyIncome: 5000,
        rentalIncome: 10000,
        businessIncome: 15000,
      },
      investments: {
        monthlySipAmount: 12000,
        stockInvestmentAmount: 8000,
        expectedReturnRate: 10,
      },
      loans: {
        averageInterestRate: 9.5,
      },
      planning: {
        startMonth: "2026-07",
        endYear: 2036,
        endMonth: 12,
      },
      retirement: {
        salaryStopMonth: 6,
        salaryStopYear: 2042,
      },
    });

    runtime.getRetirementSummary.mockResolvedValue({
      totalRetirementAssets: 450000,
      count: 3,
    });

    runtime.listEvents.mockResolvedValue([]);
    runtime.loadHistory.mockResolvedValue([]);

    runtime.simulationRun.mockResolvedValue({
      ok: true,
      result: {
        summary: {
          projectionEnd: "2026-12",
          netWorthChange: 25000,
        },
        monthlySnapshots: [
          {
            closingBalances: { investments: 650000 },
          },
        ],
      },
    });

    runtime.buildContext.mockResolvedValue({});
    runtime.projectionRun.mockResolvedValue({
      monthlyLedger: [
        {
          salary: 100000,
          bonus: 0,
          rentalIncome: 10000,
          businessIncome: 15000,
          otherIncome: 5000,
          livingExpenses: 60000,
          insurancePremium: 5000,
          taxes: 10000,
          emis: 32000,
          investmentContributions: 20000,
        },
      ],
      snapshots: [
        {
          openingBalance: 1100000,
          closingBalance: 1120000,
        },
      ],
    });

    runtime.getMonthlyReviewWorkspace.mockResolvedValue({
      periods: [
        {
          closeId: "close-1",
          month: 7,
          year: 2026,
          monthKey: "2026-07",
          label: "Jul 2026",
          versionNumber: 1,
        },
      ],
      selectedPeriod: {
        closeId: "close-1",
        month: 7,
        year: 2026,
        monthKey: "2026-07",
        label: "Jul 2026",
        versionNumber: 1,
      },
      entities: [
        {
          rowKey: "liability:loan-1",
          entityId: "loan-1",
          entityType: "liability",
          entityTypeLabel: "Liability",
          entityName: "Mortgage",
          itemKey: "home_loans",
          itemLabel: "Home Loan",
          itemType: "liability",
          openingValue: 420000,
          projectedValue: 410000,
          actualValue: 400000,
          absoluteVariance: -10000,
          percentageVariance: -2.4,
          netWorthChangeContribution: 20000,
        },
      ],
      kpis: [
        {
          key: "net_worth",
          label: "Net Worth",
          projected: 1080000,
          actual: 1100000,
          absoluteVariance: 20000,
          percentageVariance: 1.8,
        },
      ],
      summary: {
        totalAssets: 1500000,
        totalLiabilities: 400000,
        netWorth: 1100000,
        projectionVariance: 20000,
        monthOverMonthChange: 45000,
        yearToDateChange: 120000,
        largestPositiveVariance: null,
        largestNegativeVariance: null,
        topContributors: [],
      },
    });

    runtime.getNetWorthTrendPoints.mockResolvedValue([
      {
        month: "Jul 2026",
        actual: 1100000,
        planned: 1080000,
      },
    ]);

    runtime.calculateHealthScore.mockResolvedValue({
      overallScore: 81,
      grade: "B",
      strengths: [],
      watchItems: [],
      recommendations: [],
      trend: [],
      components: [
        {
          key: "emergencyFund",
          label: "Emergency Fund",
          weight: 10,
          score: 68,
          weightedScore: 6.8,
          detail: "Coverage is healthy.",
        },
      ],
    });

    runtime.generateRecommendations.mockResolvedValue([]);
  });

  it("builds the executive dashboard payload from existing services", async () => {
    const service = new ExecutiveDashboardService();
    const result = await service.getDashboard();

    expect(runtime.getBalanceSheetData).toHaveBeenCalledTimes(1);
    expect(runtime.buildAssetSummaryFromAssets).toHaveBeenCalledWith([{ id: "asset-1" }]);
    expect(runtime.getCashFlowSummary).toHaveBeenCalledTimes(1);
    expect(runtime.buildInvestmentSummary).toHaveBeenCalledWith([{ id: "inv-1" }]);
    expect(runtime.getMonthlyReviewWorkspace).toHaveBeenCalledTimes(1);
    expect(runtime.getNetWorthTrendPoints).toHaveBeenCalledTimes(1);

    expect(result.executiveSummary.netWorth).toBe(1100000);
    expect(result.executiveSummary.assets).toBe(900000);
    expect(result.executiveSummary.liabilities).toBe(400000);
    expect(result.investments.currentPortfolio).toBe(600000);
    expect(result.investments.projectedValue).toBe(650000);
    expect(result.loans.outstanding).toBe(400000);
    expect(result.loans.emi).toBe(32000);
    expect(result.loans.interestRate).toBe(9.5);
    expect(result.loans.activeLoans).toBe(1);
    expect(result.goals.items[0].gap).toBe(300000);
    expect(result.monthlySummary.income).toBe(130000);
    expect(result.monthlySummary.expenses).toBe(107000);
    expect(result.monthlySummary.savings).toBe(23000);
    expect(result.monthlySummary.netWorthChange).toBe(20000);
    expect(result.retirement.available).toBe(true);
    expect(result.retirement.totalRetirementAssets).toBe(450000);
    expect(result.retirement.readinessPercent).toBeNull();
    expect(result.retirement.planAlignmentStatus).toBe("Data required");
  });

  it("keeps current and planned corpus scope aligned with retirement-classified assets", async () => {
    runtime.getBalanceSheetData.mockResolvedValueOnce({
      assets: [{ id: "asset-1" }],
      investments: [{ id: "inv-1" }],
      liabilities: [],
      summary: {
        totalBalanceSheetAssets: 1500000,
        totalAssets: 900000,
        totalInvestments: 600000,
        totalLiabilities: 0,
        netWorth: 1500000,
        debtRatio: 0,
        monthlyEmi: 0,
        cashHoldings: 150000,
        cashRatio: 0.1,
        assetAllocation: [],
        liabilityAllocation: [],
        largestAsset: null,
        largestLiability: null,
        categoryTotals: {
          investments: 600000,
          retirement: 500000,
          fixedDeposits: 0,
          goldAndSilver: 0,
        },
      },
    });

    runtime.projectionRun.mockResolvedValueOnce({
      monthlyLedger: [
        {
          salary: 100000,
          bonus: 0,
          rentalIncome: 10000,
          businessIncome: 15000,
          otherIncome: 5000,
          livingExpenses: 60000,
          insurancePremium: 5000,
          taxes: 10000,
          emis: 0,
          investmentContributions: 20000,
        },
      ],
      snapshots: [
        {
          openingBalance: 1500000,
          closingBalance: 1550000,
          closingBalances: {
            retirement: 625000,
            investments: 700000,
            liabilities: 0,
          },
        },
      ],
    });

    const service = new ExecutiveDashboardService();
    const result = await service.getDashboard();

    expect(result.retirement.totalRetirementAssets).toBe(500000);
    expect(result.retirement.plannedCorpusAtHorizonEnd).toBe(625000);
    expect(result.retirement.gapOrSurplusVsPlannedCorpus).toBe(-125000);
    expect(result.retirement.retirementVariance).toBe(-125000);
  });

  it("handles missing goals and missing monthly snapshots with explicit empty states", async () => {
    runtime.listGoals.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    runtime.getMonthlyReviewWorkspace.mockResolvedValueOnce({
      periods: [],
      selectedPeriod: null,
      entities: [],
      kpis: [],
      summary: null,
    });
    runtime.getNetWorthTrendPoints.mockResolvedValueOnce([]);

    const service = new ExecutiveDashboardService();
    const result = await service.getDashboard();

    expect(result.goals.total).toBe(0);
    expect(result.goals.heatmap).toEqual([]);
    expect(result.monthlyReviewSummary.available).toBe(false);
    expect(result.netWorthTrend.available).toBe(false);
    expect(result.netWorthTrend.message).toBe("Add monthly snapshots to view net worth trend.");
  });

  it("returns partial data if monthly review summary fails", async () => {
    runtime.getMonthlyReviewWorkspace.mockRejectedValueOnce(new Error("Monthly review unavailable"));

    const service = new ExecutiveDashboardService();
    const result = await service.getDashboardCore();

    expect(result.executiveSummary.netWorth).toBe(1100000);
    expect(result.monthlyReviewSummary.available).toBe(false);
    expect(result.monthlyReviewSummary.ctaLabel).toBe("Start Monthly Review");
  });

  it("returns partial data if retirement summary fails", async () => {
    runtime.getRetirementSummary.mockRejectedValueOnce(new Error("Retirement unavailable"));

    const service = new ExecutiveDashboardService();
    const result = await service.getDashboardCore();

    expect(result.retirement.available).toBe(true);
    expect(result.retirement.accountsCount).toBeNull();
    expect(result.retirement.totalRetirementAssets).toBe(450000);
  });

  it("returns partial data if assumptions are missing", async () => {
    runtime.getAssumptionsBundle.mockRejectedValueOnce(new Error("Assumptions unavailable"));

    const service = new ExecutiveDashboardService();
    const result = await service.getDashboardCore();

    expect(result.executiveSummary.netWorth).toBe(1100000);
    expect(result.investments.plannedPortfolio).toBe(650000);
    expect(result.investments.monthlyInvestment).toBe(0);
    expect(result.retirement.retirementDate).toBeNull();
    expect(result.retirement.projectionEndDate).toBeNull();
  });

  it("hard-fails when auth or user context is unavailable", async () => {
    runtime.getBalanceSheetData.mockRejectedValueOnce(new Error("Authentication required."));

    const service = new ExecutiveDashboardService();

    await expect(service.getDashboardCore()).rejects.toThrow("Authentication required.");
  });

  it("loads core dashboard without optional-heavy services", async () => {
    const service = new ExecutiveDashboardService();
    const result = await service.getDashboardCore();

    expect(runtime.generateRecommendations).not.toHaveBeenCalled();
    expect(runtime.calculateHealthScore).not.toHaveBeenCalled();
    expect(runtime.getNetWorthTrendPoints).not.toHaveBeenCalled();
    expect(runtime.buildContext).not.toHaveBeenCalled();
    expect(runtime.projectionRun).not.toHaveBeenCalled();

    expect(result.goals.items).toEqual([]);
    expect(result.goals.heatmap).toEqual([]);
    expect(result.recommendedActions).toEqual([]);
    expect(result.netWorthTrend.available).toBe(false);
    expect(result.netWorthTrend.points).toEqual([]);
    expect(result.netWorthTrend.message).toBe("Loading trend data...");
  });

  it("marks empty state when assets and liabilities are zero", async () => {
    runtime.getBalanceSheetData.mockResolvedValueOnce({
      assets: [],
      investments: [],
      liabilities: [],
      summary: {
        totalBalanceSheetAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        monthlyEmi: 0,
        categoryTotals: {
          investments: 0,
          retirement: 0,
          fixedDeposits: 0,
          goldAndSilver: 0,
        },
      },
    });

    const service = new ExecutiveDashboardService();
    const result = await service.getDashboard();

    expect(result.emptyState).toBe(true);
  });
});
