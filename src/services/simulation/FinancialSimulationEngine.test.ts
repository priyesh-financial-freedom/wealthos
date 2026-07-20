import { describe, expect, it } from "vitest";

import { FinancialSimulationEngine, buildSimulationContext, buildSimulationInput } from "./FinancialSimulationEngine";
import { SimulationRunner, buildSummary } from "./SimulationRunner";
import type { AssumptionsBundle } from "@/types/assumptions";
import type { FinancialEvent, MonthlySnapshot, ProjectedEntity, ProjectionBalanceState } from "@/types/projection";

function buildSnapshot() {
  return {
    id: "snapshot-1",
    month: "2026-01",
    openingBalances: {
      assets: 100000,
      liabilities: 25000,
      investments: 40000,
      retirement: 15000,
      cash: 15000,
      netWorth: 75000,
    },
    openingEntities: [] as ProjectedEntity[],
  };
}

function buildAssumptions(): AssumptionsBundle {
  return {
    income: {
      monthlyIncome: 10000,
      annualIncrementRate: 0,
      salaryGrowthRate: 0,
      bonusAmount: 0,
      bonusMonth: 3,
      otherMonthlyIncome: 0,
      salaryStopMonth: 7,
      salaryStopYear: 2032,
    },
    investments: {
      monthlySipAmount: 0,
      stockInvestmentAmount: 0,
      annualIncrementRate: 0,
      expectedReturnRate: 0,
      fixedDepositRate: 0,
      goldAppreciationRate: 0,
      realEstateAppreciationRate: 0,
    },
    inflation: {
      generalInflationRate: 0,
      educationInflationRate: 0,
      healthcareInflationRate: 0,
      retirementInflationRate: 0,
    },
    loans: {
      averageInterestRate: 0,
      emiIncrementRate: 0,
      annualPrepaymentAmount: 0,
      annualPrepaymentMonth: 3,
      useExtraCashForPrepayment: false,
    },
    retirement: {
      epfEmployeeContributionRate: 0,
      epfEmployerContributionRate: 0,
      npsContributionRate: 0,
      ppfMonthlyContribution: 0,
      retirementTargetAge: 60,
      salaryStopMonth: 7,
      salaryStopYear: 2032,
    },
    tax: {
      regime: "new",
      effectiveTaxRate: 0,
      surchargeRate: 0,
      cessRate: 0,
      note: "Placeholder",
    },
    planning: {
      startMonth: "2026-01",
      endYear: 2026,
      endMonth: 2,
    },
  };
}

function buildEvents(): FinancialEvent[] {
  return [];
}

function buildMonthlySnapshots(): MonthlySnapshot[] {
  return [
    {
      id: "snapshot-1:2026-01",
      scenarioId: "snapshot-1",
      month: "2026-01",
      openingBalance: 75000,
      closingBalance: 76000,
      contributions: 1000,
      growth: 0,
      loanPrincipalReduction: 0,
      goalFunding: 0,
      inflationImpact: 0,
      eventsApplied: [],
      monthlyLedger: [],
      projectedEntities: [],
      openingBalances: { assets: 100000, liabilities: 25000, investments: 40000, retirement: 15000, cash: 15000, netWorth: 75000 },
      closingBalances: { assets: 101000, liabilities: 25000, investments: 40000, retirement: 15000, cash: 16000, netWorth: 76000 },
    },
    {
      id: "snapshot-1:2026-02",
      scenarioId: "snapshot-1",
      month: "2026-02",
      openingBalance: 76000,
      closingBalance: 78000,
      contributions: 2000,
      growth: 0,
      loanPrincipalReduction: 0,
      goalFunding: 0,
      inflationImpact: 0,
      eventsApplied: [],
      monthlyLedger: [],
      projectedEntities: [],
      openingBalances: { assets: 101000, liabilities: 25000, investments: 40000, retirement: 15000, cash: 16000, netWorth: 76000 },
      closingBalances: { assets: 103000, liabilities: 25000, investments: 40000, retirement: 15000, cash: 18000, netWorth: 78000 },
    },
  ];
}

class StubProjectionCalculator {
  constructor(private readonly onCalculate?: (context: unknown) => void) {}

  async calculate(context: any) {
    this.onCalculate?.(context);

    return {
      timeline: [{ month: "2026-01", year: 2026 }, { month: "2026-02", year: 2026 }],
      monthlySnapshots: buildMonthlySnapshots(),
      scenario: context.scenario,
    };
  }
}

describe("FinancialSimulationEngine", () => {
  it("runs a normal simulation", async () => {
    const engine = new FinancialSimulationEngine({
      snapshotProvider: { loadSnapshot: async () => buildSnapshot() },
      assumptionProvider: { loadAssumptions: async () => buildAssumptions() },
      eventProvider: { loadEvents: async () => buildEvents() },
      runner: new SimulationRunner(new StubProjectionCalculator()),
    });

    const outcome = await engine.run({ snapshotId: "snapshot-1", projectionStart: "2026-01", projectionEnd: "2026-02" });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.summary.snapshotCount).toBe(2);
      expect(outcome.result.summary.finalNetWorth).toBe(78000);
    }
  });

  it("returns structured error when assumptions are missing", async () => {
    const engine = new FinancialSimulationEngine({
      snapshotProvider: { loadSnapshot: async () => buildSnapshot() },
      assumptionProvider: { loadAssumptions: async () => null },
      eventProvider: { loadEvents: async () => buildEvents() },
    });

    const outcome = await engine.run({ snapshotId: "snapshot-1", projectionStart: "2026-01", projectionEnd: "2026-02" });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe("MISSING_ASSUMPTIONS");
    }
  });

  it("applies overrides before projection execution", async () => {
    let capturedContext: any = null;
    const engine = new FinancialSimulationEngine({
      snapshotProvider: { loadSnapshot: async () => buildSnapshot() },
      assumptionProvider: { loadAssumptions: async () => buildAssumptions() },
      eventProvider: { loadEvents: async () => buildEvents() },
      runner: new SimulationRunner(new StubProjectionCalculator((context) => {
        capturedContext = context;
      })),
    });

    const outcome = await engine.run({
      snapshotId: "snapshot-1",
      projectionStart: "2026-01",
      projectionEnd: "2026-02",
      scenarioOverrides: {
        assumptions: {
          income: {
            ...buildAssumptions().income,
            monthlyIncome: 25000,
          },
        },
      },
    });

    expect(outcome.ok).toBe(true);
    expect(capturedContext?.resolvedAssumptions?.income.monthlyIncome).toBe(25000);
  });

  it("executes the projection calculator", async () => {
    let called = false;
    const engine = new FinancialSimulationEngine({
      snapshotProvider: { loadSnapshot: async () => buildSnapshot() },
      assumptionProvider: { loadAssumptions: async () => buildAssumptions() },
      eventProvider: { loadEvents: async () => buildEvents() },
      runner: new SimulationRunner(new StubProjectionCalculator(() => {
        called = true;
      })),
    });

    const outcome = await engine.run({ snapshotId: "snapshot-1", projectionStart: "2026-01", projectionEnd: "2026-02" });

    expect(outcome.ok).toBe(true);
    expect(called).toBe(true);
  });

  it("generates a summary from monthly snapshots", () => {
    const summary = buildSummary("snapshot-1", "2026-01", "2026-02", buildMonthlySnapshots());

    expect(summary.snapshotCount).toBe(2);
    expect(summary.openingNetWorth).toBe(75000);
    expect(summary.finalNetWorth).toBe(78000);
    expect(summary.netWorthChange).toBe(3000);
  });
});
