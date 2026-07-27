import { describe, expect, it, vi, beforeEach } from "vitest";

const runtime = vi.hoisted(() => ({
  getBalanceSheetData: vi.fn(),
  buildAssetSummaryFromAssets: vi.fn(),
  buildCashFlowSummary: vi.fn(),
  getCashFlowSummary: vi.fn(),
  buildInvestmentSummary: vi.fn(),
  buildLoanSummaryFromLiabilities: vi.fn(),
  listGoals: vi.fn(),
  getAssumptionsBundle: vi.fn(),
  simulationRun: vi.fn(),
  buildContext: vi.fn(),
  projectionRun: vi.fn(),
}));

vi.mock("@/services/balanceSheet", () => ({
  getBalanceSheetData: runtime.getBalanceSheetData,
}));

vi.mock("@/services/assetManagement", () => ({
  buildAssetSummaryFromAssets: runtime.buildAssetSummaryFromAssets,
}));

vi.mock("@/services/cashFlowManagement", () => ({
  buildCashFlowSummary: runtime.buildCashFlowSummary,
  cashFlowManagementService: {
    getCashFlowSummary: runtime.getCashFlowSummary,
  },
}));

vi.mock("@/services/investments", () => ({
  buildInvestmentSummary: runtime.buildInvestmentSummary,
}));

vi.mock("@/services/loanManagement", () => ({
  buildLoanSummaryFromLiabilities: runtime.buildLoanSummaryFromLiabilities,
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
}));

import { ExecutiveDashboardService } from "./ExecutiveDashboardService";

describe("ExecutiveDashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    runtime.getBalanceSheetData.mockResolvedValue({
      assets: [{ id: "asset-1" }],
      investments: [{ id: "inv-1" }],
      liabilities: [{ id: "loan-1" }],
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

    runtime.buildLoanSummaryFromLiabilities.mockReturnValue({
      totalOutstanding: 400000,
      totalEmi: 32000,
      averageInterestRate: 9.5,
      activeLoans: 2,
      closedLoans: 1,
      upcomingPrepayments: 1,
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
      },
    });

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
  });

  it("builds the executive dashboard payload from existing services", async () => {
    const service = new ExecutiveDashboardService();
    const result = await service.getDashboard();

    expect(runtime.getBalanceSheetData).toHaveBeenCalledTimes(1);
    expect(runtime.buildAssetSummaryFromAssets).toHaveBeenCalledWith([{ id: "asset-1" }]);
    expect(runtime.getCashFlowSummary).toHaveBeenCalledTimes(1);
    expect(runtime.buildInvestmentSummary).toHaveBeenCalledWith([{ id: "inv-1" }]);
    expect(runtime.buildLoanSummaryFromLiabilities).toHaveBeenCalled();

    expect(result.executiveSummary.netWorth).toBe(1100000);
    expect(result.executiveSummary.assets).toBe(900000);
    expect(result.investments.currentPortfolio).toBe(600000);
    expect(result.investments.projectedValue).toBe(650000);
    expect(result.loans.interestRate).toBe(9.5);
    expect(result.loans.activeLoans).toBe(2);
    expect(result.goals.items[0].gap).toBe(300000);
    expect(result.monthlySummary.income).toBe(130000);
    expect(result.monthlySummary.expenses).toBe(107000);
    expect(result.monthlySummary.savings).toBe(23000);
    expect(result.monthlySummary.netWorthChange).toBe(20000);
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
      },
    });

    const service = new ExecutiveDashboardService();
    const result = await service.getDashboard();

    expect(result.emptyState).toBe(true);
  });
});
