import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinancialEvent } from "@/types/projection";

const runtime = vi.hoisted(() => ({
  listEvents: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  listLoans: vi.fn(),
  getInvestments: vi.fn(),
}));

vi.mock("@/services/projection", () => ({
  DEFAULT_PROJECTION_SCENARIO_KEY: "default",
  projectionEventsService: {
    listEvents: runtime.listEvents,
    createEvent: runtime.createEvent,
    updateEvent: runtime.updateEvent,
    deleteEvent: runtime.deleteEvent,
  },
}));

vi.mock("@/services/loanManagement", () => ({
  loanManagementService: {
    listLoans: runtime.listLoans,
  },
}));

vi.mock("@/services/investments", () => ({
  getInvestments: runtime.getInvestments,
}));

import {
  CashFlowManagementService,
  buildCashFlowProjectionInput,
  buildCashFlowSummary,
  validateExpense,
  validateIncome,
} from "./cashFlowManagement";

function makeIncomeEvent(overrides: Partial<FinancialEvent> = {}): FinancialEvent {
  return {
    id: "income-1",
    module: "cash-flow",
    type: "cash-flow",
    name: "Primary Salary",
    amount: 100000,
    date: "2026-01-01",
    frequency: "monthly",
    repeatEveryMonths: 1,
    startsOn: "2026-01-01",
    endsOn: null,
    isEnabled: true,
    metadata: {
      entryKind: "income",
      incomeType: "Salary",
      annualIncrement: 8,
      notes: "Main salary",
    },
    ...overrides,
  };
}

function makeExpenseEvent(overrides: Partial<FinancialEvent> = {}): FinancialEvent {
  return {
    id: "expense-1",
    module: "cash-flow",
    type: "cash-flow",
    name: "Living Expenses",
    amount: 40000,
    date: "2026-01-01",
    frequency: "monthly",
    repeatEveryMonths: 1,
    startsOn: "2026-01-01",
    endsOn: null,
    isEnabled: true,
    metadata: {
      entryKind: "expense",
      expenseCategory: "Other",
      annualInflation: 6,
      notes: "Core monthly expenses",
    },
    ...overrides,
  };
}

describe("cash flow validation", () => {
  it("validates income fields", () => {
    const issues = validateIncome({
      name: "",
      type: "Salary",
      monthlyAmount: -1,
      annualIncrement: 120,
      startDate: null,
      status: "Active",
      notes: null,
    });

    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["name", "monthlyAmount", "annualIncrement"]),
    );
  });

  it("validates manual expense fields", () => {
    const issues = validateExpense({
      name: "",
      category: "Other",
      monthlyAmount: -1,
      annualInflation: 120,
      startDate: null,
      status: "Active",
      notes: null,
    });

    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["name", "monthlyAmount", "annualInflation"]),
    );
  });

  it("rejects automatic commitment categories in manual expenses", () => {
    const issues = validateExpense({
      name: "Home Loan EMI",
      category: "EMI" as never,
      monthlyAmount: 12000,
      annualInflation: 0,
      startDate: null,
      status: "Active",
      notes: null,
    });

    expect(issues.map((issue) => issue.field)).toContain("category");
  });
});

describe("cash flow summary", () => {
  it("calculates monthly income, commitments, living expenses, savings and savings rate", () => {
    const summary = buildCashFlowSummary(
      [
        {
          id: "income-1",
          name: "Salary",
          type: "Salary",
          monthlyAmount: 100000,
          annualIncrement: 8,
          startDate: "2026-01-01",
          status: "Active",
          notes: null,
        },
      ],
      [
        {
          id: "expense-1",
          name: "Living Expenses",
          category: "Other",
          monthlyAmount: 40000,
          annualInflation: 6,
          startDate: "2026-01-01",
          status: "Active",
          notes: null,
        },
      ],
      [
        {
          id: "loan:1:emi",
          source: "Loan Management",
          type: "EMI",
          name: "Home Loan EMI",
          monthlyAmount: 25000,
          href: "/loans",
        },
      ],
    );

    expect(summary.monthlyIncome).toBe(100000);
    expect(summary.monthlyManualExpenses).toBe(40000);
    expect(summary.monthlyAutomaticCommitments).toBe(25000);
    expect(summary.monthlyExpenses).toBe(65000);
    expect(summary.monthlySavings).toBe(35000);
    expect(summary.savingsRate).toBe(0.35);
  });
});

describe("cash flow projection input", () => {
  it("builds projection input using active entries only", () => {
    const projectionInput = buildCashFlowProjectionInput(
      [
        {
          id: "income-1",
          name: "Salary",
          type: "Salary",
          monthlyAmount: 100000,
          annualIncrement: 8,
          startDate: "2026-01-01",
          status: "Active",
          notes: null,
        },
        {
          id: "income-2",
          name: "Old Bonus",
          type: "Bonus",
          monthlyAmount: 10000,
          annualIncrement: 0,
          startDate: "2026-01-01",
          status: "Inactive",
          notes: null,
        },
      ],
      [
        {
          id: "expense-1",
          name: "Living Expenses",
          category: "Other",
          monthlyAmount: 40000,
          annualInflation: 6,
          startDate: "2026-01-01",
          status: "Active",
          notes: null,
        },
      ],
    );

    expect(projectionInput.income).toHaveLength(1);
    expect(projectionInput.expenses).toHaveLength(1);
    expect(projectionInput.income[0].monthlyAmount).toBe(100000);
    expect(projectionInput.expenses[0].annualInflation).toBe(6);
  });
});

describe("CashFlowManagementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists income and manual expenses from cash-flow events", async () => {
    runtime.listEvents.mockResolvedValue([makeIncomeEvent(), makeExpenseEvent()]);
    runtime.listLoans.mockResolvedValue([]);
    runtime.getInvestments.mockResolvedValue([]);

    const service = new CashFlowManagementService();
    const [income, expenses] = await Promise.all([service.listIncome(), service.listManualExpenses()]);

    expect(income).toHaveLength(1);
    expect(expenses).toHaveLength(1);
    expect(income[0].name).toBe("Primary Salary");
    expect(expenses[0].name).toBe("Living Expenses");
  });

  it("adds, edits and deletes income", async () => {
    runtime.createEvent.mockResolvedValue(makeIncomeEvent());
    runtime.listEvents.mockResolvedValue([makeIncomeEvent()]);
    runtime.updateEvent.mockResolvedValue(makeIncomeEvent({ amount: 120000 }));
    runtime.deleteEvent.mockResolvedValue(undefined);

    const service = new CashFlowManagementService();
    const created = await service.addIncome({
      name: "Primary Salary",
      type: "Salary",
      monthlyAmount: 100000,
      annualIncrement: 8,
      startDate: "2026-01-01",
      status: "Active",
      notes: "Main salary",
    });

    const updated = await service.editIncome(created.id, { monthlyAmount: 120000 });
    await service.deleteIncome(created.id);

    expect(runtime.createEvent).toHaveBeenCalledTimes(1);
    expect(updated.monthlyAmount).toBe(120000);
    expect(runtime.deleteEvent).toHaveBeenCalledWith(created.id);
  });

  it("upserts single living expense and removes duplicates", async () => {
    runtime.listEvents
      .mockResolvedValueOnce([
        makeExpenseEvent({ id: "expense-1", amount: 30000, metadata: { entryKind: "expense", expenseCategory: "Other", annualInflation: 0, notes: "A" } }),
        makeExpenseEvent({ id: "expense-2", amount: 10000, metadata: { entryKind: "expense", expenseCategory: "Other", annualInflation: 0, notes: "B" } }),
      ])
      .mockResolvedValueOnce([
        makeExpenseEvent({ id: "expense-1", amount: 45000, metadata: { entryKind: "expense", expenseCategory: "Other", annualInflation: 0, notes: "Updated" } }),
      ]);

    runtime.updateEvent.mockResolvedValue(
      makeExpenseEvent({ id: "expense-1", amount: 45000, metadata: { entryKind: "expense", expenseCategory: "Other", annualInflation: 0, notes: "Updated" } }),
    );
    runtime.deleteEvent.mockResolvedValue(undefined);

    const service = new CashFlowManagementService();
    await service.upsertLivingExpense({ monthlyAmount: 45000, notes: "Updated" });

    expect(runtime.updateEvent).toHaveBeenCalledTimes(1);
    expect(runtime.deleteEvent).toHaveBeenCalledWith("expense-2");
  });

  it("builds automatic commitments from loans and investments", async () => {
    runtime.listLoans.mockResolvedValue([
      {
        id: "loan-1",
        name: "Home Loan",
        status: "Active",
        outstandingAmount: 1500000,
        emi: 30000,
      },
    ]);
    runtime.getInvestments.mockResolvedValue([
      {
        id: "inv-1",
        investment_name: "Nifty Index Fund",
        category: "Mutual Funds",
        status: "active",
        sip_amount: 15000,
      },
      {
        id: "inv-2",
        investment_name: "NPS Account",
        category: "NPS",
        status: "active",
        sip_amount: 4000,
      },
    ]);

    const service = new CashFlowManagementService();
    const commitments = await service.listAutomaticCommitments();

    expect(commitments).toHaveLength(3);
    expect(commitments.some((entry) => entry.type === "EMI" && entry.href === "/loans")).toBe(true);
    expect(commitments.some((entry) => entry.type === "SIP" && entry.href === "/investments")).toBe(true);
    expect(commitments.some((entry) => entry.type === "NPS" && entry.href === "/investments")).toBe(true);
  });

  it("builds transparent snapshot and summary through service", async () => {
    runtime.listEvents.mockResolvedValue([makeIncomeEvent(), makeExpenseEvent()]);
    runtime.listLoans.mockResolvedValue([
      {
        id: "loan-1",
        name: "Home Loan",
        status: "Active",
        outstandingAmount: 1500000,
        emi: 30000,
      },
    ]);
    runtime.getInvestments.mockResolvedValue([
      {
        id: "inv-1",
        investment_name: "Nifty Index Fund",
        category: "Mutual Funds",
        status: "active",
        sip_amount: 15000,
      },
    ]);

    const service = new CashFlowManagementService();
    const snapshot = await service.getCashFlowSnapshot();

    expect(snapshot.incomeBreakdown.salary).toBe(100000);
    expect(snapshot.commitmentGroups.find((group) => group.source === "Loan Management")?.subtotal).toBe(30000);
    expect(snapshot.commitmentGroups.find((group) => group.source === "Investment Management")?.subtotal).toBe(15000);
    expect(snapshot.summary.monthlyIncome).toBe(100000);
    expect(snapshot.summary.monthlyManualExpenses).toBe(40000);
    expect(snapshot.summary.monthlyAutomaticCommitments).toBe(45000);
    expect(snapshot.summary.monthlySavings).toBe(15000);
  });
});
