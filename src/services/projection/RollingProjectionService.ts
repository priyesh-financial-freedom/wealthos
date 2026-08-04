import { supabase } from "@/lib/supabase/client";
import type { FinancialGoalWithProgress } from "@/types/financialGoal";
import type { FinancialEvent } from "@/types/projection";

import {
  FixedProjectionService,
  type FixedProjectionAssumptions,
  type FixedProjectionBucketKey,
  type FixedProjectionNpsSplitPolicy,
  type FixedProjectionOneTimeOutflow,
  type FixedProjectionOpeningBalances,
  resolveAnnualExpenseInflationPercent,
  resolvePostRetirementExpenseReductionPercent,
} from "./FixedProjectionService";
import { buildOneTimeOutflowsFromGoalsAndEvents } from "./FixedProjectionInputBuilder";
import { groupMonthlyPositionRows, groupMonthlyPositionSnapshots } from "./ProjectionReadModel";
import { SalaryProjectionService } from "./SalaryProjectionService";
import { ProjectionVersioningService } from "./versioning/ProjectionVersioningService";
import type {
  CreateProjectionAssumptionSnapshotInput,
  ProjectionAssumptionSnapshotRecord,
  ProjectionMonthlyPositionRecord,
  ProjectionPlanVersionRecord,
  ProjectionRebaseJournalRecord,
  ProjectionSalaryCurveRecord,
  UpsertProjectionMonthlyPositionInput,
  UpsertProjectionSalaryCurveInput,
} from "./versioning/types";
import type { ProjectionViewerMonthRow, ProjectionViewerMonthSnapshot } from "./ProjectionReadModel";

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
  getLatestRollingVersionNo(householdId?: string | null): Promise<number | null>;
  getAssumptionSnapshotByPlanVersionId(planVersionId: string): Promise<ProjectionAssumptionSnapshotRecord | null>;
  getMonthEndCloseItems(closeId: string): Promise<RollingProjectionCloseItem[]>;
  getGoals(): Promise<FinancialGoalWithProgress[]>;
  getProjectionEvents(): Promise<FinancialEvent[]>;
}

export interface CreateRollingProjectionV1Input {
  householdId?: string | null;
  versionNo?: number;
  assumptions?: FixedProjectionAssumptions;
  priorRollingVersionId?: string | null;
}

export interface RollingProjectionPreviewValidation {
  canFreeze: boolean;
  blockers: string[];
  warnings: string[];
}

export interface RollingProjectionPreviewResult {
  input: Required<CreateRollingProjectionV1Input>;
  linkedFixedPlanId: string;
  linkedFixedVersionNo: number;
  rebasedFromMonth: string;
  rebasedFromCloseId: string;
  startMonth: string;
  horizonEndMonth: string;
  openingBalances: FixedProjectionOpeningBalances;
  assumptions: FixedProjectionAssumptions;
  oneTimeOutflows: FixedProjectionOneTimeOutflow[];
  validation: RollingProjectionPreviewValidation;
  canFreeze: boolean;
  assumptionSnapshotInput: Omit<CreateProjectionAssumptionSnapshotInput, "projection_plan_version_id">;
  salaryCurveRows: Array<Omit<UpsertProjectionSalaryCurveInput, "projection_plan_version_id">>;
  monthlyPositionRows: Array<Omit<UpsertProjectionMonthlyPositionInput, "projection_plan_version_id">>;
  monthRows: ProjectionViewerMonthRow[];
  monthSnapshots: ProjectionViewerMonthSnapshot[];
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

function normalizeToMonthKey(value: string, fieldName: string): string {
  const trimmed = value.trim();
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (monthMatch) {
    return `${monthMatch[1]}-${monthMatch[2]}`;
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!dateMatch) {
    throw new Error(`Invalid ${fieldName} value: ${value}`);
  }

  return `${dateMatch[1]}-${dateMatch[2]}`;
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
    netSalaryIncludesEmployeeDeductions?: boolean;
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
    netSalaryIncludesEmployeeDeductions: payload.netSalaryIncludesEmployeeDeductions,
    eventDrawdownOrder: (snapshot.drawdown_policy_payload as { financialEventDrawdownOrder?: FixedProjectionBucketKey[] }).financialEventDrawdownOrder,
    liabilitiesMonthlyRepayment: Number((payload as { liabilitiesMonthlyRepayment?: number }).liabilitiesMonthlyRepayment ?? 0),
  };
}

function openingBalancesFromCloseItems(items: RollingProjectionCloseItem[]): FixedProjectionOpeningBalances {
  const keyed = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.item_key] = asNumber(acc[item.item_key]) + asNumber(item.actual_value);
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

    const row = (data?.[0] as ProjectionPlanVersionRecord | undefined) ?? null;
    if (!row) {
      return null;
    }

    return {
      ...row,
      start_month: normalizeToMonthKey(row.start_month, "start_month"),
      horizon_end_month: normalizeToMonthKey(row.horizon_end_month, "horizon_end_month"),
    };
  }

  async getLatestRollingVersionNo(householdId?: string | null): Promise<number | null> {
    const { client, user } = await requireAuthenticatedUser();
    let query = client
      .from("projection_plan_versions")
      .select("version_no")
      .eq("user_id", user.id)
      .eq("plan_kind", "ROLLING")
      .order("version_no", { ascending: false })
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

    const latest = data?.[0] as { version_no?: number } | undefined;
    return typeof latest?.version_no === "number" ? latest.version_no : null;
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

  async getGoals(): Promise<FinancialGoalWithProgress[]> {
    const { goalService } = await import("@/services/planning/goals/GoalService");
    return goalService.listGoals({ includeProgress: false });
  }

  async getProjectionEvents(): Promise<FinancialEvent[]> {
    const { projectionEventsService, DEFAULT_PROJECTION_SCENARIO_KEY } = await import("@/services/projection/events");
    return projectionEventsService.listEvents(DEFAULT_PROJECTION_SCENARIO_KEY);
  }
}

export class RollingProjectionService {
  constructor(
    private readonly versioningService = new ProjectionVersioningService(),
    private readonly salaryProjectionService = new SalaryProjectionService(),
    private readonly fixedProjectionService = new FixedProjectionService(versioningService, salaryProjectionService),
    private readonly source: RollingProjectionSource = new SupabaseRollingProjectionSource(),
  ) {}

  private async resolveNextRollingVersionNo(householdId?: string | null): Promise<number> {
    const latest = await this.source.getLatestRollingVersionNo(householdId ?? null);
    return (latest ?? 0) + 1;
  }

  async createRollingProjectionPreview(input: CreateRollingProjectionV1Input): Promise<RollingProjectionPreviewResult> {
    const parentFixedPlan = await this.source.getLatestLockedFixedPlan(input.householdId ?? null);
    if (!parentFixedPlan) {
      throw new Error("A locked Fixed Projection is required before generating Rolling Projection.");
    }

    const latestClosedMonth = await this.source.getLatestClosedMonthEnd();
    if (!latestClosedMonth) {
      throw new Error("Close a monthly review before generating Rolling Projection.");
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

    const versionNo = input.versionNo ?? await this.resolveNextRollingVersionNo(input.householdId ?? null);

    const npsSplitPolicy: FixedProjectionNpsSplitPolicy = assumptions.npsSplitPolicy ?? {
      lumpsumPercent: 50,
      annuityPercent: 50,
    };
    ensureNpsSplitIsValid(npsSplitPolicy);

    const postRetirementExpenseReductionPercent = resolvePostRetirementExpenseReductionPercent(
      assumptions.expenses.postRetirementExpenseReductionPercent,
    );
    const annualExpenseInflationPercent = resolveAnnualExpenseInflationPercent(
      assumptions.expenses.annualExpenseInflationPercent,
    );

    const eventDrawdownOrder = assumptions.eventDrawdownOrder ?? DEFAULT_EVENT_DRAWDOWN_ORDER;

    const closeItems = await this.source.getMonthEndCloseItems(latestClosedMonth.id);
    const openingBalances = openingBalancesFromCloseItems(closeItems);

    const warnings: string[] = [];
    let oneTimeOutflows: FixedProjectionOneTimeOutflow[] = [];

    try {
      const [goals, projectionEvents] = await Promise.all([
        this.source.getGoals(),
        this.source.getProjectionEvents(),
      ]);
      oneTimeOutflows = buildOneTimeOutflowsFromGoalsAndEvents(goals, projectionEvents);
      if (oneTimeOutflows.length === 0) {
        warnings.push("No active one-time goals/events available for Rolling Projection.");
      }
    } catch {
      warnings.push("One-time goals/events could not be loaded for Rolling Projection preview.");
    }

    const inputWithDefaults: Required<CreateRollingProjectionV1Input> = {
      householdId: input.householdId ?? null,
      versionNo,
      assumptions,
      priorRollingVersionId: input.priorRollingVersionId ?? null,
    };

    const assumptionSnapshotInput: Omit<CreateProjectionAssumptionSnapshotInput, "projection_plan_version_id"> = {
      assumption_payload: {
        startMonth,
        horizonEndMonth,
        openingBalances,
        salary: assumptions.salary,
        contributions: assumptions.contributions,
        returns: assumptions.returns,
        netSalaryIncludesEmployeeDeductions: assumptions.netSalaryIncludesEmployeeDeductions ?? true,
        liabilitiesMonthlyRepayment: assumptions.liabilitiesMonthlyRepayment ?? 0,
        expenses: {
          ...assumptions.expenses,
          postRetirementExpenseReductionPercent,
          annualExpenseInflationPercent,
        },
        oneTimeOutflows,
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
    };

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

    const salaryCurveUpsertRows: Array<Omit<UpsertProjectionSalaryCurveInput, "projection_plan_version_id">> = salaryCurveRows.map((row) => ({
      month_key: row.month_key,
      gross_salary: row.gross_salary,
      basic_salary: row.basic_salary,
      salary_growth_rate_used: row.salary_growth_rate_used,
      source: row.source,
    }));

    const monthlyPositions = this.fixedProjectionService.buildMonthlyPositionsV1({
      projectionPlanVersionId: "preview",
      startMonth,
      horizonEndMonth,
      salaryCurve: salaryCurveRows,
      openingBalances,
      assumptions,
      oneTimeOutflows,
      postRetirementExpenseReductionPercent,
      annualExpenseInflationPercent,
      eventDrawdownOrder,
      npsSplitPolicy,
    });

    const monthlyPositionRows: Array<Omit<UpsertProjectionMonthlyPositionInput, "projection_plan_version_id">> = monthlyPositions.map(
      ({ projection_plan_version_id: _projectionPlanVersionId, ...row }) => row,
    );

    const viewerRows = monthlyPositionRows.map((row) => ({
      month_key: row.month_key,
      bucket_key: row.bucket_key,
      closing_value: row.closing_value,
      metadata: row.metadata,
    }));

    return {
      input: inputWithDefaults,
      linkedFixedPlanId: parentFixedPlan.id,
      linkedFixedVersionNo: parentFixedPlan.version_no,
      rebasedFromMonth,
      rebasedFromCloseId: latestClosedMonth.id,
      startMonth,
      horizonEndMonth,
      openingBalances,
      assumptions,
      oneTimeOutflows,
      validation: {
        canFreeze: true,
        blockers: [],
        warnings,
      },
      canFreeze: true,
      assumptionSnapshotInput,
      salaryCurveRows: salaryCurveUpsertRows,
      monthlyPositionRows,
      monthRows: groupMonthlyPositionRows(viewerRows),
      monthSnapshots: groupMonthlyPositionSnapshots(viewerRows),
    };
  }

  async freezeRollingProjectionV1Preview(preview: RollingProjectionPreviewResult): Promise<CreateRollingProjectionV1Result> {
    const planVersion = await this.versioningService.createPlanVersion({
      household_id: preview.input.householdId,
      plan_kind: "ROLLING",
      version_no: preview.input.versionNo,
      status: "DRAFT",
      start_month: preview.startMonth,
      horizon_end_month: preview.horizonEndMonth,
      base_close_id: preview.rebasedFromCloseId,
      parent_fixed_version_id: preview.linkedFixedPlanId,
      locked_at: null,
    });

    const assumptionSnapshot = await this.versioningService.upsertAssumptionSnapshot({
      projection_plan_version_id: planVersion.id,
      ...preview.assumptionSnapshotInput,
    });

    const persistedSalaryCurve = await this.versioningService.upsertSalaryCurve(
      preview.salaryCurveRows.map((row) => ({
        projection_plan_version_id: planVersion.id,
        month_key: row.month_key,
        gross_salary: row.gross_salary,
        basic_salary: row.basic_salary,
        salary_growth_rate_used: row.salary_growth_rate_used,
        source: row.source,
      })),
    );

    const persistedMonthlyPositions = await this.versioningService.upsertMonthlyPositions(
      preview.monthlyPositionRows.map((row) => ({
        projection_plan_version_id: planVersion.id,
        month_key: row.month_key,
        bucket_key: row.bucket_key,
        opening_value: row.opening_value,
        contribution: row.contribution,
        growth: row.growth,
        withdrawal: row.withdrawal,
        closing_value: row.closing_value,
        metadata: row.metadata,
      })),
    );

    const rebaseJournal = await this.versioningService.appendRebaseJournal({
      rolling_version_id: planVersion.id,
      parent_fixed_version_id: preview.linkedFixedPlanId,
      rebased_from_close_id: preview.rebasedFromCloseId,
      rebased_month: preview.rebasedFromMonth,
      prior_rolling_version_id: preview.input.priorRollingVersionId,
    });

    const lockedPlanVersion = await this.versioningService.lockPlanVersion(planVersion.id);

    return {
      planVersion: lockedPlanVersion,
      assumptionSnapshot,
      salaryCurve: persistedSalaryCurve,
      monthlyPositions: persistedMonthlyPositions,
      rebaseJournal,
    };
  }

  async createRollingProjectionV1(input: CreateRollingProjectionV1Input): Promise<CreateRollingProjectionV1Result> {
    const preview = await this.createRollingProjectionPreview(input);
    return this.freezeRollingProjectionV1Preview(preview);
  }
}

export const rollingProjectionService = new RollingProjectionService();
