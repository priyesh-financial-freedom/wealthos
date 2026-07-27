import { describe, expect, it } from "vitest";

import { createProjectionContext } from "./context";
import { runMonthlyPipeline } from "./pipeline";
import { createDefaultFinancialRuleRegistry } from "./rules/defaultRegistry";
import type { FinancialRule } from "./rules/contracts";
import { FinancialRuleRegistry } from "./rules/registry";
import type { ProjectionContext } from "./types";

function baseContext(overrides: Partial<ProjectionContext> = {}): ProjectionContext {
  return createProjectionContext({
    financialPlan: { id: "plan-1" },
    projectionVersion: { id: "version-1", kind: "BASELINE" },
    projectionPeriod: { startMonthKey: "2026-01", months: 12 },
    currentProcessingMonth: "2026-01",
    assumptions: {
      incomeMonthly: 100000,
      incomeAnnualGrowthRate: 0,
      expensesMonthly: 0,
      inflationAnnualRate: 0,
      investmentGrowthAnnualRate: 0,
      contributionMonthly: 0,
      contributionAnnualStepUpRate: 0,
      loans: [],
    },
    openingBalances: {
      cash: 10000,
      investments: 0,
      assets: 10000,
      liabilities: 0,
      loanOutstanding: 0,
      netWorth: 10000,
    },
    assets: [],
    liabilities: [],
    incomeSources: [],
    expenseCategories: [],
    contributionRules: [],
    growthRules: [],
    events: [],
    actualMonthlyData: [],
    ...overrides,
  });
}

describe("FinancialRuleRegistry", () => {
  it("executes active rules in deterministic step/priority/id order", () => {
    const calls: string[] = [];

    const rule = (id: string, step: FinancialRule["step"], priority: number): FinancialRule => ({
      id,
      family: "income",
      step,
      priority,
      appliesTo: () => true,
      execute: () => {
        calls.push(id);
      },
    });

    const registry = new FinancialRuleRegistry();
    registry.registerMany([
      rule("b.rule", "expenses", 20),
      rule("a.rule", "expenses", 20),
      rule("z.rule", "income", 50),
      rule("y.rule", "income", 10),
      rule("x.rule", "asset-appreciation", 1),
    ]);

    const stateInput = {
      context: baseContext(),
      monthKey: "2026-01",
      monthIndex: 0,
      state: {
        addIncome: () => undefined,
      },
    } as never;

    registry.execute(stateInput);

    expect(calls).toEqual([
      "y.rule",
      "z.rule",
      "a.rule",
      "b.rule",
      "x.rule",
    ]);
  });
});

describe("Rule applicability", () => {
  it("applies NPS annual rule only in configured month", () => {
    const context = baseContext({
      assumptions: {
        incomeMonthly: 0,
        incomeAnnualGrowthRate: 0,
        expensesMonthly: 0,
        inflationAnnualRate: 0,
        investmentGrowthAnnualRate: 0,
        contributionMonthly: 0,
        contributionAnnualStepUpRate: 0,
        loans: [],
      },
      contributionRules: [
        {
          id: "nps-annual",
          type: "nps-annual",
          amount: 24000,
          scheduleMonth: 3,
          enabled: true,
        },
      ],
    });

    const january = runMonthlyPipeline({
      context,
      monthKey: "2026-01",
      monthIndex: 0,
      state: "Baseline",
      opening: context.openingBalances,
      loans: [],
      ruleRegistry: createDefaultFinancialRuleRegistry(),
    });

    const march = runMonthlyPipeline({
      context,
      monthKey: "2026-03",
      monthIndex: 2,
      state: "Baseline",
      opening: context.openingBalances,
      loans: [],
      ruleRegistry: createDefaultFinancialRuleRegistry(),
    });

    expect(january.projection.activity.contribution).toBe(0);
    expect(march.projection.activity.contribution).toBe(24000);
  });
});

describe("Multi-rule interactions", () => {
  it("combines salary, expenses, one-time event, sip, emi, and property appreciation", () => {
    const context = baseContext({
      assumptions: {
        incomeMonthly: 100000,
        incomeAnnualGrowthRate: 0,
        expensesMonthly: 0,
        inflationAnnualRate: 0,
        investmentGrowthAnnualRate: 12,
        contributionMonthly: 0,
        contributionAnnualStepUpRate: 0,
        loans: [
          {
            id: "loan-1",
            outstandingPrincipal: 120000,
            annualInterestRate: 12,
            emi: 10000,
          },
        ],
      },
      expenseCategories: [
        { id: "housing", name: "Housing", monthlyAmount: 30000, enabled: true },
      ],
      contributionRules: [
        { id: "sip-1", type: "sip", amount: 10000, enabled: true },
      ],
      assets: [
        { id: "property-1", category: "Property", currentValue: 5000000 },
      ],
      events: [
        {
          id: "event-1",
          name: "Laptop Purchase",
          category: "One-Time Expense",
          effectiveMonth: "2026-01",
          startMonth: "2026-01",
          amount: 20000,
          frequency: "once",
          enabled: true,
        },
      ],
    });

    const result = runMonthlyPipeline({
      context,
      monthKey: "2026-01",
      monthIndex: 0,
      state: "Baseline",
      opening: context.openingBalances,
      loans: context.assumptions.loans,
      ruleRegistry: createDefaultFinancialRuleRegistry(),
    });

    expect(result.projection.activity.income).toBe(100000);
    expect(result.projection.activity.expenses).toBe(30000);
    expect(result.projection.activity.eventImpact).toBe(-20000);
    expect(result.projection.activity.contribution).toBe(10000);
    expect(result.projection.activity.loanPayment).toBeGreaterThan(0);
    expect(result.projection.activity.assetAppreciation).toBeGreaterThan(0);
    expect(result.projection.closing.netWorth).toBeGreaterThan(result.projection.opening.netWorth - 50000);
  });
});
