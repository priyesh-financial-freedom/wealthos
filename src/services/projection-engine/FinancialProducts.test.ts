import { describe, expect, it } from "vitest";

import { createProjectionContext } from "./context";
import { ProjectionEngine } from "./engine";
import {
  HomeLoanProduct,
  MutualFundProduct,
  NPSProduct,
  PPFProduct,
  ProductRegistry,
  PropertyProduct,
  SalaryProduct,
  createDefaultProductRegistry,
} from "./products";
import { createDefaultFinancialRuleRegistry } from "./rules/defaultRegistry";
import { eventRules } from "./rules/eventRules";
import { expenseRules } from "./rules/expenseRules";
import { epfRule } from "./rules/investmentRules";
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
    openingBalances: {
      cash: 10000,
      investments: 0,
      assets: 10000,
      liabilities: 0,
      loanOutstanding: 120000,
      netWorth: -110000,
    },
    assets: [
      { id: "property-1", category: "Property", currentValue: 5000000 },
    ],
    liabilities: [],
    incomeSources: [],
    expenseCategories: [
      { id: "housing", name: "Housing", monthlyAmount: 30000, enabled: true },
    ],
    contributionRules: [
      { id: "sip-1", type: "sip", amount: 10000, enabled: true },
      { id: "nps-annual", type: "nps-annual", amount: 24000, scheduleMonth: 3, enabled: true },
    ],
    growthRules: [],
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
    actualMonthlyData: [],
    ...overrides,
  });
}

describe("Financial products validation", () => {
  it("rejects invalid product data", () => {
    expect(new SalaryProduct({ baseMonthlyIncome: -1 }).validate().valid).toBe(false);
    expect(new PPFProduct({ rules: [{ id: "ppf", amount: -100 }] }).validate().valid).toBe(false);
    expect(new NPSProduct({ annualRules: [{ id: "nps-a", amount: 1000, scheduleMonth: 13 }] }).validate().valid).toBe(false);
    expect(new HomeLoanProduct({ prepayments: [{ monthKey: "2026-99", amount: 1000 }] }).validate().valid).toBe(false);
    expect(new PropertyProduct({ assets: [{ id: "p-1", currentValue: -1 }] }).validate().valid).toBe(false);
  });
});

describe("Financial products rule generation", () => {
  it("emits rules for all product families", () => {
    expect(new SalaryProduct().getRules().map((rule) => rule.id)).toEqual([
      "income.salary",
      "income.annual-increment",
      "income.bonus",
    ]);
    expect(new PPFProduct().getRules().map((rule) => rule.id)).toEqual(["investment.ppf"]);
    expect(new NPSProduct().getRules().map((rule) => rule.id)).toEqual([
      "investment.nps-monthly",
      "investment.nps-annual",
    ]);
    expect(new MutualFundProduct().getRules().map((rule) => rule.id)).toEqual([
      "investment.sip",
      "investment.growth",
    ]);
    expect(new HomeLoanProduct().getRules().map((rule) => rule.id)).toEqual([
      "loan.emi",
      "loan.prepayment",
    ]);
    expect(new PropertyProduct().getRules().map((rule) => rule.id)).toEqual([
      "asset.property-appreciation",
    ]);
  });
});

describe("ProductRegistry", () => {
  it("aggregates rules from registered products", () => {
    const registry = new ProductRegistry();
    registry.registerMany([
      new SalaryProduct({ baseMonthlyIncome: 100000 }),
      new PPFProduct({ useContextRules: false, rules: [{ id: "ppf-static", amount: 1000 }] }),
    ]);

    const ruleIds = registry.getRules().map((rule) => rule.id);
    expect(ruleIds).toContain("income.salary");
    expect(ruleIds).toContain("income.annual-increment");
    expect(ruleIds).toContain("income.bonus");
    expect(ruleIds).toContain("investment.ppf");
  });
});

describe("Projection compatibility", () => {
  it("keeps projection engine rule-only by accepting product-generated rules", () => {
    const context = baseContext();

    const defaultEngine = new ProjectionEngine(createDefaultFinancialRuleRegistry());

    const productRegistry = createDefaultProductRegistry();
    const assembledRuleRegistry = new FinancialRuleRegistry();
    assembledRuleRegistry.registerMany(productRegistry.getRules());
    assembledRuleRegistry.registerMany(expenseRules);
    assembledRuleRegistry.registerMany(eventRules);
    assembledRuleRegistry.register(epfRule);

    const productRulesEngine = new ProjectionEngine(assembledRuleRegistry);

    const defaultProjection = defaultEngine.generateProjection(context);
    const productProjection = productRulesEngine.generateProjection(context);

    expect(productProjection).toEqual(defaultProjection);
  });
});
