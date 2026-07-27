import { describe, expect, it } from "vitest";

import {
  InvestmentManagementService,
  buildInvestmentSummary,
  generateProjectionRules,
  validateInvestment,
} from "./investmentManagement";

describe("InvestmentManagementService CRUD", () => {
  it("adds and lists investments", () => {
    const service = new InvestmentManagementService();

    const created = service.addInvestment({
      name: "Index Fund",
      type: "Mutual Fund",
      currentValue: 100000,
      monthlyContribution: 5000,
      annualContribution: 20000,
      expectedReturn: 12,
      startDate: "2026-01-01",
      status: "active",
    });

    const list = service.listInvestments();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
    expect(list[0].name).toBe("Index Fund");
  });

  it("edits an investment", () => {
    const service = new InvestmentManagementService();
    const created = service.addInvestment({
      name: "Index Fund",
      type: "Mutual Fund",
      currentValue: 100000,
      monthlyContribution: 5000,
      annualContribution: 0,
      expectedReturn: 10,
      startDate: "2026-01-01",
      status: "active",
    });

    const updated = service.editInvestment(created.id, {
      currentValue: 125000,
      expectedReturn: 11,
    });

    expect(updated.currentValue).toBe(125000);
    expect(updated.expectedReturn).toBe(11);
  });

  it("deletes an investment", () => {
    const service = new InvestmentManagementService();
    const created = service.addInvestment({
      name: "Debt Fund",
      type: "Debt",
      currentValue: 50000,
      monthlyContribution: 1000,
      annualContribution: 0,
      expectedReturn: 7,
      startDate: "2026-01-01",
      status: "active",
    });

    service.deleteInvestment(created.id);
    expect(service.listInvestments()).toHaveLength(0);
  });
});

describe("Investment validation", () => {
  it("validates required and numeric bounds", () => {
    const issues = validateInvestment({
      name: "",
      type: "Mutual Fund",
      currentValue: -1,
      monthlyContribution: -10,
      annualContribution: -100,
      expectedReturn: 101,
      startDate: "2026-01-01",
      status: "active",
    });

    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        "name",
        "currentValue",
        "expectedReturn",
        "monthlyContribution",
        "annualContribution",
      ]),
    );
  });
});

describe("Investment projection integration", () => {
  it("generates contribution and growth rules for active investments", () => {
    const integration = generateProjectionRules([
      {
        id: "inv-1",
        name: "Index Fund",
        type: "Mutual Fund",
        currentValue: 100000,
        monthlyContribution: 5000,
        annualContribution: 24000,
        expectedReturn: 12,
        startDate: "2026-01-01",
        status: "active",
      },
      {
        id: "inv-2",
        name: "Old Investment",
        type: "Stocks",
        currentValue: 10000,
        monthlyContribution: 500,
        annualContribution: 0,
        expectedReturn: 15,
        startDate: "2020-01-01",
        status: "closed",
      },
    ]);

    expect(integration.contributionRules).toHaveLength(2);
    expect(integration.contributionRules.map((rule) => rule.type)).toEqual(["sip", "sip"]);
    expect(integration.growthRules).toHaveLength(1);
    expect(integration.growthRules[0].annualRate).toBe(12);
    expect(integration.investmentGrowthAnnualRate).toBe(12);
  });
});

describe("Investment summary", () => {
  it("builds summary totals", () => {
    const summary = buildInvestmentSummary([
      {
        id: "inv-1",
        name: "Index Fund",
        type: "Mutual Fund",
        currentValue: 100000,
        monthlyContribution: 5000,
        annualContribution: 12000,
        expectedReturn: 10,
        startDate: "2026-01-01",
        status: "active",
      },
    ]);

    expect(summary.currentValue).toBe(100000);
    expect(summary.totalContributions).toBe(72000);
    expect(summary.projectedValue).toBe(189200);
  });
});