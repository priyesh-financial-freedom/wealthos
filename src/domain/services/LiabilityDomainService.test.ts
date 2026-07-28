import { describe, expect, it } from "vitest";

import { LiabilityDomainService, type LiabilityDomainRow } from "./LiabilityDomainService";

function makeRow(overrides: Partial<LiabilityDomainRow> = {}): LiabilityDomainRow {
  return {
    id: "liability-1",
    user_id: "user-1",
    liability_type: "Home Loan",
    status: "active",
    outstanding_amount: 100,
    original_amount: 120,
    interest_rate: 10,
    emi: 1,
    ...overrides,
  };
}

describe("LiabilityDomainService", () => {
  it("applies FinancialPositionPolicy v1.0 and aggregates a snapshot", async () => {
    const service = new LiabilityDomainService({
      listLiabilities: async () => [
        makeRow({ id: "home-1", liability_type: "Home Loan", outstanding_amount: 200, interest_rate: 10, emi: 20 }),
        makeRow({ id: "vehicle-1", liability_type: "Car Loan", outstanding_amount: 100, interest_rate: 12, emi: 10 }),
        makeRow({ id: "deleted-1", liability_type: "Car Loan", outstanding_amount: 75, status: "deleted" }),
        makeRow({ id: "archived-1", liability_type: "Personal Loan", outstanding_amount: 80, status: "Archived" }),
        makeRow({ id: "zero-1", liability_type: "Credit Card", outstanding_amount: 0, emi: 3 }),
      ],
    });

    const snapshot = await service.getFinancialPositionSnapshot();

    expect(snapshot.policyVersion).toBe("1.0");
    expect(snapshot.totalOutstanding).toBe(300);
    expect(snapshot.totalMonthlyEmi).toBe(30);
    expect(snapshot.liabilityCount).toBe(2);
    expect(snapshot.activeLiabilityCount).toBe(2);
    expect(snapshot.breakdownByLiabilityType).toHaveLength(2);
    expect(snapshot.breakdownByPortfolioBucket.find((item) => item.key === "vehicle_loans")?.outstandingAmount).toBe(100);
    expect(snapshot.largestLiability?.id).toBe("home-1");
  });

  it("returns diagnostics and validates snapshot invariants", async () => {
    const service = new LiabilityDomainService({
      listLiabilities: async () => [
        makeRow({ id: "home-1", liability_type: "Home Loan", outstanding_amount: 200, interest_rate: 10, emi: 20 }),
        makeRow({ id: "vehicle-1", liability_type: "Car Loan", outstanding_amount: 100, interest_rate: 12, emi: 10 }),
      ],
    });

    const diagnostics = await service.getDiagnostics();
    const snapshot = await service.getFinancialPositionSnapshot();
    const validation = service.validateSnapshot(snapshot);

    expect(diagnostics.databaseRowCount).toBe(2);
    expect(diagnostics.includedRowCount).toBe(2);
    expect(diagnostics.excludedRowCount).toBe(0);
    expect(validation.valid).toBe(true);
    expect(validation.checks).toHaveLength(4);
  });

  it("returns the heaviest liabilities in descending order", async () => {
    const service = new LiabilityDomainService({
      listLiabilities: async () => [
        makeRow({ id: "small", liability_type: "Car Loan", outstanding_amount: 25, emi: 2 }),
        makeRow({ id: "large", liability_type: "Home Loan", outstanding_amount: 400, emi: 40 }),
        makeRow({ id: "medium", liability_type: "Personal Loan", outstanding_amount: 100, emi: 8 }),
      ],
    });

    const largest = await service.getLargestLiabilities(2);

    expect(largest.map((item) => item.id)).toEqual(["large", "medium"]);
    expect(largest[0].shareOfTotalOutstanding).toBeGreaterThan(largest[1].shareOfTotalOutstanding);
  });
});
