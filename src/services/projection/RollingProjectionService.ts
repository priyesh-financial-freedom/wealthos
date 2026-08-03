import { supabase } from "@/lib/supabase/client";

import {
  FixedProjectionService,
  type FixedProjectionAssumptions,
  type FixedProjectionBucketKey,
  type FixedProjectionNpsSplitPolicy,
  type FixedProjectionOpeningBalances,
  resolvePostRetirementExpenseReductionPercent,
} from "./FixedProjectionService";
import { SalaryProjectionService } from "./SalaryProjectionService";
import { ProjectionVersioningService } from "./versioning/ProjectionVersioningService";
import type {
  ProjectionAssumptionSnapshotRecord,
  ProjectionMonthlyPositionRecord,
  ProjectionPlanVersionRecord,
  ProjectionRebaseJournalRecord,
  ProjectionSalaryCurveRecord,
} from "./versioning/types";

const DEFAULT_EVENT_DRAWDOWN_ORDER: FixedProjectionBucketKey[] = ["cash", "mutual_funds", "ppf", "epf"];

interface MonthStamp {
  year: number;
  month: number;
}

export interface RollingProjectionClose {
  id: string;
  close_month: number;
  close_year: number;
}

export interface RollingProjectionCloseItem {
  item_key: string;
  actual_value: number | string;
}

export interface RollingProjectionSource {
  getLatestClosedMonthEnd(): Promise<RollingProjectionClose | null>;
  getLatestLockedFixedPlan(householdId?: string | null): Promise<ProjectionPlanVersionRecord | null>;
  getAssumptionSnapshotByPlanVersionId(planVersionId: string): Promise<ProjectionAssumptionSnapshotRecord | null>;
  getMonthEndCloseItems(closeId: string): Promise<RollingProjectionCloseItem[]>;
}

export interface CreateRollingProjectionV1Input {
  householdId?: string | null;
  versionNo: number;
  assumptions?: FixedProjectionAssumptions;
  priorRollingVersionId?: string | null;
}

export interface CreateRollingProjectionV1Result {
  planVersion: ProjectionPlanVersionRecord;
  assumptionSnapshot: ProjectionAssumptionSnapshotRecord;
  salaryCurve: ProjectionSalaryCurveRecord[];
  monthlyPositions: ProjectionMonthlyPositionRecord[];
  rebaseJournal: ProjectionRebaseJournalRecord;
}

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

async function requireAuthenticatedUser() {
  const client = assertSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication required.");
  }

  return { client, user };
}

function parseMonthKey(monthKey: string): MonthStamp {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

function formatMonthKey(input: MonthStamp): string {
  return `${input.year}-${String(input.month).padStart(2, "0")}`;
}

function compareMonth(left: MonthStamp, right: MonthStamp): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return left.month - right.month;
}

function addMonth(input: MonthStamp): MonthStamp {
  if (input.month === 12) {
    return { year: input.year + 1, month: 1 };
  }

  return { year: input.year, month: input.month + 1 };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ensureNpsSplitIsValid(policy: FixedProjectionNpsSplitPolicy): void {
  const total = roundCurrency(policy.lumpsumPercent + policy.annuityPercent);
  if (total !== 100) {
    throw new Error("NPS split policy is invalid: lumpsumPercent + annuityPercent must equal 100.");
  }
}

function asNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function readAssumptionsFromSnapshot(snapshot: ProjectionAssumptionSnapshotRecord): FixedProjectionAssumptions {
  const payload = snapshot.assumption_payload as {
    salary?: FixedProjectionAssumptions["salary"];
    contributions?: FixedProjectionAssumptions["contributions"];
    returns?: FixedProjectionAssumptions["returns"];
    expenses?: FixedProjectionAssumptions["expenses"];
  };
  const retirementPolicy = snapshot.retirement_policy_payload as {
    npsSplitPolicy?: FixedProjectionNpsSplitPolicy;
    postRetirementExpenseReductionPercent?: number;
  };

  if (!payload.salary || !payload.contributions || !payload.returns || !payload.expenses) {
    throw new Error("Parent FIXED projection assumptions snapshot is incomplete.");
  }

  return {
    salary: payload.salary,
    contributions: payload.contributions,
    returns: payload.returns,
    expenses: {
      ...payload.expenses,
      postRetirementExpenseReductionPercent: resolvePostRetirementExpenseReductionPercent(
        retirementPolicy.postRetirementExpenseReductionPercent ?? payload.expenses.postRetirementExpenseReductionPercent,
      ),
    },
    npsSplitPolicy: retirementPolicy.npsSplitPolicy,
    eventDrawdownOrder: (snapshot.drawdown_policy_payload as { financialEventDrawdownOrder?: FixedProjectionBucketKey[] }).financialEventDrawdownOrder,
    liabilitiesMonthlyRepayment: Number((payload as { liabilitiesMonthlyRepayment?: number }).liabilitiesMonthlyRepayment ?? 0),
  };
}

function openingBalancesFromCloseItems(items: RollingProjectionCloseItem[]): FixedProjectionOpeningBalances {
  const keyed = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.item_key] = asNumber(item.actual_value);
    return acc;
  }, {});

  const liabilities =
    asNumber(keyed.home_loans) +
    asNumber(keyed.car_loans) +
    asNumber(keyed.other_liabilities) +
    asNumber(keyed.personal_loans) +
    asNumber(keyed.education_loans) +
    asNumber(keyed.credit_cards) +
    asNumber(keyed.bank_overdraft) +
    asNumber(keyed.loan_against_property) +
    asNumber(keyed.gold_loans);

  return {
    cash: asNumber(keyed.bank_accounts),
    mutualFunds: asNumber(keyed.mutual_funds),
    stocks: asNumber(keyed.stocks),
    epf: asNumber(keyed.epf),
    ppf: asNumber(keyed.ppf),
    nps: asNumber(keyed.nps),
    property: asNumber(keyed.real_estate),
    gold: asNumber(keyed.gold) + asNumber(keyed.silver),
    otherNonFinancialAssets: asNumber(keyed.other_assets),
    liabilities: liabilities,
  };
}

class SupabaseRollingProjectionSource implements RollingProjectionSource {
  async getLatestClosedMonthEnd(): Promise<RollingProjectionClose | null> {
    const { client, user } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("month_end_closes")
      .select("id, close_month, close_year")
      .eq("user_id", user.id)
      .eq("status", "closed")
      .order("close_year", { ascending: false })
      .order("close_month", { ascending: false })
      .order("version_number", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return (data?.[0] as RollingProjectionClose | undefined) ?? null;
  }

  async getLatestLockedFixedPlan(householdId?: string | null): Promise<ProjectionPlanVersionRecord | null> {
    const { client, user } = await requireAuthenticatedUser();
    let query = client
      .from("projection_plan_versions")
      .select("*")
      .eq("user_id", user.id)
      .eq("plan_kind", "FIXED")
      .eq("status", "LOCKED")
      .order("version_no", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (householdId == null) {
      query = query.is("household_id", null);
    } else {
      query = query.eq("household_id", householdId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return (data?.[0] as ProjectionPlanVersionRecord | undefined) ?? null;
  }

  async getAssumptionSnapshotByPlanVersionId(planVersionId: string): Promise<ProjectionAssumptionSnapshotRecord | null> {
    const { client } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("projection_assumption_snapshots")
      .select("*")
      .eq("projection_plan_version_id", planVersionId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data as ProjectionAssumptionSnapshotRecord | null) ?? null;
  }

  async getMonthEndCloseItems(closeId: string): Promise<RollingProjectionCloseItem[]> {
    const { client } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("month_end_close_items")
      .select("item_key, actual_value")
      .eq("close_id", closeId);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as RollingProjectionCloseItem[];
  }
}

export class RollingProjectionService {
  constructor(
    private readonly versioningService = new ProjectionVersioningService(),
    private readonly salaryProjectionService = new SalaryProjectionService(),
    private readonly fixedProjectionService = new FixedProjectionService(versioningService, salaryProjectionService),
    private readonly source: RollingProjectionSource = new SupabaseRollingProjectionSource(),
  ) {}

  async createRollingProjectionV1(input: CreateRollingProjectionV1Input): Promise<CreateRollingProjectionV1Result> {
    const parentFixedPlan = await this.source.getLatestLockedFixedPlan(input.householdId ?? null);
    if (!parentFixedPlan) {
      throw new Error("A LOCKED FIXED projection plan is required before creating a ROLLING projection.");
    }

    const latestClosedMonth = await this.source.getLatestClosedMonthEnd();
    if (!latestClosedMonth) {
      throw new Error("At least one CLOSED month-end close is required for rolling projection rebasing.");
    }

    const rebasedFromMonth = formatMonthKey({ year: latestClosedMonth.close_year, month: latestClosedMonth.close_month });
    const startMonth = formatMonthKey(addMonth({ year: latestClosedMonth.close_year, month: latestClosedMonth.close_month }));
    const horizonEndMonth = parentFixedPlan.horizon_end_month;

    if (compareMonth(parseMonthKey(startMonth), parseMonthKey(horizonEndMonth)) > 0) {
      throw new Error("Rolling projection start month must be on or before the fixed projection horizon end month.");
    }

    const snapshot = await this.source.getAssumptionSnapshotByPlanVersionId(parentFixedPlan.id);
    const assumptions = input.assumptions ?? (snapshot ? readAssumptionsFromSnapshot(snapshot) : null);
    if (!assumptions) {
      throw new Error("Rolling projection assumptions are required when parent fixed assumptions are unavailable.");
    }

    const npsSplitPolicy: FixedProjectionNpsSplitPolicy = assumptions.npsSplitPolicy ?? {
      lumpsumPercent: 50,
      annuityPercent: 50,
    };
    ensureNpsSplitIsValid(npsSplitPolicy);

    const postRetirementExpenseReductionPercent = resolvePostRetirementExpenseReductionPercent(
      assumptions.expenses.postRetirementExpenseReductionPercent,
    );

    const eventDrawdownOrder = assumptions.eventDrawdownOrder ?? DEFAULT_EVENT_DRAWDOWN_ORDER;

    const closeItems = await this.source.getMonthEndCloseItems(latestClosedMonth.id);
    const openingBalances = openingBalancesFromCloseItems(closeItems);

    const planVersion = await this.versioningService.createPlanVersion({
      household_id: input.householdId ?? null,
      plan_kind: "ROLLING",
      version_no: input.versionNo,
      status: "LOCKED",
      start_month: startMonth,
      horizon_end_month: horizonEndMonth,
      base_close_id: latestClosedMonth.id,
      parent_fixed_version_id: parentFixedPlan.id,
      locked_at: new Date().toISOString(),
    });

    const assumptionSnapshot = await this.versioningService.upsertAssumptionSnapshot({
      projection_plan_version_id: planVersion.id,
      assumption_payload: {
        startMonth,
        horizonEndMonth,
        openingBalances,
        salary: assumptions.salary,
        contributions: assumptions.contributions,
        returns: assumptions.returns,
        expenses: {
          ...assumptions.expenses,
          postRetirementExpenseReductionPercent,
        },
      },
      salary_policy_payload: {
        source: "COMMON_SALARY_CURVE",
        annualIncrementPercent: assumptions.salary.annualIncrementPercent,
        incrementMonth: assumptions.salary.incrementMonth ?? null,
      },
      retirement_policy_payload: {
        npsSplitPolicy,
        postRetirementExpenseReductionPercent,
        epfAnnualCreditMonth: "03",
        ppfAnnualCreditMonth: "03",
        epfTransferToCashAfterRetirementYears: 3,
        todos: [
          "EPF annual interest crediting on 31 March is not implemented in Rolling Projection V1 and remains an explicit TODO.",
          "PPF annual interest crediting on 31 March is not implemented in Rolling Projection V1 and remains an explicit TODO.",
          "NPS annuity income stream execution is deferred, policy structure is persisted.",
        ],
      },
      drawdown_policy_payload: {
        financialEventDrawdownOrder: eventDrawdownOrder,
        propertyLiquidationAllowed: false,
        notes: "Property and other non-financial assets are excluded from drawdown in Rolling Projection V1.",
      },
    });

    const salaryCurveRows = this.salaryProjectionService.buildMonthlyCurve({
      startMonth,
      endMonth: horizonEndMonth,
      currentGrossSalary: assumptions.salary.currentGrossSalary,
      currentBasicSalary: assumptions.salary.currentBasicSalary,
      annualIncrementPercent: assumptions.salary.annualIncrementPercent,
      incrementMonth: assumptions.salary.incrementMonth,
      retirementMonth: assumptions.salary.retirementMonth,
      source: "ROLLING_REBASE",
    });

    const persistedSalaryCurve = await this.versioningService.upsertSalaryCurve(
      salaryCurveRows.map((row) => ({
        projection_plan_version_id: planVersion.id,
        month_key: row.month_key,
        gross_salary: row.gross_salary,
        basic_salary: row.basic_salary,
        salary_growth_rate_used: row.salary_growth_rate_used,
        source: row.source,
      })),
    );

    const monthlyPositions = this.fixedProjectionService.buildMonthlyPositionsV1({
      projectionPlanVersionId: planVersion.id,
      startMonth,
      horizonEndMonth,
      salaryCurve: salaryCurveRows,
      openingBalances,
      assumptions,
      postRetirementExpenseReductionPercent,
      eventDrawdownOrder,
      npsSplitPolicy,
    });

    const persistedMonthlyPositions = await this.versioningService.upsertMonthlyPositions(monthlyPositions);

    const rebaseJournal = await this.versioningService.appendRebaseJournal({
      rolling_version_id: planVersion.id,
      parent_fixed_version_id: parentFixedPlan.id,
      rebased_from_close_id: latestClosedMonth.id,
      rebased_month: rebasedFromMonth,
      prior_rolling_version_id: input.priorRollingVersionId ?? null,
    });

    return {
      planVersion,
      assumptionSnapshot,
      salaryCurve: persistedSalaryCurve,
      monthlyPositions: persistedMonthlyPositions,
      rebaseJournal,
    };
  }
}

export const rollingProjectionService = new RollingProjectionService();
