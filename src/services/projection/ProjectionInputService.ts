import { supabase } from "@/lib/supabase/client";
import { getAccounts } from "@/services/accounts";
import { assumptionsService, DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
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
import { planningAssumptionService } from "@/services/planning/assumptions";
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
  ProjectionEntity,
  ProjectionEntityType,
  ProjectionMonthState,
  ProjectionOpeningSource,
  ProjectionStartSource,
} from "@/services/projection/ProjectionContext";
import { cloneProjectionState, createMonthlyLedgerRecord } from "@/services/projection/ProjectionContext";
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

interface LoadedProjectionData {
  assets: Asset[];
  liabilities: Liability[];
  bankAccounts: Awaited<ReturnType<typeof getBankAccounts>>;
  investments: Investment[];
  realEstate: RealEstateProperty[];
  retirementAccounts: RetirementAccount[];
  fixedDeposits: FixedDeposit[];
  goldHoldings: GoldHolding[];
  silverHoldings: SilverHolding[];
  insuranceAccounts: Account[];
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

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function createProjectionEntity(params: {
  id: string;
  entityType: ProjectionEntityType;
  name: string;
  openingBalance: number;
  expectedAnnualReturn?: number;
  assumptionSource?: string;
}): ProjectionEntity {
  const openingBalance = Number(params.openingBalance ?? 0);
  return {
    id: params.id,
    entityType: params.entityType,
    name: params.name,
    openingBalance,
    scheduledContribution: 0,
    scheduledWithdrawal: 0,
    growth: 0,
    fees: 0,
    tax: 0,
    closingBalance: openingBalance,
    expectedAnnualReturn: params.expectedAnnualReturn,
    assumptionSource: params.assumptionSource,
  };
}

function coerceProjectionEntities(state: ProjectionMonthState): ProjectionEntity[] {
  if (state.projectionEntities && state.projectionEntities.length > 0) {
    return state.projectionEntities;
  }

  const entities: ProjectionEntity[] = [];
  if (Number(state.cash ?? 0) !== 0) {
    entities.push(createProjectionEntity({
      id: "entity:cash:aggregate",
      entityType: "Cash",
      name: "Cash",
      openingBalance: Number(state.cash ?? 0),
      assumptionSource: "manual-opening-balances",
    }));
  }

  if (Number(state.investments ?? 0) !== 0) {
    entities.push(createProjectionEntity({
      id: "entity:investments:aggregate",
      entityType: "OtherInvestment",
      name: "Investments",
      openingBalance: Number(state.investments ?? 0),
      assumptionSource: "manual-opening-balances",
    }));
  }

  if (Number(state.assets ?? 0) !== 0) {
    entities.push(createProjectionEntity({
      id: "entity:real-estate:aggregate",
      entityType: "RealEstate",
      name: "Assets",
      openingBalance: Number(state.assets ?? 0),
      assumptionSource: "manual-opening-balances",
    }));
  }

  if (Number(state.retirementCorpus ?? 0) !== 0) {
    entities.push(createProjectionEntity({
      id: "entity:retirement:aggregate",
      entityType: "OtherInvestment",
      name: "Retirement Corpus",
      openingBalance: Number(state.retirementCorpus ?? 0),
      assumptionSource: "manual-opening-balances",
    }));
  }

  if (entities.length === 0) {
    entities.push(createProjectionEntity({
      id: "entity:investments:aggregate",
      entityType: "OtherInvestment",
      name: "Investments",
      openingBalance: 0,
      assumptionSource: "manual-opening-balances",
    }));
  }

  return entities;
}

function buildProjectionEntitiesFromCloseValues(values: Record<string, number>): ProjectionEntity[] {
  const entities: ProjectionEntity[] = [];

  const closeValueEntities: Array<{ id: string; entityType: ProjectionEntityType; name: string; openingBalance: number }> = [
    { id: "entity:cash:aggregate", entityType: "Cash", name: "Cash", openingBalance: Number(values.bank_accounts ?? 0) },
    { id: "entity:mutual-funds:aggregate", entityType: "MutualFund", name: "Mutual Funds", openingBalance: Number(values.mutual_funds ?? 0) },
    { id: "entity:stocks:aggregate", entityType: "Stock", name: "Stocks", openingBalance: Number(values.stocks ?? 0) },
    { id: "entity:fixed-deposits:aggregate", entityType: "FixedDeposit", name: "Fixed Deposits", openingBalance: Number(values.fixed_deposits ?? 0) },
    { id: "entity:gold:aggregate", entityType: "Gold", name: "Gold", openingBalance: Number(values.gold ?? 0) },
    { id: "entity:silver:aggregate", entityType: "Silver", name: "Silver", openingBalance: Number(values.silver ?? 0) },
    { id: "entity:epf:aggregate", entityType: "EPF", name: "EPF", openingBalance: Number(values.epf ?? 0) },
    { id: "entity:ppf:aggregate", entityType: "PPF", name: "PPF", openingBalance: Number(values.ppf ?? 0) },
    { id: "entity:nps:aggregate", entityType: "NPS", name: "NPS", openingBalance: Number(values.nps ?? 0) },
    { id: "entity:real-estate:aggregate", entityType: "RealEstate", name: "Real Estate", openingBalance: Number(values.real_estate ?? 0) },
  ];

  for (const item of closeValueEntities) {
    if (item.openingBalance === 0) {
      continue;
    }

    entities.push(createProjectionEntity({
      ...item,
      assumptionSource: "month-end-close",
    }));
  }

  if (entities.length === 0) {
    entities.push(createProjectionEntity({
      id: "entity:investments:aggregate",
      entityType: "OtherInvestment",
      name: "Investments",
      openingBalance: 0,
      assumptionSource: "month-end-close",
    }));
  }

  return entities;
}

function mapInvestmentCategoryToEntityType(category: string): ProjectionEntityType {
  const normalized = category.trim().toUpperCase();
  if (normalized === "MUTUAL FUNDS") {
    return "MutualFund";
  }
  if (normalized === "STOCKS" || normalized === "ETFS") {
    return "Stock";
  }
  if (normalized === "PPF") {
    return "PPF";
  }
  if (normalized === "EPF") {
    return "EPF";
  }
  if (normalized === "NPS") {
    return "NPS";
  }
  if (normalized === "FIXED DEPOSITS") {
    return "FixedDeposit";
  }
  if (normalized === "GOLD" || normalized === "SOVEREIGN GOLD BONDS") {
    return "Gold";
  }
  if (normalized === "SILVER") {
    return "Silver";
  }
  if (normalized === "BONDS") {
    return "Bond";
  }
  if (normalized === "CASH EQUIVALENTS") {
    return "Cash";
  }

  return "OtherInvestment";
}

function buildProjectionEntitiesFromLiveData(data: LoadedProjectionData): ProjectionEntity[] {
  const entities: ProjectionEntity[] = [];

  for (const account of data.bankAccounts.filter((item) => item.status !== "closed")) {
    entities.push(createProjectionEntity({
      id: `entity:cash:${account.id}`,
      entityType: "Cash",
      name: `${account.bank} ${account.account_name}`,
      openingBalance: Number(account.current_balance ?? 0),
      expectedAnnualReturn: Number(account.interest_rate ?? 0),
      assumptionSource: "bank-account",
    }));
  }

  for (const asset of data.assets.filter((item) => ["cash", "checking", "savings"].includes(item.asset_type))) {
    entities.push(createProjectionEntity({
      id: `entity:cash-asset:${asset.id}`,
      entityType: "Cash",
      name: asset.asset_name,
      openingBalance: Number(asset.current_value ?? 0),
      assumptionSource: "asset-cash",
    }));
  }

  for (const investment of data.investments) {
    entities.push(createProjectionEntity({
      id: `entity:investment:${investment.id}`,
      entityType: mapInvestmentCategoryToEntityType(investment.category),
      name: investment.investment_name,
      openingBalance: Number(investment.current_value ?? 0),
      assumptionSource: `investment:${investment.category}`,
    }));
  }

  for (const deposit of data.fixedDeposits) {
    entities.push(createProjectionEntity({
      id: `entity:fixed-deposit:${deposit.id}`,
      entityType: "FixedDeposit",
      name: `${deposit.institution} ${deposit.account_number}`,
      openingBalance: Number(deposit.current_value ?? 0),
      expectedAnnualReturn: Number(deposit.interest_rate ?? 0),
      assumptionSource: "fixed-deposit",
    }));
  }

  for (const retirement of data.retirementAccounts) {
    entities.push(createProjectionEntity({
      id: `entity:retirement:${retirement.id}`,
      entityType: retirement.account_type,
      name: `${retirement.account_type} ${retirement.institution}`,
      openingBalance: Number(retirement.current_balance ?? 0),
      expectedAnnualReturn: Number(retirement.interest_rate ?? 0),
      assumptionSource: `retirement:${retirement.account_type}`,
    }));
  }

  for (const gold of data.goldHoldings) {
    entities.push(createProjectionEntity({
      id: `entity:gold:${gold.id}`,
      entityType: "Gold",
      name: gold.description,
      openingBalance: Number(gold.current_value ?? 0),
      assumptionSource: "gold-holding",
    }));
  }

  for (const silver of data.silverHoldings) {
    entities.push(createProjectionEntity({
      id: `entity:silver:${silver.id}`,
      entityType: "Silver",
      name: silver.description,
      openingBalance: Number(silver.current_value ?? 0),
      assumptionSource: "silver-holding",
    }));
  }

  for (const property of data.realEstate) {
    entities.push(createProjectionEntity({
      id: `entity:real-estate:${property.id}`,
      entityType: "RealEstate",
      name: property.property_name,
      openingBalance: Number(property.current_market_value ?? 0),
      assumptionSource: "real-estate",
    }));
  }

  if (entities.length === 0) {
    entities.push(createProjectionEntity({
      id: "entity:investments:aggregate",
      entityType: "OtherInvestment",
      name: "Investments",
      openingBalance: 0,
      assumptionSource: "live-balance-sheet",
    }));
  }

  return entities;
}

function sumInvestmentCategories(investments: Investment[], categories: ReadonlySet<string>): number {
  return investments
    .filter((investment) => categories.has(investment.category))
    .reduce((sum, investment) => sum + Number(investment.current_value ?? 0), 0);
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

function buildTaxProfileFromAssumptions(assumptions: Awaited<ReturnType<typeof assumptionsService.getAssumptionsBundle>>): ProjectionTaxProfile {
  return {
    regime: assumptions.tax.regime,
    effectiveTaxRate: Number(assumptions.tax.effectiveTaxRate ?? 0),
    surchargeRate: Number(assumptions.tax.surchargeRate ?? 0),
    cessRate: Number(assumptions.tax.cessRate ?? 0),
    note: assumptions.tax.note,
  };
}

function buildOpeningStateFromCloseValues(values: Record<string, number>): ProjectionMonthState {
  const investments =
    Number(values.mutual_funds ?? 0) +
    Number(values.stocks ?? 0) +
    Number(values.gold ?? 0) +
    Number(values.silver ?? 0) +
    Number(values.fixed_deposits ?? 0);

  return {
    cash: Number(values.bank_accounts ?? 0),
    investments,
    assets: Number(values.real_estate ?? 0) + Number(values.other_assets ?? 0),
    liabilities:
      Number(values.home_loans ?? 0) +
      Number(values.car_loans ?? 0) +
      Number(values.other_liabilities ?? 0),
    retirementCorpus: Number(values.epf ?? 0) + Number(values.ppf ?? 0) + Number(values.nps ?? 0),
    projectionEntities: buildProjectionEntitiesFromCloseValues(values),
  };
}

function buildOpeningStateFromLiveData(data: LoadedProjectionData): ProjectionMonthState {
  const liquidAssetCash = data.assets.reduce((sum, asset) => {
    return sum + (["cash", "checking", "savings"].includes(asset.asset_type) ? Number(asset.current_value ?? 0) : 0);
  }, 0);

  const investmentAssets = data.assets.reduce((sum, asset) => {
    return sum + (asset.asset_type === "investment" ? Number(asset.current_value ?? 0) : 0);
  }, 0);

  const legacyRealEstate = data.assets.reduce((sum, asset) => {
    return sum + (asset.asset_type === "real_estate" ? Number(asset.current_value ?? 0) : 0);
  }, 0);

  const nonInvestmentAssets = data.assets.reduce((sum, asset) => {
    return sum + (["vehicle", "business", "other"].includes(asset.asset_type) ? Number(asset.current_value ?? 0) : 0);
  }, 0);

  const bankCash = data.bankAccounts
    .filter((account) => account.status !== "closed")
    .reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0);

  const dedicatedRealEstate = data.realEstate.reduce((sum, property) => sum + Number(property.current_market_value ?? 0), 0);
  const retirementFromInvestments = sumInvestmentCategories(data.investments, new Set(["EPF", "PPF", "NPS"]));
  const coreInvestments = data.investments.reduce((sum, investment) => {
    if (["EPF", "PPF", "NPS"].includes(investment.category)) {
      return sum;
    }

    return sum + Number(investment.current_value ?? 0);
  }, 0);

  const retirementAccounts = data.retirementAccounts.reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0);
  const fixedDeposits = data.fixedDeposits.reduce((sum, deposit) => sum + Number(deposit.current_value ?? 0), 0);
  const gold = data.goldHoldings.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
  const silver = data.silverHoldings.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
  const liabilities = data.liabilities.reduce((sum, liability) => sum + Number(liability.outstanding_amount ?? 0), 0);
  const totalInvestments = investmentAssets + coreInvestments + fixedDeposits + gold + silver;

  return {
    cash: liquidAssetCash + bankCash,
    investments: totalInvestments,
    assets: nonInvestmentAssets + (dedicatedRealEstate > 0 ? dedicatedRealEstate : legacyRealEstate),
    liabilities,
    retirementCorpus: retirementAccounts + retirementFromInvestments,
    projectionEntities: buildProjectionEntitiesFromLiveData(data),
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
    acc[row.item_key] = toNumber(row.actual_value);
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
    state: buildOpeningStateFromCloseValues(values),
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
    acc[row.item_key] = toNumber(row.actual_value);
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
    state: buildOpeningStateFromCloseValues(values),
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
      const manualState = cloneProjectionState(params.startSource.balances);
      manualState.projectionEntities = coerceProjectionEntities(manualState);
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
          openingState: buildOpeningStateFromLiveData(params.loadedData),
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
      openingState: buildOpeningStateFromLiveData(params.loadedData),
      effectiveStartMonth: params.requestedStartMonth,
      openingSource: { kind: "live-balance-sheet", asOfMonth: params.requestedStartMonth },
    };
  }

  async buildContext(options: ProjectionInputOptions): Promise<ProjectionContext> {
    const assumptions = await assumptionsService.getAssumptionsBundle(options.scenario.id || DEFAULT_SCENARIO_KEY);
    const effectiveAssumptions = await assumptionsService.getEffectiveAssumptions({
      scenarioId: options.scenario.id === DEFAULT_SCENARIO_KEY ? null : options.scenario.id,
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
      taxes: buildTaxProfileFromAssumptions(assumptions),
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