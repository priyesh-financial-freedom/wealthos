import { describe, expect, it } from "vitest";

import { SalaryProjectionService } from "./SalaryProjectionService";
import { FixedProjectionService, type CreateFixedProjectionV1Input, type FixedProjectionBucketKey } from "./FixedProjectionService";
import { ProjectionVersioningService, monthKeyToDate } from "./versioning/ProjectionVersioningService";
import type {
  CreateProjectionAssumptionSnapshotInput,
  CreateProjectionPlanVersionInput,
  CreateProjectionRebaseJournalInput,
  ProjectionAssumptionSnapshotRecord,
  ProjectionMonthlyPositionRecord,
  ProjectionPlanVersionRecord,
  ProjectionRebaseJournalRecord,
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

class CapturingProjectionVersioningRepository {
  private idCounter = 1;

  planInput: CreateProjectionPlanVersionInput | null = null;

  salaryRowsInput: UpsertProjectionSalaryCurveInput[] = [];

  monthlyRowsInput: UpsertProjectionMonthlyPositionInput[] = [];

  private plans = new Map<string, ProjectionPlanVersionRecord>();

  async createPlanVersion(input: CreateProjectionPlanVersionInput): Promise<ProjectionPlanVersionRecord> {
    this.planInput = input;
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
      base_close_id: input.base_close_id ?? null,
      parent_fixed_version_id: input.parent_fixed_version_id ?? null,
      locked_at: input.locked_at ?? null,
      created_at: now,
      updated_at: now,
    };

    this.plans.set(id, record);
    return record;
  }

  async getPlanVersionById(id: string): Promise<ProjectionPlanVersionRecord | null> {
    return this.plans.get(id) ?? null;
  }

  async updatePlanStatus(
    id: string,
    status: ProjectionPlanVersionRecord["status"],
    lockedAt?: string | null,
  ): Promise<ProjectionPlanVersionRecord> {
    const existing = this.plans.get(id);
    if (!existing) {
      throw new Error("Projection plan version not found.");
    }

    const updated = {
      ...existing,
      status,
      locked_at: lockedAt ?? null,
      updated_at: new Date().toISOString(),
    };
    this.plans.set(id, updated);
    return updated;
  }

  async upsertAssumptionSnapshot(input: CreateProjectionAssumptionSnapshotInput): Promise<ProjectionAssumptionSnapshotRecord> {
    return {
      id: `snapshot-${this.idCounter++}`,
      projection_plan_version_id: input.projection_plan_version_id,
      assumption_payload: input.assumption_payload,
      salary_policy_payload: input.salary_policy_payload,
      retirement_policy_payload: input.retirement_policy_payload,
      drawdown_policy_payload: input.drawdown_policy_payload,
      checksum: input.checksum ?? null,
      created_at: new Date().toISOString(),
    };
  }

  async upsertSalaryCurve(rows: UpsertProjectionSalaryCurveInput[]): Promise<ProjectionSalaryCurveRecord[]> {
    this.salaryRowsInput = rows;

    return rows.map((row) => ({
      id: `curve-${this.idCounter++}`,
      projection_plan_version_id: row.projection_plan_version_id,
      month_key: row.month_key,
      gross_salary: row.gross_salary,
      basic_salary: row.basic_salary,
      salary_growth_rate_used: row.salary_growth_rate_used,
      source: row.source,
      created_at: new Date().toISOString(),
    }));
  }

  async upsertMonthlyPositions(rows: UpsertProjectionMonthlyPositionInput[]): Promise<ProjectionMonthlyPositionRecord[]> {
    this.monthlyRowsInput = rows;

    return rows.map((row) => ({
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
  }

  async appendRebaseJournal(input: CreateProjectionRebaseJournalInput): Promise<ProjectionRebaseJournalRecord> {
    return {
      id: `rebase-${this.idCounter++}`,
      rolling_version_id: input.rolling_version_id,
      parent_fixed_version_id: input.parent_fixed_version_id,
      rebased_from_close_id: input.rebased_from_close_id,
      rebased_month: input.rebased_month,
      prior_rolling_version_id: input.prior_rolling_version_id ?? null,
      created_at: new Date().toISOString(),
    };
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
        currentNetSalary: 90000,
        currentBasicSalary: 40000,
        annualIncrementPercent: 10,
        incrementMonth: 7,
        retirementMonth: "2035-01",
      },
      contributions: {
        mutualFundsMonthlySip: 20000,
        stocksMonthlySip: 7000,
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
        monthlyOtherRecurringCommitments: 0,
      },
      npsSplitPolicy: {
        lumpsumPercent: 50,
        annuityPercent: 50,
      },
      netSalaryIncludesEmployeeDeductions: true,
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
  it("builds preview in memory without writing projection plan, positions, salary curve, or assumptions", () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const preview = service.createFixedProjectionPreview(buildInput());

    expect(preview.monthRows.length).toBeGreaterThan(0);
    expect(preview.monthSnapshots.length).toBeGreaterThan(0);
    expect(versioning.plans.size).toBe(0);
    expect(versioning.salaryCurveRows.length).toBe(0);
    expect(versioning.monthlyPositions.length).toBe(0);
    expect(versioning.snapshots.size).toBe(0);
  });

  it("freezes using the exact preview artifacts without recomputing a different payload", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const preview = service.createFixedProjectionPreview(buildInput());
    preview.monthlyPositionRows[0] = {
      ...preview.monthlyPositionRows[0],
      closing_value: 123456,
    };

    const result = await service.freezeFixedProjectionV1Preview(preview);
    const persistedFirst = result.monthlyPositions[0];

    expect(result.planVersion.status).toBe("LOCKED");
    expect(persistedFirst?.closing_value).toBe(123456);
  });

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
    const septemberCash = findPosition(result.monthlyPositions, "2026-09", "cash");

    expect(julyCash.metadata.livingExpenseApplied).toBe(40000);
    expect(augustCash.metadata.livingExpenseApplied).toBe(40000);
    expect(septemberCash.metadata.livingExpenseApplied).toBe(32000);
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

    const septemberCash = findPosition(result.monthlyPositions, "2026-09", "cash");
    expect(septemberCash.metadata.livingExpenseApplied).toBe(30000);
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

    expect(julyCash.metadata.livingExpenseApplied).toBe(40000);
    expect(augustCash.metadata.livingExpenseApplied).toBe(40400);
    expect(septemberCash.metadata.livingExpenseApplied).toBe(32643.2);
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

    const septemberCash = findPosition(result.monthlyPositions, "2026-09", "cash");
    expect(septemberCash.metadata.livingExpenseApplied).toBe(40000);
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

    const septemberCash = findPosition(result.monthlyPositions, "2026-09", "cash");
    expect(septemberCash.metadata.livingExpenseApplied).toBe(0);
  });

  it("keeps salary, EPF, and NPS contributions active through retirement month and stops them from the next month", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2032-06",
      horizonEndMonth: "2032-09",
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          retirementMonth: "2032-07",
        },
      },
    }));

    const juneCash = findPosition(result.monthlyPositions, "2032-06", "cash");
    const julyCash = findPosition(result.monthlyPositions, "2032-07", "cash");
    const augustCash = findPosition(result.monthlyPositions, "2032-08", "cash");
    const septemberCash = findPosition(result.monthlyPositions, "2032-09", "cash");

    expect((juneCash.metadata.salaryIncomeFromCommonCurve as number) > 0).toBe(true);
    expect((julyCash.metadata.salaryIncomeFromCommonCurve as number) > 0).toBe(true);
    expect(juneCash.metadata.retired).toBe(false);
    expect(julyCash.metadata.retired).toBe(false);
    expect((augustCash.metadata.salaryIncomeFromCommonCurve as number) === 0).toBe(true);
    expect((septemberCash.metadata.salaryIncomeFromCommonCurve as number) === 0).toBe(true);
    expect(augustCash.metadata.retired).toBe(true);
    expect(septemberCash.metadata.retired).toBe(true);

    const juneEpf = findPosition(result.monthlyPositions, "2032-06", "epf");
    const julyEpf = findPosition(result.monthlyPositions, "2032-07", "epf");
    const augustEpf = findPosition(result.monthlyPositions, "2032-08", "epf");
    const septemberEpf = findPosition(result.monthlyPositions, "2032-09", "epf");

    expect(juneEpf.contribution).toBeGreaterThan(0);
    expect(julyEpf.contribution).toBeGreaterThan(0);
    expect(augustEpf.contribution).toBe(0);
    expect(septemberEpf.contribution).toBe(0);

    const juneNps = findPosition(result.monthlyPositions, "2032-06", "nps");
    const julyNps = findPosition(result.monthlyPositions, "2032-07", "nps");
    const augustNps = findPosition(result.monthlyPositions, "2032-08", "nps");
    const septemberNps = findPosition(result.monthlyPositions, "2032-09", "nps");

    expect(juneNps.contribution).toBeGreaterThan(0);
    expect(julyNps.contribution).toBeGreaterThan(0);
    expect(augustNps.contribution).toBe(0);
    expect(septemberNps.contribution).toBe(0);

    expect(julyNps.metadata.npsSplitApplied).toBe(false);
    expect(augustNps.metadata.npsSplitApplied).toBe(true);
    expect(septemberNps.metadata.npsSplitApplied).toBe(false);
    expect(augustNps.metadata.npsSplitMonth).toBe("2032-08");
    expect(augustNps.metadata.npsLumpSumPercent).toBe(50);
    expect(augustNps.metadata.npsAnnuityPercent).toBe(50);
    expect(augustNps.metadata.npsLumpSumAmount).toBeGreaterThan(0);
    expect(augustNps.metadata.npsAnnuityCorpus).toBeGreaterThan(0);
    expect(augustNps.metadata.npsLumpSumTransferredToCash).toBe(true);
    expect(augustNps.metadata.npsAnnuityIncomeDeferred).toBe(true);
    expect(augustNps.withdrawal).toBe(augustNps.metadata.npsLumpSumAmount);
    expect(augustNps.closing_value).toBe(augustNps.metadata.npsAnnuityCorpus);
    expect(septemberNps.opening_value).toBe(augustNps.closing_value);
    expect(septemberNps.growth).toBe(0);
    expect(septemberNps.closing_value).toBe(augustNps.closing_value);

    expect(augustCash.metadata.npsSplitApplied).toBe(true);
    expect(augustCash.metadata.npsSplitMonth).toBe("2032-08");
    expect(augustCash.metadata.npsLumpSumPercent).toBe(50);
    expect(augustCash.metadata.npsAnnuityPercent).toBe(50);
    expect(augustCash.metadata.npsLumpSumAmount).toBe(augustNps.metadata.npsLumpSumAmount);
    expect(augustCash.metadata.npsAnnuityCorpus).toBe(augustNps.metadata.npsAnnuityCorpus);
    expect(augustCash.metadata.npsLumpSumTransferredToCash).toBe(true);
    expect(augustCash.metadata.npsAnnuityIncomeDeferred).toBe(true);

    const expectedAugCashContribution =
      Number(augustCash.metadata.monthlySurplusOrDeficit)
      + Number(augustCash.metadata.epfTransferAmount)
      + Number(augustCash.metadata.npsLumpSumAmount);
    expect(augustCash.contribution).toBeCloseTo(expectedAugCashContribution, 2);
  });

  it("keeps net worth unchanged by NPS split because lump sum and annuity corpus are asset reclassification only", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2032-07",
      horizonEndMonth: "2032-09",
      openingBalances: {
        cash: 100000,
        mutualFunds: 0,
        stocks: 0,
        epf: 0,
        ppf: 0,
        nps: 200000,
        property: 0,
        gold: 0,
        otherNonFinancialAssets: 0,
        liabilities: 0,
      },
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          currentGrossSalary: 0,
          currentNetSalary: 0,
          currentBasicSalary: 0,
          retirementMonth: "2032-07",
        },
        contributions: {
          ...buildInput().assumptions.contributions,
          mutualFundsMonthlySip: 0,
          stocksMonthlySip: 0,
          epfEmployeeContributionRate: 0,
          epfEmployerContributionRate: 0,
          npsContributionRate: 0,
          ppfMonthlyContributionPriyesh: 0,
          ppfAnnualContributionShobhana: 0,
        },
        returns: {
          ...buildInput().assumptions.returns,
          cashAnnualReturnPercent: 0,
          mutualFundsAnnualReturnPercent: 0,
          stocksAnnualReturnPercent: 0,
          epfAnnualReturnPercent: 0,
          ppfAnnualReturnPercent: 0,
          npsAnnualReturnPercent: 0,
          nonFinancialAnnualReturnPercent: 0,
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          preRetirementMonthlyExpense: 0,
          monthlyEmi: 0,
          monthlyInsurancePremium: 0,
          monthlyOtherRecurringCommitments: 0,
          annualExpenseInflationPercent: 0,
          postRetirementExpenseReductionPercent: 0,
        },
        liabilitiesMonthlyRepayment: 0,
      },
    }));

    const julyNps = findPosition(result.monthlyPositions, "2032-07", "nps");
    const augustNps = findPosition(result.monthlyPositions, "2032-08", "nps");
    const septemberNps = findPosition(result.monthlyPositions, "2032-09", "nps");
    const julyCash = findPosition(result.monthlyPositions, "2032-07", "cash");
    const augustCash = findPosition(result.monthlyPositions, "2032-08", "cash");
    const julyNetWorth = findPosition(result.monthlyPositions, "2032-07", "net_worth");
    const augustNetWorth = findPosition(result.monthlyPositions, "2032-08", "net_worth");
    const septemberNetWorth = findPosition(result.monthlyPositions, "2032-09", "net_worth");

    expect(julyNps.closing_value).toBe(200000);
    expect(augustNps.metadata.npsSplitApplied).toBe(true);
    expect(augustNps.withdrawal).toBe(100000);
    expect(augustNps.closing_value).toBe(100000);
    expect(septemberNps.opening_value).toBe(100000);
    expect(septemberNps.closing_value).toBe(100000);
    expect(septemberNps.growth).toBe(0);

    expect(julyCash.closing_value).toBe(100000);
    expect(augustCash.closing_value).toBe(200000);
    expect(augustCash.metadata.npsLumpSumAmount).toBe(100000);

    expect(julyNetWorth.closing_value).toBe(300000);
    expect(augustNetWorth.closing_value).toBe(300000);
    expect(septemberNetWorth.closing_value).toBe(300000);
  });

  it("applies custom NPS split policy percentages in the first post-retirement month", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2032-07",
      horizonEndMonth: "2032-08",
      openingBalances: {
        cash: 0,
        mutualFunds: 0,
        stocks: 0,
        epf: 0,
        ppf: 0,
        nps: 200000,
        property: 0,
        gold: 0,
        otherNonFinancialAssets: 0,
        liabilities: 0,
      },
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          currentGrossSalary: 0,
          currentNetSalary: 0,
          currentBasicSalary: 0,
          retirementMonth: "2032-07",
        },
        contributions: {
          ...buildInput().assumptions.contributions,
          mutualFundsMonthlySip: 0,
          stocksMonthlySip: 0,
          epfEmployeeContributionRate: 0,
          epfEmployerContributionRate: 0,
          npsContributionRate: 0,
          ppfMonthlyContributionPriyesh: 0,
          ppfAnnualContributionShobhana: 0,
        },
        returns: {
          ...buildInput().assumptions.returns,
          cashAnnualReturnPercent: 0,
          mutualFundsAnnualReturnPercent: 0,
          stocksAnnualReturnPercent: 0,
          epfAnnualReturnPercent: 0,
          ppfAnnualReturnPercent: 0,
          npsAnnualReturnPercent: 0,
          nonFinancialAnnualReturnPercent: 0,
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          preRetirementMonthlyExpense: 0,
          monthlyEmi: 0,
          monthlyInsurancePremium: 0,
          monthlyOtherRecurringCommitments: 0,
          annualExpenseInflationPercent: 0,
          postRetirementExpenseReductionPercent: 0,
        },
        liabilitiesMonthlyRepayment: 0,
        npsSplitPolicy: {
          lumpsumPercent: 60,
          annuityPercent: 40,
        },
      },
    }));

    const augustNps = findPosition(result.monthlyPositions, "2032-08", "nps");
    const augustCash = findPosition(result.monthlyPositions, "2032-08", "cash");

    expect(augustNps.metadata.npsSplitApplied).toBe(true);
    expect(augustNps.metadata.npsLumpSumPercent).toBe(60);
    expect(augustNps.metadata.npsAnnuityPercent).toBe(40);
    expect(augustNps.metadata.npsLumpSumAmount).toBe(120000);
    expect(augustNps.metadata.npsAnnuityCorpus).toBe(80000);
    expect(augustNps.closing_value).toBe(80000);
    expect(augustCash.metadata.npsLumpSumAmount).toBe(120000);
    expect(augustCash.closing_value).toBe(120000);
  });

  it("stops MF and stock SIP from the month after retirement and excludes them from cash outflow", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2032-06",
      horizonEndMonth: "2032-09",
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          retirementMonth: "2032-07",
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          annualExpenseInflationPercent: 0,
          postRetirementExpenseReductionPercent: 0,
        },
      },
    }));

    const juneMutualFunds = findPosition(result.monthlyPositions, "2032-06", "mutual_funds");
    const julyMutualFunds = findPosition(result.monthlyPositions, "2032-07", "mutual_funds");
    const augustMutualFunds = findPosition(result.monthlyPositions, "2032-08", "mutual_funds");
    const septemberMutualFunds = findPosition(result.monthlyPositions, "2032-09", "mutual_funds");

    expect(juneMutualFunds.contribution).toBeGreaterThan(0);
    expect(julyMutualFunds.contribution).toBeGreaterThan(0);
    expect(augustMutualFunds.contribution).toBe(0);
    expect(septemberMutualFunds.contribution).toBe(0);

    const juneStocks = findPosition(result.monthlyPositions, "2032-06", "stocks");
    const julyStocks = findPosition(result.monthlyPositions, "2032-07", "stocks");
    const augustStocks = findPosition(result.monthlyPositions, "2032-08", "stocks");
    const septemberStocks = findPosition(result.monthlyPositions, "2032-09", "stocks");

    expect(juneStocks.contribution).toBeGreaterThan(0);
    expect(julyStocks.contribution).toBeGreaterThan(0);
    expect(augustStocks.contribution).toBe(0);
    expect(septemberStocks.contribution).toBe(0);

    const juneCash = findPosition(result.monthlyPositions, "2032-06", "cash");
    const julyCash = findPosition(result.monthlyPositions, "2032-07", "cash");
    const augustCash = findPosition(result.monthlyPositions, "2032-08", "cash");
    const septemberCash = findPosition(result.monthlyPositions, "2032-09", "cash");

    expect(juneCash.metadata.mutualFundsSipApplied).toBe(20000);
    expect(juneCash.metadata.stocksSipApplied).toBe(7000);
    expect(julyCash.metadata.mutualFundsSipApplied).toBe(20000);
    expect(julyCash.metadata.stocksSipApplied).toBe(7000);
    expect(augustCash.metadata.mutualFundsSipApplied).toBe(0);
    expect(augustCash.metadata.stocksSipApplied).toBe(0);
    expect(septemberCash.metadata.mutualFundsSipApplied).toBe(0);
    expect(septemberCash.metadata.stocksSipApplied).toBe(0);

    expect(Number(julyCash.metadata.monthlyTotalCashOutflow) - Number(augustCash.metadata.monthlyTotalCashOutflow)).toBe(27000);
  });

  it("transfers EPF to cash in 2035-08, the first month after 36 full post-retirement months from retirement month 2032-07", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2035-07",
      horizonEndMonth: "2035-09",
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          retirementMonth: "2032-07",
        },
      },
    }));

    const julyEpf = findPosition(result.monthlyPositions, "2035-07", "epf");
    const augustEpf = findPosition(result.monthlyPositions, "2035-08", "epf");
    const septemberEpf = findPosition(result.monthlyPositions, "2035-09", "epf");
    const julyCash = findPosition(result.monthlyPositions, "2035-07", "cash");
    const augustCash = findPosition(result.monthlyPositions, "2035-08", "cash");

    expect(julyEpf.closing_value).toBeGreaterThan(0);
    expect(julyEpf.metadata.epfTransferredToCash).toBe(false);
    expect(julyEpf.growth).toBeGreaterThan(0);

    expect(augustEpf.opening_value).toBe(julyEpf.closing_value);
    expect(augustEpf.metadata.epfTransferMonth).toBe("2035-08");
    expect(augustEpf.metadata.epfTransferredToCash).toBe(true);
    expect(augustEpf.metadata.epfTransferAmount).toBe(julyEpf.closing_value);
    expect(augustEpf.contribution).toBe(0);
    expect(augustEpf.growth).toBe(0);
    expect(augustEpf.withdrawal).toBe(julyEpf.closing_value);
    expect(augustEpf.closing_value).toBe(0);

    expect(augustCash.metadata.epfTransferMonth).toBe("2035-08");
    expect(augustCash.metadata.epfTransferredToCash).toBe(true);
    expect(augustCash.metadata.epfTransferAmount).toBe(julyEpf.closing_value);
    expect(augustCash.closing_value).toBe(julyCash.closing_value + augustCash.contribution);

    expect(septemberEpf.opening_value).toBe(0);
    expect(septemberEpf.contribution).toBe(0);
    expect(septemberEpf.growth).toBe(0);
    expect(septemberEpf.closing_value).toBe(0);
    expect(septemberEpf.metadata.epfTransferredToCash).toBe(false);
  });

  it("keeps net worth unchanged by EPF transfer because it is only an asset reclassification", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2035-07",
      horizonEndMonth: "2035-09",
      openingBalances: {
        cash: 100000,
        mutualFunds: 0,
        stocks: 0,
        epf: 300000,
        ppf: 0,
        nps: 0,
        property: 0,
        gold: 0,
        otherNonFinancialAssets: 0,
        liabilities: 0,
      },
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          currentGrossSalary: 0,
          currentNetSalary: 0,
          currentBasicSalary: 0,
          retirementMonth: "2032-07",
        },
        contributions: {
          ...buildInput().assumptions.contributions,
          mutualFundsMonthlySip: 0,
          stocksMonthlySip: 0,
          epfEmployeeContributionRate: 0,
          epfEmployerContributionRate: 0,
          npsContributionRate: 0,
          ppfMonthlyContributionPriyesh: 0,
          ppfAnnualContributionShobhana: 0,
        },
        returns: {
          ...buildInput().assumptions.returns,
          cashAnnualReturnPercent: 0,
          mutualFundsAnnualReturnPercent: 0,
          stocksAnnualReturnPercent: 0,
          epfAnnualReturnPercent: 0,
          ppfAnnualReturnPercent: 0,
          npsAnnualReturnPercent: 0,
          nonFinancialAnnualReturnPercent: 0,
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          preRetirementMonthlyExpense: 0,
          monthlyEmi: 0,
          monthlyInsurancePremium: 0,
          monthlyOtherRecurringCommitments: 0,
          annualExpenseInflationPercent: 0,
        },
        liabilitiesMonthlyRepayment: 0,
      },
    }));

    const julyCash = findPosition(result.monthlyPositions, "2035-07", "cash");
    const augustCash = findPosition(result.monthlyPositions, "2035-08", "cash");
    const julyEpf = findPosition(result.monthlyPositions, "2035-07", "epf");
    const augustEpf = findPosition(result.monthlyPositions, "2035-08", "epf");
    const julyNetWorth = findPosition(result.monthlyPositions, "2035-07", "net_worth");
    const augustNetWorth = findPosition(result.monthlyPositions, "2035-08", "net_worth");

    expect(julyCash.closing_value).toBe(100000);
    expect(julyEpf.closing_value).toBe(300000);
    expect(augustCash.closing_value).toBe(400000);
    expect(augustEpf.closing_value).toBe(0);
    expect(julyNetWorth.closing_value).toBe(400000);
    expect(augustNetWorth.closing_value).toBe(400000);
  });

  it("applies one-time outflow drawdown in order cash -> mutual funds -> ppf -> epf with metadata and no repeat", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2026-07",
      horizonEndMonth: "2026-09",
      openingBalances: {
        cash: 8000,
        mutualFunds: 10000,
        stocks: 0,
        epf: 6000,
        ppf: 4000,
        nps: 0,
        property: 100000,
        gold: 0,
        otherNonFinancialAssets: 0,
        liabilities: 0,
      },
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          currentGrossSalary: 0,
          currentNetSalary: 0,
          currentBasicSalary: 0,
          retirementMonth: "2026-06",
        },
        contributions: {
          ...buildInput().assumptions.contributions,
          mutualFundsMonthlySip: 0,
          stocksMonthlySip: 0,
          epfEmployeeContributionRate: 0,
          epfEmployerContributionRate: 0,
          npsContributionRate: 0,
          ppfMonthlyContributionPriyesh: 0,
          ppfAnnualContributionShobhana: 0,
        },
        returns: {
          ...buildInput().assumptions.returns,
          cashAnnualReturnPercent: 0,
          mutualFundsAnnualReturnPercent: 0,
          stocksAnnualReturnPercent: 0,
          epfAnnualReturnPercent: 0,
          ppfAnnualReturnPercent: 0,
          npsAnnualReturnPercent: 0,
          nonFinancialAnnualReturnPercent: 0,
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          preRetirementMonthlyExpense: 0,
          monthlyEmi: 0,
          monthlyInsurancePremium: 0,
          monthlyOtherRecurringCommitments: 0,
          annualExpenseInflationPercent: 0,
          postRetirementExpenseReductionPercent: 0,
        },
        liabilitiesMonthlyRepayment: 0,
      },
      oneTimeOutflows: [
        {
          id: "goal-1",
          name: "Home renovation",
          month: "2026-08",
          amount: 25000,
          source: "Goal",
        },
      ],
    }));

    const julyNetWorth = findPosition(result.monthlyPositions, "2026-07", "net_worth");
    const augustNetWorth = findPosition(result.monthlyPositions, "2026-08", "net_worth");
    expect(julyNetWorth.closing_value - augustNetWorth.closing_value).toBe(25000);

    const augustCash = findPosition(result.monthlyPositions, "2026-08", "cash");
    const augustMutualFunds = findPosition(result.monthlyPositions, "2026-08", "mutual_funds");
    const augustPpf = findPosition(result.monthlyPositions, "2026-08", "ppf");
    const augustEpf = findPosition(result.monthlyPositions, "2026-08", "epf");
    const augustNonFinancial = findPosition(result.monthlyPositions, "2026-08", "non_financial_assets_total");

    expect(augustCash.withdrawal).toBe(8000);
    expect(augustMutualFunds.withdrawal).toBe(10000);
    expect(augustPpf.withdrawal).toBe(4000);
    expect(augustEpf.withdrawal).toBe(3000);
    expect(augustNonFinancial.closing_value).toBe(100000);

    expect(augustCash.metadata.oneTimeOutflowAmount).toBe(25000);
    expect(augustCash.metadata.oneTimeOutflowNames).toEqual(["Home renovation"]);
    expect(augustCash.metadata.drawdownApplied).toBe(25000);
    expect(augustCash.metadata.unfundedOutflowAmount).toBe(0);
    expect(augustCash.metadata.drawdownSources).toEqual([
      { bucketKey: "cash", amount: 8000 },
      { bucketKey: "mutual_funds", amount: 10000 },
      { bucketKey: "ppf", amount: 4000 },
      { bucketKey: "epf", amount: 3000 },
    ]);

    const septemberCash = findPosition(result.monthlyPositions, "2026-09", "cash");
    const septemberMutualFunds = findPosition(result.monthlyPositions, "2026-09", "mutual_funds");
    expect(septemberCash.metadata.oneTimeOutflowAmount).toBe(0);
    expect(septemberCash.withdrawal).toBe(0);
    expect(septemberMutualFunds.withdrawal).toBe(0);
  });

  it("reports unfunded one-time outflow amount when cash, mutual funds, ppf, and epf are insufficient", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2026-07",
      horizonEndMonth: "2026-07",
      openingBalances: {
        cash: 1000,
        mutualFunds: 1000,
        stocks: 0,
        epf: 1000,
        ppf: 1000,
        nps: 0,
        property: 50000,
        gold: 0,
        otherNonFinancialAssets: 0,
        liabilities: 0,
      },
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          currentGrossSalary: 0,
          currentNetSalary: 0,
          currentBasicSalary: 0,
          retirementMonth: "2026-06",
        },
        contributions: {
          ...buildInput().assumptions.contributions,
          mutualFundsMonthlySip: 0,
          stocksMonthlySip: 0,
          epfEmployeeContributionRate: 0,
          epfEmployerContributionRate: 0,
          npsContributionRate: 0,
          ppfMonthlyContributionPriyesh: 0,
          ppfAnnualContributionShobhana: 0,
        },
        returns: {
          ...buildInput().assumptions.returns,
          cashAnnualReturnPercent: 0,
          mutualFundsAnnualReturnPercent: 0,
          stocksAnnualReturnPercent: 0,
          epfAnnualReturnPercent: 0,
          ppfAnnualReturnPercent: 0,
          npsAnnualReturnPercent: 0,
          nonFinancialAnnualReturnPercent: 0,
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          preRetirementMonthlyExpense: 0,
          monthlyEmi: 0,
          monthlyInsurancePremium: 0,
          monthlyOtherRecurringCommitments: 0,
          annualExpenseInflationPercent: 0,
          postRetirementExpenseReductionPercent: 0,
        },
        liabilitiesMonthlyRepayment: 0,
      },
      oneTimeOutflows: [
        {
          id: "event-1",
          name: "Education payment",
          month: "2026-07",
          amount: 10000,
          source: "Financial Event",
        },
      ],
    }));

    const julyCash = findPosition(result.monthlyPositions, "2026-07", "cash");
    const julyMutualFunds = findPosition(result.monthlyPositions, "2026-07", "mutual_funds");
    const julyPpf = findPosition(result.monthlyPositions, "2026-07", "ppf");
    const julyEpf = findPosition(result.monthlyPositions, "2026-07", "epf");
    const julyNonFinancial = findPosition(result.monthlyPositions, "2026-07", "non_financial_assets_total");
    const julyNetWorth = findPosition(result.monthlyPositions, "2026-07", "net_worth");

    expect(julyCash.withdrawal).toBe(1000);
    expect(julyMutualFunds.withdrawal).toBe(1000);
    expect(julyPpf.withdrawal).toBe(1000);
    expect(julyEpf.withdrawal).toBe(1000);
    expect(julyNonFinancial.closing_value).toBe(50000);

    expect(julyCash.metadata.oneTimeOutflowAmount).toBe(10000);
    expect(julyCash.metadata.drawdownApplied).toBe(4000);
    expect(julyCash.metadata.unfundedOutflowAmount).toBe(6000);
    expect(julyCash.metadata.drawdownSources).toEqual([
      { bucketKey: "cash", amount: 1000 },
      { bucketKey: "mutual_funds", amount: 1000 },
      { bucketKey: "ppf", amount: 1000 },
      { bucketKey: "epf", amount: 1000 },
    ]);
    expect(julyNetWorth.closing_value).toBe(50000);
  });

  it("computes monthly surplus as net income minus total monthly cash outflow", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const preview = service.createFixedProjectionPreview(buildInput({
      startMonth: "2026-07",
      horizonEndMonth: "2026-07",
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          currentGrossSalary: 100000,
          currentNetSalary: 80000,
          currentBasicSalary: 40000,
        },
        contributions: {
          ...buildInput().assumptions.contributions,
          mutualFundsMonthlySip: 5000,
          stocksMonthlySip: 2000,
          npsContributionRate: 10,
          ppfMonthlyContributionPriyesh: 1000,
          ppfAnnualContributionShobhana: 0,
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          preRetirementMonthlyExpense: 40000,
          monthlyEmi: 10000,
          monthlyInsurancePremium: 5000,
          monthlyOtherRecurringCommitments: 3000,
          annualExpenseInflationPercent: 0,
        },
        netSalaryIncludesEmployeeDeductions: true,
      },
    }));

    const julyCash = preview.monthlyPositionRows.find((row) => row.month_key === "2026-07" && row.bucket_key === "cash");
    if (!julyCash) {
      throw new Error("Expected 2026-07 cash row.");
    }

    expect(julyCash.metadata.monthlyTotalCashOutflow).toBe(66000);
    expect(julyCash.metadata.salaryIncomeFromCommonCurve).toBe(80000);
    expect(julyCash.metadata.monthlySurplusOrDeficit).toBe(14000);
    expect(julyCash.contribution).toBe(14000);
  });

  it("sets cash closing balance using opening cash plus monthly surplus and cash growth", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2026-07",
      horizonEndMonth: "2026-07",
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          currentGrossSalary: 100000,
          currentNetSalary: 80000,
          currentBasicSalary: 40000,
        },
        contributions: {
          ...buildInput().assumptions.contributions,
          mutualFundsMonthlySip: 5000,
          stocksMonthlySip: 2000,
          npsContributionRate: 10,
          ppfMonthlyContributionPriyesh: 1000,
          ppfAnnualContributionShobhana: 0,
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          preRetirementMonthlyExpense: 40000,
          monthlyEmi: 10000,
          monthlyInsurancePremium: 5000,
          monthlyOtherRecurringCommitments: 3000,
          annualExpenseInflationPercent: 0,
        },
        netSalaryIncludesEmployeeDeductions: true,
      },
    }));

    const julyCash = findPosition(result.monthlyPositions, "2026-07", "cash");
    expect(julyCash.opening_value).toBe(100000);
    expect(julyCash.growth).toBe(0);
    expect(julyCash.contribution).toBe(14000);
    expect(julyCash.closing_value).toBe(114000);
  });

  it("includes EMI, insurance, MF SIP, stock SIP, PPF, NPS/EPF employee deductions, and recurring commitments in monthly outflow when net salary excludes them", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2026-07",
      horizonEndMonth: "2026-07",
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          currentGrossSalary: 100000,
          currentNetSalary: 80000,
          currentBasicSalary: 40000,
        },
        contributions: {
          ...buildInput().assumptions.contributions,
          mutualFundsMonthlySip: 5000,
          stocksMonthlySip: 2000,
          npsContributionRate: 10,
          epfEmployeeContributionRate: 12,
          ppfMonthlyContributionPriyesh: 1000,
          ppfAnnualContributionShobhana: 0,
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          preRetirementMonthlyExpense: 40000,
          monthlyEmi: 10000,
          monthlyInsurancePremium: 5000,
          monthlyOtherRecurringCommitments: 3000,
          annualExpenseInflationPercent: 0,
        },
        netSalaryIncludesEmployeeDeductions: false,
      },
    }));

    const julyCash = findPosition(result.monthlyPositions, "2026-07", "cash");
    expect(julyCash.metadata.employeeRetirementContributionsDeductedFromCash).toBe(8800);
    expect(julyCash.metadata.monthlyTotalCashOutflow).toBe(74800);
    expect(julyCash.metadata.monthlySurplusOrDeficit).toBe(5200);
  });

  it("keeps surplus metadata non-zero when monthly income and expense differ", () => {
    const service = new FixedProjectionService(new InMemoryProjectionVersioningService() as never, new SalaryProjectionService());

    const preview = service.createFixedProjectionPreview(buildInput({
      startMonth: "2026-07",
      horizonEndMonth: "2026-07",
      assumptions: {
        ...buildInput().assumptions,
        salary: {
          ...buildInput().assumptions.salary,
          currentGrossSalary: 100000,
          currentNetSalary: 80000,
          currentBasicSalary: 40000,
        },
        contributions: {
          ...buildInput().assumptions.contributions,
          mutualFundsMonthlySip: 5000,
          stocksMonthlySip: 0,
          ppfMonthlyContributionPriyesh: 1000,
          ppfAnnualContributionShobhana: 0,
          npsContributionRate: 10,
        },
        expenses: {
          ...buildInput().assumptions.expenses,
          preRetirementMonthlyExpense: 40000,
          monthlyEmi: 10000,
          monthlyInsurancePremium: 5000,
          monthlyOtherRecurringCommitments: 3000,
          annualExpenseInflationPercent: 0,
        },
        netSalaryIncludesEmployeeDeductions: true,
      },
    }));

    const snapshot = preview.monthSnapshots[0];
    expect(snapshot?.monthly_income).toBe(80000);
    expect(snapshot?.monthly_expense).toBe(64000);
    expect(snapshot?.corpus_drawdown).toBe(16000);
    expect(snapshot?.corpus_drawdown).not.toBe(0);
  });

  it("does not double count employee EPF/NPS from cash when take-home salary already excludes them", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const baseAssumptions = {
      ...buildInput().assumptions,
      salary: {
        ...buildInput().assumptions.salary,
        currentGrossSalary: 100000,
        currentNetSalary: 80000,
        currentBasicSalary: 40000,
      },
      contributions: {
        ...buildInput().assumptions.contributions,
        mutualFundsMonthlySip: 5000,
        stocksMonthlySip: 2000,
        epfEmployeeContributionRate: 12,
        npsContributionRate: 10,
        ppfMonthlyContributionPriyesh: 1000,
        ppfAnnualContributionShobhana: 0,
      },
      expenses: {
        ...buildInput().assumptions.expenses,
        preRetirementMonthlyExpense: 40000,
        monthlyEmi: 10000,
        monthlyInsurancePremium: 5000,
        monthlyOtherRecurringCommitments: 3000,
        annualExpenseInflationPercent: 0,
      },
    };

    const withNetDeductions = await service.createFixedProjectionV1(buildInput({
      startMonth: "2026-07",
      horizonEndMonth: "2026-07",
      assumptions: {
        ...baseAssumptions,
        netSalaryIncludesEmployeeDeductions: true,
      },
    }));

    const withoutNetDeductions = await service.createFixedProjectionV1(buildInput({
      startMonth: "2026-07",
      horizonEndMonth: "2026-07",
      assumptions: {
        ...baseAssumptions,
        netSalaryIncludesEmployeeDeductions: false,
      },
    }));

    const julyCashWithNetDeductions = findPosition(withNetDeductions.monthlyPositions, "2026-07", "cash");
    const julyCashWithoutNetDeductions = findPosition(withoutNetDeductions.monthlyPositions, "2026-07", "cash");

    expect(julyCashWithNetDeductions.metadata.employeeRetirementContributionsDeductedFromCash).toBe(0);
    expect(julyCashWithoutNetDeductions.metadata.employeeRetirementContributionsDeductedFromCash).toBe(8800);
    expect(julyCashWithNetDeductions.contribution).toBe(14000);
    expect(julyCashWithoutNetDeductions.contribution).toBe(5200);
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

  it("keeps preview month keys as YYYY-MM", () => {
    const service = new FixedProjectionService(new InMemoryProjectionVersioningService() as never, new SalaryProjectionService());

    const preview = service.createFixedProjectionPreview(buildInput({
      startMonth: "2056-10",
      horizonEndMonth: "2056-12",
    }));

    expect(preview.startMonth).toBe("2056-10");
    expect(preview.horizonEndMonth).toBe("2056-12");
    expect(preview.salaryCurveRows.every((row) => /^\d{4}-\d{2}$/.test(row.month_key))).toBe(true);
    expect(preview.monthlyPositionRows.every((row) => /^\d{4}-\d{2}$/.test(row.month_key))).toBe(true);
  });

  it("converts YYYY-MM to YYYY-MM-01 only during freeze persistence and succeeds", async () => {
    const repository = new CapturingProjectionVersioningRepository();
    const versioningService = new ProjectionVersioningService(repository as never);
    const service = new FixedProjectionService(versioningService as never, new SalaryProjectionService());

    const result = await service.createFixedProjectionV1(buildInput({
      startMonth: "2056-10",
      horizonEndMonth: "2056-12",
    }));

    expect(repository.planInput?.start_month).toBe("2056-10-01");
    expect(repository.planInput?.horizon_end_month).toBe("2056-12-01");
    expect(repository.salaryRowsInput.length).toBeGreaterThan(0);
    expect(repository.salaryRowsInput.every((row) => /^\d{4}-\d{2}-01$/.test(row.month_key))).toBe(true);
    expect(repository.monthlyRowsInput.length).toBeGreaterThan(0);
    expect(repository.monthlyRowsInput.every((row) => /^\d{4}-\d{2}-01$/.test(row.month_key))).toBe(true);

    expect(result.planVersion.status).toBe("LOCKED");
    expect(result.planVersion.start_month).toBe("2056-10");
    expect(result.planVersion.horizon_end_month).toBe("2056-12");
    expect(result.salaryCurve.every((row) => /^\d{4}-\d{2}$/.test(row.month_key))).toBe(true);
    expect(result.monthlyPositions.every((row) => /^\d{4}-\d{2}$/.test(row.month_key))).toBe(true);
  });

  it("throws a helpful error for invalid month keys in persistence conversion", () => {
    expect(() => monthKeyToDate("2056-13")).toThrow("Invalid month key \"2056-13\". Expected YYYY-MM.");
    expect(() => monthKeyToDate("2056/12")).toThrow("Invalid month key \"2056/12\". Expected YYYY-MM.");
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
