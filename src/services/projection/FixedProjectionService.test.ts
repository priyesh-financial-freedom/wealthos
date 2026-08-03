import { describe, expect, it } from "vitest";

import { SalaryProjectionService } from "./SalaryProjectionService";
import { FixedProjectionService, type CreateFixedProjectionV1Input, type FixedProjectionBucketKey } from "./FixedProjectionService";
import type {
  ProjectionAssumptionSnapshotRecord,
  ProjectionMonthlyPositionRecord,
  ProjectionPlanVersionRecord,
  ProjectionSalaryCurveRecord,
  UpsertProjectionMonthlyPositionInput,
  UpsertProjectionSalaryCurveInput,
} from "./versioning/types";

class InMemoryProjectionVersioningService {
  private idCounter = 1;

  plans = new Map<string, ProjectionPlanVersionRecord>();

  snapshots = new Map<string, ProjectionAssumptionSnapshotRecord>();

  salaryCurveRows: ProjectionSalaryCurveRecord[] = [];

  monthlyPositions: ProjectionMonthlyPositionRecord[] = [];

  async createPlanVersion(input: {
    household_id?: string | null;
    plan_kind: "FIXED" | "ROLLING" | "WHAT_IF";
    version_no: number;
    status?: "DRAFT" | "LOCKED" | "ARCHIVED";
    start_month: string;
    horizon_end_month: string;
  }): Promise<ProjectionPlanVersionRecord> {
    const id = `plan-${this.idCounter++}`;
    const now = new Date().toISOString();
    const record: ProjectionPlanVersionRecord = {
      id,
      user_id: "user-1",
      household_id: input.household_id ?? null,
      plan_kind: input.plan_kind,
      version_no: input.version_no,
      status: input.status ?? "DRAFT",
      start_month: input.start_month,
      horizon_end_month: input.horizon_end_month,
      base_close_id: null,
      parent_fixed_version_id: null,
      locked_at: null,
      created_at: now,
      updated_at: now,
    };

    this.plans.set(id, record);
    return record;
  }

  async upsertAssumptionSnapshot(input: {
    projection_plan_version_id: string;
    assumption_payload: Record<string, unknown>;
    salary_policy_payload: Record<string, unknown>;
    retirement_policy_payload: Record<string, unknown>;
    drawdown_policy_payload: Record<string, unknown>;
  }): Promise<ProjectionAssumptionSnapshotRecord> {
    this.assertMutable(input.projection_plan_version_id);

    const snapshot: ProjectionAssumptionSnapshotRecord = {
      id: `snapshot-${this.idCounter++}`,
      projection_plan_version_id: input.projection_plan_version_id,
      assumption_payload: input.assumption_payload,
      salary_policy_payload: input.salary_policy_payload,
      retirement_policy_payload: input.retirement_policy_payload,
      drawdown_policy_payload: input.drawdown_policy_payload,
      checksum: null,
      created_at: new Date().toISOString(),
    };

    this.snapshots.set(input.projection_plan_version_id, snapshot);
    return snapshot;
  }

  async upsertSalaryCurve(rows: UpsertProjectionSalaryCurveInput[]): Promise<ProjectionSalaryCurveRecord[]> {
    if (rows.length === 0) {
      return [];
    }

    this.assertMutable(rows[0].projection_plan_version_id);

    const created = rows.map((row) => ({
      id: `curve-${this.idCounter++}`,
      projection_plan_version_id: row.projection_plan_version_id,
      month_key: row.month_key,
      gross_salary: row.gross_salary,
      basic_salary: row.basic_salary,
      salary_growth_rate_used: row.salary_growth_rate_used,
      source: row.source,
      created_at: new Date().toISOString(),
    }));

    this.salaryCurveRows.push(...created);
    return created;
  }

  async upsertMonthlyPositions(rows: UpsertProjectionMonthlyPositionInput[]): Promise<ProjectionMonthlyPositionRecord[]> {
    if (rows.length === 0) {
      return [];
    }

    this.assertMutable(rows[0].projection_plan_version_id);

    const created = rows.map((row) => ({
      id: `position-${this.idCounter++}`,
      projection_plan_version_id: row.projection_plan_version_id,
      month_key: row.month_key,
      bucket_key: row.bucket_key,
      opening_value: row.opening_value,
      contribution: row.contribution,
      growth: row.growth,
      withdrawal: row.withdrawal,
      closing_value: row.closing_value,
      metadata: row.metadata ?? {},
      created_at: new Date().toISOString(),
    }));

    this.monthlyPositions.push(...created);
    return created;
  }

  async lockPlanVersion(id: string): Promise<ProjectionPlanVersionRecord> {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error("Projection plan version not found.");
    }

    const locked = {
      ...plan,
      status: "LOCKED" as const,
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.plans.set(id, locked);
    return locked;
  }

  private assertMutable(planId: string): void {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error("Projection plan version not found.");
    }

    if (plan.plan_kind === "FIXED" && plan.status === "LOCKED") {
      throw new Error("LOCKED FIXED projection plans are immutable.");
    }
  }
}

function buildInput(overrides?: Partial<CreateFixedProjectionV1Input>): CreateFixedProjectionV1Input {
  return {
    versionNo: 1,
    startMonth: "2026-07",
    horizonEndMonth: "2026-09",
    openingBalances: {
      cash: 100000,
      mutualFunds: 500000,
      stocks: 200000,
      epf: 300000,
      ppf: 100000,
      nps: 150000,
      property: 5000000,
      gold: 300000,
      otherNonFinancialAssets: 100000,
      liabilities: 1000000,
    },
    assumptions: {
      salary: {
        currentGrossSalary: 100000,
        currentBasicSalary: 40000,
        annualIncrementPercent: 10,
        incrementMonth: 7,
        retirementMonth: "2035-01",
      },
      contributions: {
        mutualFundsMonthlySip: 20000,
        epfEmployeeContributionRate: 12,
        epfEmployerContributionRate: 12,
        npsContributionRate: 10,
        ppfMonthlyContributionPriyesh: 10000,
        ppfAnnualContributionShobhana: 120000,
        ppfAnnualContributionMonth: 4,
        ppfContributionEndMonth: "2038-03",
      },
      returns: {
        cashAnnualReturnPercent: 4,
        mutualFundsAnnualReturnPercent: 12,
        stocksAnnualReturnPercent: 14,
        epfAnnualReturnPercent: 8,
        ppfAnnualReturnPercent: 7.1,
        npsAnnualReturnPercent: 10,
        nonFinancialAnnualReturnPercent: 6,
      },
      expenses: {
        preRetirementMonthlyExpense: 40000,
        annualExpenseInflationPercent: 0,
        postRetirementExpenseReductionPercent: 20,
        monthlyEmi: 15000,
        monthlyInsurancePremium: 5000,
      },
      npsSplitPolicy: {
        lumpsumPercent: 50,
        annuityPercent: 50,
      },
      liabilitiesMonthlyRepayment: 10000,
      eventDrawdownOrder: ["cash", "mutual_funds", "ppf", "epf"],
    },
    ...overrides,
  };
}

function findPosition(
  rows: ProjectionMonthlyPositionRecord[],
  monthKey: string,
  bucket: FixedProjectionBucketKey,
): ProjectionMonthlyPositionRecord {
  const row = rows.find((entry) => entry.month_key === monthKey && entry.bucket_key === bucket);
  if (!row) {
    throw new Error(`Missing row for ${monthKey} ${bucket}`);
  }

  return row;
}

describe("FixedProjectionService", () => {
  it("creates a FIXED plan, stores snapshot, writes salary curve and monthly positions, and locks the plan", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput());

    expect(result.planVersion.plan_kind).toBe("FIXED");
    expect(result.planVersion.status).toBe("LOCKED");
    expect(result.assumptionSnapshot.projection_plan_version_id).toBe(result.planVersion.id);
    expect(result.salaryCurve.length).toBe(3);
    expect(result.monthlyPositions.length).toBe(30);
  });

  it("generates salary curve from start month to horizon and reuses it for EPF and NPS", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({ horizonEndMonth: "2027-07" }));

    expect(result.salaryCurve[0]?.month_key).toBe("2026-07");
    expect(result.salaryCurve[result.salaryCurve.length - 1]?.month_key).toBe("2027-07");

    const julyEpf = findPosition(result.monthlyPositions, "2026-07", "epf");
    const julyNps = findPosition(result.monthlyPositions, "2026-07", "nps");
    expect(julyEpf.metadata.basicSalaryFromCommonCurve).toBe(40000);
    expect(julyNps.metadata.basicSalaryFromCommonCurve).toBe(40000);
    expect(julyEpf.contribution).toBe(9600);
    expect(julyEpf.growth).toBe(2000);
    expect(julyNps.contribution).toBe(4000);

    const julyPpf = findPosition(result.monthlyPositions, "2026-07", "ppf");
    expect(julyPpf.growth).toBe(591.67);
  });

  it("creates all required bucket rows for each projected month", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput());

    const requiredBuckets: FixedProjectionBucketKey[] = [
      "cash",
      "mutual_funds",
      "stocks",
      "epf",
      "ppf",
      "nps",
      "financial_assets_total",
      "non_financial_assets_total",
      "liabilities",
      "net_worth",
    ];

    for (const month of ["2026-07", "2026-08", "2026-09"]) {
      for (const bucket of requiredBuckets) {
        expect(() => findPosition(result.monthlyPositions, month, bucket)).not.toThrow();
      }
    }
  });

  it("keeps property and gold inside non-financial assets and excludes that bucket from drawdown", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput());

    const firstNonFinancial = findPosition(result.monthlyPositions, "2026-07", "non_financial_assets_total");
    expect(firstNonFinancial.opening_value).toBe(5400000);
    expect(firstNonFinancial.metadata.drawdownEligible).toBe(false);
    expect(firstNonFinancial.metadata.propertyLiquidationAllowed).toBe(false);

    expect(result.assumptionSnapshot.drawdown_policy_payload.financialEventDrawdownOrder).toEqual(["cash", "mutual_funds", "ppf", "epf"]);
  });

  it("keeps EPF-to-cash policy payload unchanged at three years after enabling EPF growth", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput());

    expect(result.assumptionSnapshot.retirement_policy_payload.epfTransferToCashAfterRetirementYears).toBe(3);
  });

  it("applies 20 percent default expense reduction after retirement", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          retirementMonth: "2026-08",
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          postRetirementExpenseReductionPercent: undefined,
        },
      },
    }));

    const julyCash = findPosition(result.monthlyPositions, "2026-07", "cash");
    const augustCash = findPosition(result.monthlyPositions, "2026-08", "cash");

    expect(julyCash.metadata.expenseApplied).toBe(40000);
    expect(augustCash.metadata.expenseApplied).toBe(32000);
    expect(result.assumptionSnapshot.retirement_policy_payload.postRetirementExpenseReductionPercent).toBe(20);
  });

  it("applies custom post-retirement expense reduction and snapshots it in retirement policy", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          retirementMonth: "2026-08",
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          postRetirementExpenseReductionPercent: 25,
        },
      },
    }));

    const augustCash = findPosition(result.monthlyPositions, "2026-08", "cash");
    expect(augustCash.metadata.expenseApplied).toBe(30000);
    expect(result.assumptionSnapshot.retirement_policy_payload.postRetirementExpenseReductionPercent).toBe(25);
  });

  it("applies month-by-month inflation on expenses and then applies post-retirement reduction", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          retirementMonth: "2026-08",
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          annualExpenseInflationPercent: 12,
          postRetirementExpenseReductionPercent: 20,
        },
      },
    }));

    const julyCash = findPosition(result.monthlyPositions, "2026-07", "cash");
    const augustCash = findPosition(result.monthlyPositions, "2026-08", "cash");
    const septemberCash = findPosition(result.monthlyPositions, "2026-09", "cash");

    expect(julyCash.metadata.expenseApplied).toBe(40000);
    expect(augustCash.metadata.expenseApplied).toBe(32320);
    expect(septemberCash.metadata.expenseApplied).toBe(32643.2);
  });

  it("uses planning baseline inflation default when annual expense inflation is omitted", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      assumptions: {
        ...buildInput().assumptions,
        expenses: {
          ...buildInput().assumptions.expenses,
          annualExpenseInflationPercent: undefined,
        },
      },
    }));

    const payload = result.assumptionSnapshot.assumption_payload as {
      expenses?: {
        annualExpenseInflationPercent?: number;
      };
    };

    expect(payload.expenses?.annualExpenseInflationPercent).toBe(6);
  });

  it("treats 0 percent reduction as no post-retirement expense reduction", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          retirementMonth: "2026-08",
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          postRetirementExpenseReductionPercent: 0,
        },
      },
    }));

    const augustCash = findPosition(result.monthlyPositions, "2026-08", "cash");
    expect(augustCash.metadata.expenseApplied).toBe(40000);
  });

  it("treats 100 percent reduction as zero post-retirement expense", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          retirementMonth: "2026-08",
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          postRetirementExpenseReductionPercent: 100,
        },
      },
    }));

    const augustCash = findPosition(result.monthlyPositions, "2026-08", "cash");
    expect(augustCash.metadata.expenseApplied).toBe(0);
  });

  it("rejects invalid post-retirement expense reduction below 0 or above 100", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    await expect(service.createFixedProjectionV1(buildInput({
      assumptions: {
        ...buildInput().assumptions,
        expenses: {
          ...buildInput().assumptions.expenses,
          postRetirementExpenseReductionPercent: -1,
        },
      },
    }))).rejects.toThrow("postRetirementExpenseReductionPercent must be between 0 and 100.");

    await expect(service.createFixedProjectionV1(buildInput({
      assumptions: {
        ...buildInput().assumptions,
        expenses: {
          ...buildInput().assumptions.expenses,
          postRetirementExpenseReductionPercent: 101,
        },
      },
    }))).rejects.toThrow("postRetirementExpenseReductionPercent must be between 0 and 100.");
  });

  it("validates NPS split to exactly 100 percent", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    await expect(service.createFixedProjectionV1(buildInput({
      assumptions: {
        ...buildInput().assumptions,
        npsSplitPolicy: {
          lumpsumPercent: 60,
          annuityPercent: 50,
        },
      },
    }))).rejects.toThrow("NPS split policy is invalid");
  });

  it("prevents mutation of locked fixed plans through service-layer immutability", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput());

    await expect(versioning.upsertMonthlyPositions([
      {
        projection_plan_version_id: result.planVersion.id,
        month_key: "2026-07",
        bucket_key: "cash",
        opening_value: 0,
        contribution: 0,
        growth: 0,
        withdrawal: 0,
        closing_value: 0,
      },
    ])).rejects.toThrow("LOCKED FIXED projection plans are immutable.");
  });
});
