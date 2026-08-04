import { describe, expect, it } from "vitest";

import { FixedProjectionService, type CreateFixedProjectionV1Input, type FixedProjectionBucketKey } from "./FixedProjectionService";
import { RollingProjectionService, type RollingProjectionCloseItem, type RollingProjectionSource } from "./RollingProjectionService";
import { SalaryProjectionService } from "./SalaryProjectionService";
import type {
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

  rebaseJournalRows: ProjectionRebaseJournalRecord[] = [];

  async createPlanVersion(input: {
    household_id?: string | null;
    plan_kind: "FIXED" | "ROLLING" | "WHAT_IF";
    version_no: number;
    status?: "DRAFT" | "LOCKED" | "ARCHIVED";
    start_month: string;
    horizon_end_month: string;
    base_close_id?: string | null;
    parent_fixed_version_id?: string | null;
    locked_at?: string | null;
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
      base_close_id: input.base_close_id ?? null,
      parent_fixed_version_id: input.parent_fixed_version_id ?? null,
      locked_at: input.locked_at ?? null,
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

  async appendRebaseJournal(input: {
    rolling_version_id: string;
    parent_fixed_version_id: string;
    rebased_from_close_id: string;
    rebased_month: string;
    prior_rolling_version_id?: string | null;
  }): Promise<ProjectionRebaseJournalRecord> {
    const row: ProjectionRebaseJournalRecord = {
      id: `journal-${this.idCounter++}`,
      rolling_version_id: input.rolling_version_id,
      parent_fixed_version_id: input.parent_fixed_version_id,
      rebased_from_close_id: input.rebased_from_close_id,
      rebased_month: input.rebased_month,
      prior_rolling_version_id: input.prior_rolling_version_id ?? null,
      created_at: new Date().toISOString(),
    };

    this.rebaseJournalRows.push(row);
    return row;
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

class InMemoryRollingProjectionSource implements RollingProjectionSource {
  latestRollingVersionNo: number | null;

  constructor(
    private readonly fixedPlan: ProjectionPlanVersionRecord | null,
    private readonly fixedSnapshot: ProjectionAssumptionSnapshotRecord | null,
    private readonly latestClosedMonth: { id: string; close_month: number; close_year: number } | null,
    private readonly closeItems: RollingProjectionCloseItem[],
    private readonly goals: Array<Record<string, unknown>> = [],
    private readonly projectionEvents: Array<Record<string, unknown>> = [],
    latestRollingVersionNo: number | null = null,
  ) {
    this.latestRollingVersionNo = latestRollingVersionNo;
  }

  async getLatestClosedMonthEnd() {
    return this.latestClosedMonth;
  }

  async getLatestLockedFixedPlan() {
    return this.fixedPlan;
  }

  async getLatestRollingVersionNo() {
    return this.latestRollingVersionNo;
  }

  async getAssumptionSnapshotByPlanVersionId() {
    return this.fixedSnapshot;
  }

  async getMonthEndCloseItems() {
    return this.closeItems;
  }

  async getGoals() {
    return this.goals as never;
  }

  async getProjectionEvents() {
    return this.projectionEvents as never;
  }
}

function buildFixedInput(overrides?: Partial<CreateFixedProjectionV1Input>): CreateFixedProjectionV1Input {
  return {
    versionNo: 1,
    startMonth: "2026-07",
    horizonEndMonth: "2026-10",
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

describe("RollingProjectionService", () => {
  it("creates a locked rolling projection linked to fixed and rebased from latest close", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const salary = new SalaryProjectionService();
    const fixedService = new FixedProjectionService(versioning as never, salary);

    const fixed = await fixedService.createFixedProjectionV1(buildFixedInput());

    const fixedRowsBefore = versioning.monthlyPositions
      .filter((row) => row.projection_plan_version_id === fixed.planVersion.id)
      .map((row) => ({ ...row }));

    const source = new InMemoryRollingProjectionSource(
      fixed.planVersion,
      fixed.assumptionSnapshot,
      {
        id: "close-2026-07",
        close_month: 7,
        close_year: 2026,
      },
      [
        { item_key: "bank_accounts", actual_value: 120000 },
        { item_key: "mutual_funds", actual_value: 530000 },
        { item_key: "stocks", actual_value: 230000 },
        { item_key: "epf", actual_value: 320000 },
        { item_key: "ppf", actual_value: 110000 },
        { item_key: "nps", actual_value: 170000 },
        { item_key: "real_estate", actual_value: 5100000 },
        { item_key: "gold", actual_value: 305000 },
        { item_key: "silver", actual_value: 25000 },
        { item_key: "other_assets", actual_value: 150000 },
        { item_key: "home_loans", actual_value: 700000 },
        { item_key: "car_loans", actual_value: 120000 },
        { item_key: "other_liabilities", actual_value: 80000 },
      ],
    );

    const rollingService = new RollingProjectionService(versioning as never, salary, fixedService, source);

    const rolling = await rollingService.createRollingProjectionV1({
      versionNo: 2,
      priorRollingVersionId: null,
    });

    expect(rolling.planVersion.plan_kind).toBe("ROLLING");
    expect(rolling.planVersion.status).toBe("LOCKED");
    expect(rolling.planVersion.parent_fixed_version_id).toBe(fixed.planVersion.id);
    expect(rolling.planVersion.base_close_id).toBe("close-2026-07");
    expect(rolling.planVersion.start_month).toBe("2026-08");
    expect(rolling.planVersion.horizon_end_month).toBe(fixed.planVersion.horizon_end_month);

    expect(rolling.rebaseJournal.rolling_version_id).toBe(rolling.planVersion.id);
    expect(rolling.rebaseJournal.parent_fixed_version_id).toBe(fixed.planVersion.id);
    expect(rolling.rebaseJournal.rebased_from_close_id).toBe("close-2026-07");

    const openingCash = findPosition(rolling.monthlyPositions, "2026-08", "cash");
    const openingMutualFunds = findPosition(rolling.monthlyPositions, "2026-08", "mutual_funds");
    const openingStocks = findPosition(rolling.monthlyPositions, "2026-08", "stocks");
    const openingEpf = findPosition(rolling.monthlyPositions, "2026-08", "epf");
    const openingPpf = findPosition(rolling.monthlyPositions, "2026-08", "ppf");
    const openingNps = findPosition(rolling.monthlyPositions, "2026-08", "nps");
    const openingLiabilities = findPosition(rolling.monthlyPositions, "2026-08", "liabilities");

    expect(openingCash.opening_value).toBe(120000);
    expect(openingMutualFunds.opening_value).toBe(530000);
    expect(openingStocks.opening_value).toBe(230000);
    expect(openingEpf.opening_value).toBe(320000);
    expect(openingPpf.opening_value).toBe(110000);
    expect(openingNps.opening_value).toBe(170000);
    expect(openingLiabilities.opening_value).toBe(900000);

    expect(rolling.salaryCurve.length).toBe(3);
    expect(rolling.salaryCurve.every((row) => row.source === "ROLLING_REBASE")).toBe(true);
    expect(rolling.monthlyPositions.length).toBe(30);

    const fixedRowsAfter = versioning.monthlyPositions
      .filter((row) => row.projection_plan_version_id === fixed.planVersion.id)
      .map((row) => ({ ...row }));

    expect(fixedRowsAfter).toEqual(fixedRowsBefore);
  });

  it("blocks preview when no locked fixed projection exists", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const salary = new SalaryProjectionService();
    const fixedService = new FixedProjectionService(versioning as never, salary);

    const source = new InMemoryRollingProjectionSource(
      null,
      null,
      {
        id: "close-2026-07",
        close_month: 7,
        close_year: 2026,
      },
      [],
    );

    const rollingService = new RollingProjectionService(versioning as never, salary, fixedService, source);

    await expect(rollingService.createRollingProjectionPreview({})).rejects.toThrow(
      "A locked Fixed Projection is required before generating Rolling Projection.",
    );
  });

  it("blocks preview when no closed month-end exists", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const salary = new SalaryProjectionService();
    const fixedService = new FixedProjectionService(versioning as never, salary);
    const fixed = await fixedService.createFixedProjectionV1(buildFixedInput());

    const source = new InMemoryRollingProjectionSource(
      fixed.planVersion,
      fixed.assumptionSnapshot,
      null,
      [],
    );

    const rollingService = new RollingProjectionService(versioning as never, salary, fixedService, source);

    await expect(rollingService.createRollingProjectionPreview({})).rejects.toThrow(
      "Close a monthly review before generating Rolling Projection.",
    );
  });

  it("builds preview from latest fixed plan and latest closed month-end balances", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const salary = new SalaryProjectionService();
    const fixedService = new FixedProjectionService(versioning as never, salary);
    const fixed = await fixedService.createFixedProjectionV1(buildFixedInput());

    const source = new InMemoryRollingProjectionSource(
      fixed.planVersion,
      fixed.assumptionSnapshot,
      {
        id: "close-2026-07",
        close_month: 7,
        close_year: 2026,
      },
      [
        { item_key: "bank_accounts", actual_value: 180000 },
        { item_key: "mutual_funds", actual_value: 580000 },
        { item_key: "stocks", actual_value: 250000 },
        { item_key: "epf", actual_value: 340000 },
        { item_key: "ppf", actual_value: 120000 },
        { item_key: "nps", actual_value: 200000 },
        { item_key: "real_estate", actual_value: 5200000 },
        { item_key: "gold", actual_value: 320000 },
        { item_key: "other_assets", actual_value: 150000 },
        { item_key: "home_loans", actual_value: 650000 },
        { item_key: "other_liabilities", actual_value: 50000 },
      ],
      [],
      [],
      4,
    );

    const rollingService = new RollingProjectionService(versioning as never, salary, fixedService, source);
    const preview = await rollingService.createRollingProjectionPreview({});

    expect(preview.input.versionNo).toBe(5);
    expect(preview.linkedFixedPlanId).toBe(fixed.planVersion.id);
    expect(preview.linkedFixedVersionNo).toBe(fixed.planVersion.version_no);
    expect(preview.rebasedFromMonth).toBe("2026-07");
    expect(preview.startMonth).toBe("2026-08");

    const firstCash = preview.monthlyPositionRows.find((row) => row.month_key === "2026-08" && row.bucket_key === "cash");
    const firstLiabilities = preview.monthlyPositionRows.find((row) => row.month_key === "2026-08" && row.bucket_key === "liabilities");

    expect(firstCash?.opening_value).toBe(180000);
    expect(firstLiabilities?.opening_value).toBe(700000);
  });

  it("sums repeated month-end item keys when computing rolling opening balances", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const salary = new SalaryProjectionService();
    const fixedService = new FixedProjectionService(versioning as never, salary);
    const fixed = await fixedService.createFixedProjectionV1(buildFixedInput());

    const source = new InMemoryRollingProjectionSource(
      fixed.planVersion,
      fixed.assumptionSnapshot,
      {
        id: "close-2026-07",
        close_month: 7,
        close_year: 2026,
      },
      [
        { item_key: "bank_accounts", actual_value: 100000 },
        { item_key: "bank_accounts", actual_value: 55555 },
        { item_key: "mutual_funds", actual_value: 400000 },
        { item_key: "mutual_funds", actual_value: 97285 },
        { item_key: "stocks", actual_value: 300000 },
        { item_key: "stocks", actual_value: 35600 },
        { item_key: "ppf", actual_value: 900000 },
        { item_key: "ppf", actual_value: 161689 },
        { item_key: "epf", actual_value: 18800000 },
        { item_key: "nps", actual_value: 455000 },
        { item_key: "real_estate", actual_value: 32000000 },
        { item_key: "gold", actual_value: 700000 },
        { item_key: "silver", actual_value: 100000 },
        { item_key: "other_assets", actual_value: 50000 },
        { item_key: "home_loans", actual_value: 9000000 },
        { item_key: "car_loans", actual_value: 250000 },
        { item_key: "other_liabilities", actual_value: 127700 },
      ],
    );

    const rollingService = new RollingProjectionService(versioning as never, salary, fixedService, source);
    const preview = await rollingService.createRollingProjectionPreview({});

    const firstCash = preview.monthlyPositionRows.find((row) => row.month_key === "2026-08" && row.bucket_key === "cash");
    const firstMutualFunds = preview.monthlyPositionRows.find((row) => row.month_key === "2026-08" && row.bucket_key === "mutual_funds");
    const firstStocks = preview.monthlyPositionRows.find((row) => row.month_key === "2026-08" && row.bucket_key === "stocks");
    const firstPpf = preview.monthlyPositionRows.find((row) => row.month_key === "2026-08" && row.bucket_key === "ppf");
    const firstLiabilities = preview.monthlyPositionRows.find((row) => row.month_key === "2026-08" && row.bucket_key === "liabilities");

    expect(firstCash?.opening_value).toBe(155555);
    expect(firstMutualFunds?.opening_value).toBe(497285);
    expect(firstStocks?.opening_value).toBe(335600);
    expect(firstPpf?.opening_value).toBe(1061689);
    expect(firstLiabilities?.opening_value).toBe(9377700);
  });

  it("carries one-time outflows from goals and events into preview assumptions", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const salary = new SalaryProjectionService();
    const fixedService = new FixedProjectionService(versioning as never, salary);
    const fixed = await fixedService.createFixedProjectionV1(buildFixedInput());

    const source = new InMemoryRollingProjectionSource(
      fixed.planVersion,
      fixed.assumptionSnapshot,
      {
        id: "close-2026-07",
        close_month: 7,
        close_year: 2026,
      },
      [{ item_key: "bank_accounts", actual_value: 150000 }],
      [
        {
          id: "goal-1",
          name: "MBA tuition",
          is_completed: false,
          status: "ACTIVE",
          target_amount: 400000,
          target_date: "2026-09-10",
          goal_type: "education",
          beneficiary: "Self",
          funding_source: "Goal",
        },
      ],
      [
        {
          id: "event-1",
          name: "Renovation",
          isEnabled: true,
          amount: 250000,
          date: "2026-10-01",
          frequency: "one-time",
          module: "cashflow",
          type: "expense",
          metadata: { source: "Financial Event" },
        },
      ],
    );

    const rollingService = new RollingProjectionService(versioning as never, salary, fixedService, source);
    const preview = await rollingService.createRollingProjectionPreview({});

    expect(preview.oneTimeOutflows).toHaveLength(2);
    expect(preview.oneTimeOutflows.map((outflow) => outflow.month)).toEqual(["2026-09", "2026-10"]);

    const payload = preview.assumptionSnapshotInput.assumption_payload as {
      oneTimeOutflows?: Array<{ name: string }>;
    };
    expect(payload.oneTimeOutflows?.map((item) => item.name)).toEqual(["MBA tuition", "Renovation"]);
  });

  it("preserves net salary deduction handling from fixed snapshot", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const salary = new SalaryProjectionService();
    const fixedService = new FixedProjectionService(versioning as never, salary);
    const fixed = await fixedService.createFixedProjectionV1(
      buildFixedInput({
        assumptions: {
          ...buildFixedInput().assumptions,
          netSalaryIncludesEmployeeDeductions: false,
        },
      }),
    );

    const source = new InMemoryRollingProjectionSource(
      fixed.planVersion,
      fixed.assumptionSnapshot,
      {
        id: "close-2026-07",
        close_month: 7,
        close_year: 2026,
      },
      [{ item_key: "bank_accounts", actual_value: 180000 }],
    );

    const rollingService = new RollingProjectionService(versioning as never, salary, fixedService, source);
    const preview = await rollingService.createRollingProjectionPreview({});

    expect(preview.assumptions.netSalaryIncludesEmployeeDeductions).toBe(false);

    const payload = preview.assumptionSnapshotInput.assumption_payload as {
      netSalaryIncludesEmployeeDeductions?: boolean;
    };
    expect(payload.netSalaryIncludesEmployeeDeductions).toBe(false);
  });

  it("keeps retirement split parity metadata in preview rows", async () => {
    const versioning = new InMemoryProjectionVersioningService();
    const salary = new SalaryProjectionService();
    const fixedService = new FixedProjectionService(versioning as never, salary);

    const fixed = await fixedService.createFixedProjectionV1(
      buildFixedInput({
        horizonEndMonth: "2026-12",
        assumptions: {
          ...buildFixedInput().assumptions,
          salary: {
            ...buildFixedInput().assumptions.salary,
            retirementMonth: "2026-09",
          },
        },
      }),
    );

    const source = new InMemoryRollingProjectionSource(
      fixed.planVersion,
      fixed.assumptionSnapshot,
      {
        id: "close-2026-07",
        close_month: 7,
        close_year: 2026,
      },
      [
        { item_key: "bank_accounts", actual_value: 150000 },
        { item_key: "nps", actual_value: 300000 },
      ],
    );

    const rollingService = new RollingProjectionService(versioning as never, salary, fixedService, source);
    const preview = await rollingService.createRollingProjectionPreview({});

    const retirementNpsRow = preview.monthlyPositionRows.find(
      (row) => row.month_key === "2026-10" && row.bucket_key === "nps",
    );

    expect(retirementNpsRow).toBeDefined();
    const metadata = (retirementNpsRow?.metadata ?? {}) as { npsSplitApplied?: boolean; npsLumpSumPercent?: number; npsAnnuityPercent?: number };
    expect(metadata.npsSplitApplied).toBe(true);
    expect(metadata.npsLumpSumPercent).toBe(50);
    expect(metadata.npsAnnuityPercent).toBe(50);
  });
});
