import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Liability } from "@/types/liability";

const runtime = vi.hoisted(() => ({
  getLiabilities: vi.fn(),
  createLiability: vi.fn(),
  updateLiability: vi.fn(),
  deleteLiability: vi.fn(),
}));

vi.mock("@/services/liabilities", () => ({
  getLiabilities: runtime.getLiabilities,
  createLiability: runtime.createLiability,
  updateLiability: runtime.updateLiability,
  deleteLiability: runtime.deleteLiability,
}));

import {
  LoanManagementService,
  buildLoanSummary,
  buildLoanSummaryFromLiabilities,
  generateLoanProjectionIntegration,
  validateLoan,
} from "./loanManagement";

function makeLiability(overrides: Partial<Liability> = {}): Liability {
  return {
    id: "loan-1",
    user_id: "user-1",
    liability_type: "Home Loan",
    lender: "Acme Bank",
    account_name: "Primary Home Loan",
    outstanding_amount: 2500000,
    original_amount: 3000000,
    interest_rate: 8.5,
    emi: 24500,
    start_date: "2024-01-01",
    end_date: "2044-01-01",
    due_day: null,
    due_date: null,
    tenure_months: 240,
    credit_limit: null,
    sanction_limit: null,
    status: "active",
    notes: "Personal home loan\n__LOAN_META__:{\"remainingMonths\":180,\"prepaymentAmount\":25000,\"prepaymentFrequency\":\"Annual\"}",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("loan validation", () => {
  it("returns issues for required and invalid values", () => {
    const issues = validateLoan({
      name: "",
      lender: "",
      loanType: "Home Loan",
      outstandingAmount: -1,
      interestRate: 101,
      emi: -5,
      tenureMonths: 240,
      remainingMonths: -2,
      startDate: "2026-02-01",
      endDate: "2026-01-01",
      prepaymentAmount: 0,
      prepaymentFrequency: "None",
      status: "Active",
      notes: null,
    });

    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["name", "lender", "outstandingAmount", "interestRate", "emi", "remainingMonths", "endDate"]),
    );
  });
});

describe("loan summary builders", () => {
  it("aggregates summary from loans", () => {
    const summary = buildLoanSummary([
      {
        id: "loan-1",
        name: "Home Loan",
        lender: "Bank A",
        loanType: "Home Loan",
        outstandingAmount: 2000000,
        interestRate: 8.5,
        emi: 20000,
        tenureMonths: 240,
        remainingMonths: 180,
        startDate: "2024-01-01",
        endDate: "2044-01-01",
        prepaymentAmount: 20000,
        prepaymentFrequency: "Annual",
        status: "Active",
        notes: null,
      },
      {
        id: "loan-2",
        name: "Car Loan",
        lender: "Bank B",
        loanType: "Car Loan",
        outstandingAmount: 0,
        interestRate: 9,
        emi: 0,
        tenureMonths: 60,
        remainingMonths: 0,
        startDate: "2022-01-01",
        endDate: "2027-01-01",
        prepaymentAmount: 0,
        prepaymentFrequency: "None",
        status: "Closed",
        notes: null,
      },
    ]);

    expect(summary.totalOutstanding).toBe(2000000);
    expect(summary.totalEmi).toBe(20000);
    expect(summary.averageInterestRate).toBe(8.5);
    expect(summary.activeLoans).toBe(1);
    expect(summary.closedLoans).toBe(1);
    expect(summary.upcomingPrepayments).toBe(1);
  });

  it("builds summary from liabilities by filtering managed loan types", () => {
    const summary = buildLoanSummaryFromLiabilities([
      makeLiability(),
      makeLiability({
        id: "cc-1",
        liability_type: "Credit Card",
        account_name: "Travel Card",
        outstanding_amount: 30000,
      }),
    ]);

    expect(summary.totalOutstanding).toBe(2500000);
    expect(summary.activeLoans).toBe(1);
  });
});

describe("loan projection integration", () => {
  it("generates loan assumptions and prepayment events for active loans", () => {
    const integration = generateLoanProjectionIntegration([
      {
        id: "loan-1",
        name: "Home Loan",
        lender: "Bank A",
        loanType: "Home Loan",
        outstandingAmount: 2000000,
        interestRate: 8.5,
        emi: 20000,
        tenureMonths: 240,
        remainingMonths: 180,
        startDate: "2024-01-01",
        endDate: "2044-01-01",
        prepaymentAmount: 20000,
        prepaymentFrequency: "Annual",
        status: "Active",
        notes: null,
      },
      {
        id: "loan-2",
        name: "Closed Loan",
        lender: "Bank B",
        loanType: "Personal Loan",
        outstandingAmount: 0,
        interestRate: 10,
        emi: 0,
        tenureMonths: 24,
        remainingMonths: 0,
        startDate: "2022-01-01",
        endDate: "2024-01-01",
        prepaymentAmount: 1000,
        prepaymentFrequency: "Monthly",
        status: "Closed",
        notes: null,
      },
    ]);

    expect(integration.loanAssumptions).toHaveLength(1);
    expect(integration.loanAssumptions[0].annualInterestRate).toBe(8.5);
    expect(integration.prepaymentEvents).toHaveLength(1);
    expect(integration.prepaymentEvents[0].frequency).toBe("annual");
  });
});

describe("LoanManagementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only managed loan liabilities", async () => {
    runtime.getLiabilities.mockResolvedValue([
      makeLiability(),
      makeLiability({ id: "credit-1", liability_type: "Credit Card", account_name: "Card Balance" }),
    ]);

    const service = new LoanManagementService();
    const loans = await service.listLoans();

    expect(loans).toHaveLength(1);
    expect(loans[0].name).toBe("Primary Home Loan");
  });

  it("adds and maps a loan to liability payload", async () => {
    runtime.createLiability.mockResolvedValue(makeLiability());

    const service = new LoanManagementService();
    const result = await service.addLoan({
      name: "Primary Home Loan",
      lender: "Acme Bank",
      loanType: "Home Loan",
      outstandingAmount: 2500000,
      interestRate: 8.5,
      emi: 24500,
      tenureMonths: 240,
      remainingMonths: 180,
      startDate: "2024-01-01",
      endDate: "2044-01-01",
      prepaymentAmount: 25000,
      prepaymentFrequency: "Annual",
      status: "Active",
      notes: "Personal home loan",
    });

    expect(runtime.createLiability).toHaveBeenCalledTimes(1);
    expect(result.id).toBe("loan-1");
  });

  it("edits an existing loan", async () => {
    runtime.getLiabilities.mockResolvedValue([makeLiability()]);
    runtime.updateLiability.mockResolvedValue(makeLiability({ outstanding_amount: 2000000 }));

    const service = new LoanManagementService();
    const updated = await service.editLoan("loan-1", { outstandingAmount: 2000000 });

    expect(runtime.updateLiability).toHaveBeenCalledTimes(1);
    expect(updated.outstandingAmount).toBe(2000000);
  });

  it("archives a loan by closing it", async () => {
    runtime.updateLiability.mockResolvedValue(makeLiability({ status: "closed" }));

    const service = new LoanManagementService();
    const archived = await service.archiveClosedLoan("loan-1");

    expect(runtime.updateLiability).toHaveBeenCalledWith({ id: "loan-1", status: "closed" });
    expect(archived.status).toBe("Closed");
  });

  it("deletes loan by id", async () => {
    runtime.deleteLiability.mockResolvedValue(undefined);

    const service = new LoanManagementService();
    await service.deleteLoan("loan-1");

    expect(runtime.deleteLiability).toHaveBeenCalledWith("loan-1");
  });
});
