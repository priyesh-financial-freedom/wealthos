import { supabase } from "@/lib/supabase/client";
import { getAccounts } from "@/services/accounts";
import { assumptionsService, DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import { compensationService } from "@/services/compensation";
import { getAssets } from "@/services/assets";
import { getBankAccounts } from "@/services/bankAccounts";
import { getFixedDeposits } from "@/services/fixedDeposits";
import { getGoldHoldings } from "@/services/goldHoldings";
import { getInvestments } from "@/services/investments";
import { getLiabilities } from "@/services/liabilities";
import { goalService } from "@/services/planning/goals/GoalService";
import { projectionEventsService } from "@/services/projection/events";
import { getRealEstateProperties } from "@/services/realEstateProperties";
import { getRetirementAccounts } from "@/services/retirement";
import { getSilverHoldings } from "@/services/silverHoldings";
import { assumptionProvider, createHouseholdAssumptionProfile, planningAssumptionService } from "@/services/planning/assumptions";
import type { Account } from "@/types/account";
import type { Asset } from "@/types/asset";
import type { FixedDeposit } from "@/types/fixedDeposit";
import type { GoldHolding } from "@/types/goldHolding";
import type { Investment } from "@/types/investment";
import type { Liability } from "@/types/liability";
import type {
  FinancialEvent,
  ProjectionFamilyMember,
  ProjectionExpenseItem,
  ProjectionIncomeSource,
  ProjectionInsurancePolicy,
  ProjectionScenario,
  ProjectionTaxProfile,
} from "@/types/projection";
import type {
  ProjectionContext,
  ProjectionMonthState,
  ProjectionOpeningSource,
  ProjectionStartSource,
} from "@/services/projection/ProjectionContext";
import { cloneProjectionState, createMonthlyLedgerRecord } from "@/services/projection/ProjectionContext";
import { planningEntityAggregator, type LoadedProjectionData } from "@/services/projection/PlanningEntityAggregator";
import type { RealEstateProperty } from "@/types/realEstateProperty";
import type { RetirementAccount } from "@/types/retirementAccount";
import type { SilverHolding } from "@/types/silverHolding";

interface MonthEndCloseItemRow {
  item_key: string;
  actual_value: number | string;
}

interface MonthEndCloseRow {
  id: string;
  close_month: number;
  close_year: number;
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

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths(year: number, month: number, offset = 1): { year: number; month: number } {
  const totalMonths = year * 12 + (month - 1) + offset;

  return {
    year: Math.floor(totalMonths / 12),
    month: (totalMonths % 12) + 1,
  };
}

function compareMonth(left: { year: number; month: number }, right: { year: number; month: number }) {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return left.month - right.month;
}

function buildInsurancePolicies(accounts: Account[]): ProjectionInsurancePolicy[] {
  return accounts
    .filter((account) => account.category === "Insurance")
    .map((account) => ({
      id: account.id,
      name: account.name,
      owner: account.owner,
      monthlyPremium: 0,
      annualPremium: 0,
      coverageAmount: Number(account.current_value ?? 0),
    }));
}

function buildEmptyIncomeSources(): ProjectionIncomeSource[] {
  return [];
}

function buildEmptyExpenses(): ProjectionExpenseItem[] {
  return [];
}

function buildFamilyMembersFromProfile(profile: Awaited<ReturnType<typeof planningAssumptionService.getFamilyProfile>>): ProjectionFamilyMember[] {
  const members: ProjectionFamilyMember[] = [];

  members.push({
    id: "primary",
    name: "Primary",
    relationship: "self",
    birthDate: profile.primaryDateOfBirth,
    currentAge: profile.primaryCurrentAge,
    isDependent: false,
  });

  if (profile.spouseDateOfBirth) {
    members.push({
      id: "spouse",
      name: "Spouse",
      relationship: "spouse",
      birthDate: profile.spouseDateOfBirth,
      currentAge: profile.spouseCurrentAge,
      isDependent: false,
    });
  }

  return members;
}

function calculateAgeFromDateOfBirth(dateOfBirth: string | null, today: Date): number | null {
  if (!dateOfBirth) {
    return null;
  }

  const parsed = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  let age = today.getUTCFullYear() - parsed.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - parsed.getUTCMonth();
  const dayDiff = today.getUTCDate() - parsed.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return Math.max(0, age);
}

function buildTaxProfileFromAssumptions(
  resolvedTaxAssumptions: Awaited<ReturnType<typeof assumptionProvider.resolve>>,
): ProjectionTaxProfile {
  const legacyTax = resolvedTaxAssumptions.legacyBundle.tax;

  return {
    regime: legacyTax?.regime ?? "new",
    effectiveTaxRate: Number(resolvedTaxAssumptions.resolvedProfile.values.incomeTaxRate ?? legacyTax.effectiveTaxRate ?? 0),
    surchargeRate: Number(legacyTax.surchargeRate ?? 0),
    cessRate: Number(legacyTax.cessRate ?? 0),
    note: legacyTax.note,
  };
}

async function getLatestClosedMonthEndSeed(): Promise<{ source: ProjectionOpeningSource; nextStartMonth: string; state: ProjectionMonthState } | null> {
  const { client, user } = await requireAuthenticatedUser();
  const closeResult = await client
    .from("month_end_closes")
    .select("id, close_month, close_year")
    .eq("user_id", user.id)
    .eq("status", "closed")
    .order("close_year", { ascending: false })
    .order("close_month", { ascending: false })
    .order("version_number", { ascending: false })
    .limit(1);

  if (closeResult.error) {
    throw new Error(closeResult.error.message);
  }

  const closeRow = (closeResult.data?.[0] ?? null) as MonthEndCloseRow | null;
  if (!closeRow) {
    return null;
  }

  const itemResult = await client
    .from("month_end_close_items")
    .select("item_key, actual_value")
    .eq("close_id", closeRow.id);

  if (itemResult.error) {
    throw new Error(itemResult.error.message);
  }

  const values = ((itemResult.data ?? []) as MonthEndCloseItemRow[]).reduce<Record<string, number>>((acc, row) => {
    acc[row.item_key] = Number(row.actual_value ?? 0);
    return acc;
  }, {});

  const nextMonth = addMonths(closeRow.close_year, closeRow.close_month);

  return {
    source: {
      kind: "month-end-close",
      asOfMonth: formatMonthKey(closeRow.close_year, closeRow.close_month),
      closeId: closeRow.id,
    },
    nextStartMonth: formatMonthKey(nextMonth.year, nextMonth.month),
    state: planningEntityAggregator.aggregateFromMonthEndClose(values),
  };
}

async function getClosedMonthEndSeedByCloseId(closeId: string): Promise<{ source: ProjectionOpeningSource; nextStartMonth: string; state: ProjectionMonthState } | null> {
  const { client, user } = await requireAuthenticatedUser();
  const closeResult = await client
    .from("month_end_closes")
    .select("id, close_month, close_year")
    .eq("user_id", user.id)
    .eq("id", closeId)
    .eq("status", "closed")
    .limit(1);

  if (closeResult.error) {
    throw new Error(closeResult.error.message);
  }

  const closeRow = (closeResult.data?.[0] ?? null) as MonthEndCloseRow | null;
  if (!closeRow) {
    return null;
  }

  const itemResult = await client
    .from("month_end_close_items")
    .select("item_key, actual_value")
    .eq("close_id", closeRow.id);

  if (itemResult.error) {
    throw new Error(itemResult.error.message);
  }

  const values = ((itemResult.data ?? []) as MonthEndCloseItemRow[]).reduce<Record<string, number>>((acc, row) => {
    acc[row.item_key] = Number(row.actual_value ?? 0);
    return acc;
  }, {});

  const nextMonth = addMonths(closeRow.close_year, closeRow.close_month);

  return {
    source: {
      kind: "month-end-close",
      asOfMonth: formatMonthKey(closeRow.close_year, closeRow.close_month),
      closeId: closeRow.id,
    },
    nextStartMonth: formatMonthKey(nextMonth.year, nextMonth.month),
    state: planningEntityAggregator.aggregateFromMonthEndClose(values),
  };
}

function normalizeStartSource(startSource: ProjectionStartSource | undefined): ProjectionStartSource {
  return startSource ?? { kind: "live-balance-sheet" };
}

function coerceStartMonth(requestedStartMonth: string, seedStartMonth: string): string {
  const requestedStart = parseMonthKey(requestedStartMonth);
  const seededStart = parseMonthKey(seedStartMonth);
  const chosen = compareMonth(requestedStart, seededStart) > 0 ? requestedStart : seededStart;
  return formatMonthKey(chosen.year, chosen.month);
}

interface ProjectionSeedResolution {
  openingState: ProjectionMonthState;
  effectiveStartMonth: string;
  openingSource: ProjectionOpeningSource;
}

export interface ProjectionInputOptions {
  scenario: ProjectionScenario;
  currentDate?: Date;
  startSource?: ProjectionStartSource;
}

export class ProjectionInputService {
  private async resolveProjectionSeed(params: {
    startSource: ProjectionStartSource;
    requestedStartMonth: string;
    loadedData: LoadedProjectionData;
  }): Promise<ProjectionSeedResolution> {
    if (params.startSource.kind === "manual-opening-balances") {
      const effectiveStartMonth = params.startSource.startMonth || params.requestedStartMonth;
      const manualState = planningEntityAggregator.normalizeProjectionState(cloneProjectionState(params.startSource.balances));
      return {
        openingState: manualState,
        effectiveStartMonth,
        openingSource: {
          kind: "manual-opening-balances",
          asOfMonth: effectiveStartMonth,
        },
      };
    }

    if (params.startSource.kind === "latest-closed-month-end") {
      const closedSeed = await getLatestClosedMonthEndSeed();
      if (!closedSeed) {
        return {
          openingState: planningEntityAggregator.aggregateFromLiveData(params.loadedData),
          effectiveStartMonth: params.requestedStartMonth,
          openingSource: { kind: "live-balance-sheet", asOfMonth: params.requestedStartMonth },
        };
      }

      return {
        openingState: closedSeed.state,
        effectiveStartMonth: coerceStartMonth(params.requestedStartMonth, closedSeed.nextStartMonth),
        openingSource: closedSeed.source,
      };
    }

    if (params.startSource.kind === "specific-closed-month-end") {
      const closedSeed = await getClosedMonthEndSeedByCloseId(params.startSource.closeId);
      if (!closedSeed) {
        throw new Error("Selected closed month-end snapshot was not found.");
      }

      return {
        openingState: closedSeed.state,
        effectiveStartMonth: coerceStartMonth(params.requestedStartMonth, closedSeed.nextStartMonth),
        openingSource: closedSeed.source,
      };
    }

    return {
      openingState: planningEntityAggregator.aggregateFromLiveData(params.loadedData),
      effectiveStartMonth: params.requestedStartMonth,
      openingSource: { kind: "live-balance-sheet", asOfMonth: params.requestedStartMonth },
    };
  }

  async buildContext(options: ProjectionInputOptions): Promise<ProjectionContext> {
    const effectiveAssumptions = await assumptionsService.getEffectiveAssumptions({
      scenarioId: options.scenario.id === DEFAULT_SCENARIO_KEY ? null : options.scenario.id,
    });
    const assumptions = await compensationService.getCompensatedAssumptionsBundle(options.scenario.id || DEFAULT_SCENARIO_KEY);
    const resolvedAssumptions = assumptionProvider.resolve({
      householdProfile: createHouseholdAssumptionProfile({
        assumptions: {
          incomeTaxRate: effectiveAssumptions.incomeTaxRate,
        },
      }),
    });

    const [loadedData, goals, persistedEvents, familyProfile] = await Promise.all([
      this.loadRepositories(),
      goalService.listGoals({ includeProgress: false }),
      options.scenario.events.length > 0 ? Promise.resolve(options.scenario.events) : projectionEventsService.listEvents(options.scenario.id).catch(() => [] as FinancialEvent[]),
      planningAssumptionService.getFamilyProfile(),
    ]);

    const requestedStartMonth = options.scenario.startMonth || assumptions.planning.startMonth;
    const seed = await this.resolveProjectionSeed({
      startSource: normalizeStartSource(options.startSource),
      requestedStartMonth,
      loadedData,
    });

    const effectiveStartMonth = seed.effectiveStartMonth;
    const openingState = seed.openingState;
    const currentDate = options.currentDate ?? new Date();
    const ageOffsetMonths = (() => {
      const start = parseMonthKey(assumptions.planning.startMonth);
      const effective = parseMonthKey(effectiveStartMonth);
      return Math.max(0, (effective.year - start.year) * 12 + (effective.month - start.month));
    })();
    const canonicalCurrentAge = calculateAgeFromDateOfBirth(familyProfile.primaryDateOfBirth, currentDate);
    const startingAge = Number(canonicalCurrentAge ?? effectiveAssumptions.currentAge ?? 0) + ageOffsetMonths / 12;

    return {
      scenario: {
        ...options.scenario,
        startMonth: effectiveStartMonth,
        planningHorizonYear: Math.max(options.scenario.planningHorizonYear, assumptions.planning.endYear),
        events: persistedEvents,
      },
      assumptions,
      effectiveAssumptions,
      assets: loadedData.assets,
      liabilities: loadedData.liabilities,
      bankAccounts: loadedData.bankAccounts,
      investments: loadedData.investments,
      realEstate: loadedData.realEstate,
      retirementAccounts: loadedData.retirementAccounts,
      fixedDeposits: loadedData.fixedDeposits,
      goldHoldings: loadedData.goldHoldings,
      silverHoldings: loadedData.silverHoldings,
      insurancePolicies: buildInsurancePolicies(loadedData.insuranceAccounts),
      insuranceAccounts: loadedData.insuranceAccounts,
      incomeSources: buildEmptyIncomeSources(),
      expenses: buildEmptyExpenses(),
      goals,
      taxes: buildTaxProfileFromAssumptions(resolvedAssumptions),
      familyMembers: buildFamilyMembersFromProfile(familyProfile),
      planningHorizon: assumptions.planning,
      currentDate,
      projectionStartDate: effectiveStartMonth,
      currentMonth: effectiveStartMonth,
      monthIndex: 0,
      openingSource: seed.openingSource,
      financialEvents: persistedEvents,
      monthlyLedger: [],
      currentRecord: createMonthlyLedgerRecord(effectiveStartMonth, startingAge, openingState),
      currentState: cloneProjectionState(openingState),
    };
  }

  private async loadRepositories(): Promise<LoadedProjectionData> {
    const [assets, liabilities, bankAccounts, investments, realEstate, retirementAccounts, fixedDeposits, goldHoldings, silverHoldings, accounts] = await Promise.all([
      getAssets(),
      getLiabilities(),
      getBankAccounts().catch(() => []),
      getInvestments(),
      getRealEstateProperties().catch(() => []),
      getRetirementAccounts().catch(() => []),
      getFixedDeposits().catch(() => []),
      getGoldHoldings().catch(() => []),
      getSilverHoldings().catch(() => []),
      getAccounts().catch(() => []),
    ]);

    return {
      assets,
      liabilities,
      bankAccounts,
      investments,
      realEstate,
      retirementAccounts,
      fixedDeposits,
      goldHoldings,
      silverHoldings,
      insuranceAccounts: accounts,
    };
  }
}

export const projectionInputService = new ProjectionInputService();