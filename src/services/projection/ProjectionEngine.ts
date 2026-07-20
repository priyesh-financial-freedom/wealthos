import { getBalanceSheetData } from "@/services/balanceSheet";
import { assumptionsService, DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import { contributionProcessor, buildContributionEventsFromAssumptions } from "@/services/projection/ContributionProcessor";
import { growthProcessor, buildGrowthEventsFromAssumptions } from "@/services/projection/GrowthProcessor";
import { projectionEventsService } from "@/services/projection/events";
import { projectionEventEngine } from "@/services/projection/EventEngine";
import { supabase } from "@/lib/supabase/client";
import type { AssumptionsBundle } from "@/types/assumptions";
import type { FinancialEvent, FinancialAssumption, MonthlySnapshot, ProjectedEntity, ProjectionBalanceDimensions, ProjectionBalanceState, ProjectionScenario } from "@/types/projection";

interface MonthEndCloseSeedItem {
  item_key: string;
  actual_value: number | string;
}

interface MonthEndCloseSeed {
  closeMonth: number;
  closeYear: number;
  values: Record<string, number>;
}

export interface ProjectionTimelinePoint {
  month: string;
  year: number;
}

export interface OpeningBalances {
  assets: number;
  liabilities: number;
  investments: number;
  retirement: number;
  cash: number;
  netWorth: number;
}

export interface ProjectionResult {
  scenario: ProjectionScenario;
  timeline: ProjectionTimelinePoint[];
  snapshots: MonthlySnapshot[];
}

export class ProjectionEngine {
  private projectedSnapshots: MonthlySnapshot[] = [];

  constructor(
    private readonly assumptions = assumptionsService,
    private readonly eventEngine = projectionEventEngine,
    private readonly eventsService = projectionEventsService,
  ) {
    this.eventEngine.unregisterProcessor(contributionProcessor.id);
    this.eventEngine.unregisterProcessor(growthProcessor.id);
    this.eventEngine.registerProcessor(contributionProcessor);
    this.eventEngine.registerProcessor(growthProcessor);
  }

  private parseMonthKey(monthKey: string): { year: number; month: number } {
    const [yearText, monthText] = monthKey.split("-");
    const year = Number(yearText);
    const month = Number(monthText);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(`Invalid month key: ${monthKey}`);
    }

    return { year, month };
  }

  private formatMonthKey(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  private addMonths(year: number, month: number, offset = 1): { year: number; month: number } {
    const totalMonths = year * 12 + (month - 1) + offset;

    return {
      year: Math.floor(totalMonths / 12),
      month: (totalMonths % 12) + 1,
    };
  }

  private compareMonth(left: { year: number; month: number }, right: { year: number; month: number }) {
    if (left.year !== right.year) {
      return left.year - right.year;
    }

    return left.month - right.month;
  }

  private async getLatestClosedMonthEndSeed(): Promise<MonthEndCloseSeed | null> {
    if (!supabase) {
      return null;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const closeResult = await supabase
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

    const closeRow = closeResult.data?.[0] as { id: string; close_month: number; close_year: number } | undefined;
    if (!closeRow) {
      return null;
    }

    const itemResult = await supabase
      .from("month_end_close_items")
      .select("item_key, actual_value")
      .eq("close_id", closeRow.id);

    if (itemResult.error) {
      throw new Error(itemResult.error.message);
    }

    const values = (itemResult.data ?? []).reduce<Record<string, number>>((acc, row) => {
      const item = row as MonthEndCloseSeedItem;
      acc[item.item_key] = Number(item.actual_value ?? 0);
      return acc;
    }, {});

    return {
      closeMonth: closeRow.close_month,
      closeYear: closeRow.close_year,
      values,
    };
  }

  private buildOpeningEntitiesFromValueMap(month: string, values: Record<string, number>): ProjectedEntity[] {
    return [
      this.createProjectedEntity("projected:bank-accounts", "bank-account", "Bank Accounts", month, Number(values.bank_accounts ?? 0), {
        assets: true,
        cash: true,
      }),
      this.createProjectedEntity("projected:mutual-funds", "mutual-fund", "Mutual Funds", month, Number(values.mutual_funds ?? 0), {
        investments: true,
      }),
      this.createProjectedEntity("projected:stocks", "stock", "Stocks", month, Number(values.stocks ?? 0), {
        investments: true,
      }),
      this.createProjectedEntity("projected:gold", "gold", "Gold", month, Number(values.gold ?? 0), {
        investments: true,
      }),
      this.createProjectedEntity("projected:silver", "silver", "Silver", month, Number(values.silver ?? 0), {
        investments: true,
      }),
      this.createProjectedEntity("projected:fixed-deposits", "fixed-deposit", "Fixed Deposits", month, Number(values.fixed_deposits ?? 0), {
        investments: true,
      }),
      this.createProjectedEntity("projected:epf", "epf", "EPF", month, Number(values.epf ?? 0), {
        investments: true,
        retirement: true,
      }),
      this.createProjectedEntity("projected:ppf", "ppf", "PPF", month, Number(values.ppf ?? 0), {
        investments: true,
        retirement: true,
      }),
      this.createProjectedEntity("projected:nps", "nps", "NPS", month, Number(values.nps ?? 0), {
        investments: true,
        retirement: true,
      }),
      this.createProjectedEntity("projected:real-estate", "real-estate", "Real Estate", month, Number(values.real_estate ?? 0), {
        assets: true,
      }),
      this.createProjectedEntity("projected:other-assets", "other-asset", "Other Assets", month, Number(values.other_assets ?? 0), {
        assets: true,
      }),
      this.createProjectedEntity("projected:home-loans", "home-loan", "Home Loans", month, Number(values.home_loans ?? 0), {
        liabilities: true,
      }),
      this.createProjectedEntity("projected:car-loans", "car-loan", "Car Loans", month, Number(values.car_loans ?? 0), {
        liabilities: true,
      }),
      this.createProjectedEntity("projected:other-liabilities", "other-liability", "Other Liabilities", month, Number(values.other_liabilities ?? 0), {
        liabilities: true,
      }),
    ];
  }

  private buildTimelineRange(startMonth: string, planningHorizonYear: number): ProjectionTimelinePoint[] {
    const start = this.parseMonthKey(startMonth);
    const end = { year: planningHorizonYear, month: 12 };

    if (this.compareMonth(start, end) > 0) {
      return [];
    }

    const timeline: ProjectionTimelinePoint[] = [];
    let cursor = start;

    while (this.compareMonth(cursor, end) <= 0) {
      timeline.push({
        month: this.formatMonthKey(cursor.year, cursor.month),
        year: cursor.year,
      });

      cursor = this.addMonths(cursor.year, cursor.month);
    }

    return timeline;
  }

  private entityDimensions(dimensions: Partial<ProjectionBalanceDimensions>): ProjectionBalanceDimensions {
    return {
      assets: Boolean(dimensions.assets),
      liabilities: Boolean(dimensions.liabilities),
      investments: Boolean(dimensions.investments),
      retirement: Boolean(dimensions.retirement),
      cash: Boolean(dimensions.cash),
    };
  }

  private createProjectedEntity(
    id: string,
    kind: ProjectedEntity["kind"],
    name: string,
    month: string,
    openingBalance: number,
    dimensions: Partial<ProjectionBalanceDimensions>,
  ): ProjectedEntity {
    return {
      id,
      kind,
      name,
      month,
      openingBalance,
      contributionActivity: 0,
      growthActivity: 0,
      otherActivity: 0,
      closingBalance: openingBalance,
      dimensions: this.entityDimensions(dimensions),
    };
  }

  private sumInvestmentsByCategory(events: Awaited<ReturnType<typeof getBalanceSheetData>>["investments"], categories: Set<string>): number {
    return events
      .filter((investment) => categories.has(investment.category))
      .reduce((sum, investment) => sum + Number(investment.current_value ?? 0), 0);
  }

  private buildProjectedEntitiesFromAggregate(month: string, openingBalances: OpeningBalances): ProjectedEntity[] {
    const cash = Number(openingBalances.cash ?? 0);
    const liabilities = Number(openingBalances.liabilities ?? 0);
    const retirement = Number(openingBalances.retirement ?? 0);
    const nonCashAssets = Math.max(0, Number(openingBalances.assets ?? 0) - cash);
    const remainingInvestments = Math.max(0, Number(openingBalances.investments ?? 0) - retirement);
    const mutualFunds = remainingInvestments / 2;
    const stocks = remainingInvestments / 2;

    return [
      this.createProjectedEntity("projected:bank-accounts", "bank-account", "Bank Accounts", month, cash, {
        assets: true,
        cash: true,
      }),
      this.createProjectedEntity("projected:other-assets", "other-asset", "Other Assets", month, nonCashAssets, {
        assets: true,
      }),
      this.createProjectedEntity("projected:mutual-funds", "mutual-fund", "Mutual Funds", month, mutualFunds, {
        investments: true,
      }),
      this.createProjectedEntity("projected:stocks", "stock", "Stocks", month, stocks, {
        investments: true,
      }),
      this.createProjectedEntity("projected:gold", "gold", "Gold", month, 0, {
        investments: true,
      }),
      this.createProjectedEntity("projected:silver", "silver", "Silver", month, 0, {
        investments: true,
      }),
      this.createProjectedEntity("projected:fixed-deposits", "fixed-deposit", "Fixed Deposits", month, 0, {
        investments: true,
      }),
      this.createProjectedEntity("projected:epf", "epf", "EPF", month, retirement / 3, {
        investments: true,
        retirement: true,
      }),
      this.createProjectedEntity("projected:ppf", "ppf", "PPF", month, retirement / 3, {
        investments: true,
        retirement: true,
      }),
      this.createProjectedEntity("projected:nps", "nps", "NPS", month, retirement - (retirement / 3) * 2, {
        investments: true,
        retirement: true,
      }),
      this.createProjectedEntity("projected:other-liabilities", "other-liability", "Other Liabilities", month, liabilities, {
        liabilities: true,
      }),
    ];
  }

  private buildProjectedEntitiesFromOpening(
    month: string,
    openingBalances: OpeningBalances,
    balanceSheetData: Awaited<ReturnType<typeof getBalanceSheetData>>,
  ): ProjectedEntity[] {
    const realEstateModuleValue = balanceSheetData.realEstateProperties.reduce(
      (sum, property) => sum + Number(property.current_market_value ?? 0),
      0,
    );
    const legacyRealEstateValue = balanceSheetData.assets.reduce((sum, asset) => {
      return sum + (asset.asset_type === "real_estate" ? Number(asset.current_value ?? 0) : 0);
    }, 0);
    const otherAssetsValue = balanceSheetData.assets.reduce((sum, asset) => {
      if (asset.asset_type === "vehicle" || asset.asset_type === "business" || asset.asset_type === "other") {
        return sum + Number(asset.current_value ?? 0);
      }

      return sum;
    }, 0);
    const bankAccounts = balanceSheetData.bankAccounts
      .filter((account) => account.status !== "closed")
      .reduce((sum, account) => sum + Number(account.current_balance ?? 0), 0);
    const mutualFunds = this.sumInvestmentsByCategory(balanceSheetData.investments, new Set(["Mutual Funds"]));
    const stocks = this.sumInvestmentsByCategory(balanceSheetData.investments, new Set(["Stocks", "ETFs", "Bonds", "Crypto", "Cash Equivalents"]));
    const gold = balanceSheetData.goldHoldings.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0)
      + this.sumInvestmentsByCategory(balanceSheetData.investments, new Set(["Gold", "Sovereign Gold Bonds"]));
    const silver = balanceSheetData.silverHoldings.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0)
      + this.sumInvestmentsByCategory(balanceSheetData.investments, new Set(["Silver"]));
    const fixedDeposits = balanceSheetData.fixedDeposits.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0)
      + this.sumInvestmentsByCategory(balanceSheetData.investments, new Set(["Fixed Deposits"]));
    const epf = balanceSheetData.retirementAccounts.reduce((sum, account) => sum + (account.account_type === "EPF" ? Number(account.current_balance ?? 0) : 0), 0)
      + this.sumInvestmentsByCategory(balanceSheetData.investments, new Set(["EPF"]));
    const ppf = balanceSheetData.retirementAccounts.reduce((sum, account) => sum + (account.account_type === "PPF" ? Number(account.current_balance ?? 0) : 0), 0)
      + this.sumInvestmentsByCategory(balanceSheetData.investments, new Set(["PPF"]));
    const nps = balanceSheetData.retirementAccounts.reduce((sum, account) => sum + (account.account_type === "NPS" ? Number(account.current_balance ?? 0) : 0), 0)
      + this.sumInvestmentsByCategory(balanceSheetData.investments, new Set(["NPS"]));
    const liabilities = balanceSheetData.liabilities.reduce(
      (acc, liability) => {
        const amount = Number(liability.outstanding_amount ?? 0);
        if (liability.liability_type === "Home Loan" || liability.liability_type === "Loan Against Property") {
          acc.home_loans += amount;
        } else if (liability.liability_type === "Car Loan") {
          acc.car_loans += amount;
        } else {
          acc.other_liabilities += amount;
        }
        return acc;
      },
      { home_loans: 0, car_loans: 0, other_liabilities: 0 },
    );

    return this.buildOpeningEntitiesFromValueMap(month, {
      bank_accounts: bankAccounts,
      mutual_funds: mutualFunds,
      stocks: stocks,
      gold,
      silver,
      fixed_deposits: fixedDeposits,
      epf,
      ppf,
      nps,
      real_estate: realEstateModuleValue > 0 ? realEstateModuleValue : legacyRealEstateValue,
      other_assets: otherAssetsValue,
      home_loans: liabilities.home_loans,
      car_loans: liabilities.car_loans,
      other_liabilities: liabilities.other_liabilities,
    });
  }

  private prepareEntitiesForMonth(previousEntities: ProjectedEntity[], month: string): ProjectedEntity[] {
    return previousEntities.map((entity) => {
      const openingBalance = Number(entity.closingBalance ?? 0);

      return {
        ...entity,
        month,
        openingBalance,
        contributionActivity: 0,
        growthActivity: 0,
        otherActivity: 0,
        closingBalance: openingBalance,
      };
    });
  }

  generateTimeline(scenario: ProjectionScenario): ProjectionTimelinePoint[] {
    return this.buildTimelineRange(scenario.startMonth, scenario.planningHorizonYear);
  }

  private async loadScenarioEvents(scenario: ProjectionScenario): Promise<FinancialEvent[]> {
    if (scenario.events.length > 0) {
      return scenario.events;
    }

    try {
      return await this.eventsService.listEvents(scenario.id);
    } catch {
      return [];
    }
  }

  private async loadAssumptionsBundleForScenario(scenario: ProjectionScenario): Promise<AssumptionsBundle> {
    try {
      return await this.assumptions.getAssumptionsBundle(scenario.id);
    } catch {
      return await this.assumptions.getAssumptionsBundle(DEFAULT_SCENARIO_KEY);
    }
  }

  async loadOpeningBalances(_scenario: ProjectionScenario): Promise<OpeningBalances> {
    void this.assumptions;

    const latestClosedSeed = await this.getLatestClosedMonthEndSeed();
    if (latestClosedSeed) {
      const openingEntities = this.buildOpeningEntitiesFromValueMap(this.formatMonthKey(latestClosedSeed.closeYear, latestClosedSeed.closeMonth), latestClosedSeed.values);
      const balances = this.eventEngine.deriveBalancesFromEntities(openingEntities);

      return {
        assets: balances.assets,
        liabilities: balances.liabilities,
        investments: balances.investments,
        retirement: balances.retirement,
        cash: balances.cash,
        netWorth: balances.netWorth,
      };
    }

    const balanceSheetData = await getBalanceSheetData();
    const { summary } = balanceSheetData;

    return {
      assets: summary.totalAssets,
      liabilities: summary.totalLiabilities,
      investments: summary.totalInvestments,
      retirement: summary.categoryTotals.retirement,
      cash: summary.categoryTotals.cashAndBank,
      netWorth: summary.netWorth,
    };
  }

  private async loadOpeningProjectionState(scenario: ProjectionScenario): Promise<{ openingEntities: ProjectedEntity[]; effectiveStartMonth: string }> {
    const latestClosedSeed = await this.getLatestClosedMonthEndSeed();
    if (latestClosedSeed) {
      const nextSeedMonth = this.addMonths(latestClosedSeed.closeYear, latestClosedSeed.closeMonth);
      const requestedStart = this.parseMonthKey(scenario.startMonth);
      const effectiveStart = this.compareMonth(requestedStart, nextSeedMonth) > 0 ? requestedStart : nextSeedMonth;
      const effectiveStartMonth = this.formatMonthKey(effectiveStart.year, effectiveStart.month);

      return {
        effectiveStartMonth,
        openingEntities: this.buildOpeningEntitiesFromValueMap(effectiveStartMonth, latestClosedSeed.values),
      };
    }

    const balanceSheetData = await getBalanceSheetData();
    const { summary } = balanceSheetData;

    const openingBalances: OpeningBalances = {
      assets: summary.totalAssets,
      liabilities: summary.totalLiabilities,
      investments: summary.totalInvestments,
      retirement: summary.categoryTotals.retirement,
      cash: summary.categoryTotals.cashAndBank,
      netWorth: summary.netWorth,
    };

    return {
      effectiveStartMonth: scenario.startMonth,
      openingEntities: this.buildProjectedEntitiesFromOpening(scenario.startMonth, openingBalances, balanceSheetData),
    };
  }

  applyFinancialEvents(
    openingBalances: OpeningBalances,
    _assumptions: FinancialAssumption[],
    events: FinancialEvent[],
    timeline: ProjectionTimelinePoint[],
  ): OpeningBalances {
    let currentEntities = this.buildProjectedEntitiesFromAggregate(timeline[0]?.month ?? "1970-01", openingBalances);

    let current: ProjectionBalanceState = this.eventEngine.deriveBalancesFromEntities(currentEntities);

    for (const month of timeline) {
      const monthEntities = this.prepareEntitiesForMonth(currentEntities, month.month);
      const result = this.eventEngine.processEventsForMonth(events, {
        month,
        openingBalances: current,
        openingEntities: monthEntities,
      });
      currentEntities = result.updatedEntities;
      current = result.updatedBalances;
    }

    return {
      assets: current.assets,
      liabilities: current.liabilities,
      investments: current.investments,
      retirement: current.retirement,
      cash: current.cash,
      netWorth: current.netWorth,
    };
  }

  applyGrowth(
    _balances: OpeningBalances,
    _assumptions: FinancialAssumption[],
    _timeline: ProjectionTimelinePoint[],
  ): OpeningBalances {
    throw new Error("ProjectionEngine.applyGrowth is not implemented yet.");
  }

  applyLoanAmortization(
    _balances: OpeningBalances,
    _events: FinancialEvent[],
    _timeline: ProjectionTimelinePoint[],
  ): OpeningBalances {
    throw new Error("ProjectionEngine.applyLoanAmortization is not implemented yet.");
  }

  generateMonthlySnapshot(
    scenario: ProjectionScenario,
    month: ProjectionTimelinePoint,
    entities: ProjectedEntity[],
  ): MonthlySnapshot {
    const balanceState = this.eventEngine.deriveBalancesFromEntities(entities);

    return {
      id: `${scenario.id}:${month.month}`,
      scenarioId: scenario.id,
      month: month.month,
      openingBalance: balanceState.netWorth,
      closingBalance: balanceState.netWorth,
      contributions: 0,
      growth: 0,
      loanPrincipalReduction: 0,
      goalFunding: 0,
      inflationImpact: 0,
      eventsApplied: [],
      monthlyLedger: [],
      projectedEntities: entities.map((entity) => ({ ...entity })),
      openingBalances: balanceState,
      closingBalances: { ...balanceState },
    };
  }

  buildMonthlySnapshots(scenario: ProjectionScenario, events: FinancialEvent[], timeline: ProjectionTimelinePoint[], openingEntities: ProjectedEntity[]): MonthlySnapshot[] {
    const snapshots: MonthlySnapshot[] = [];
    let currentEntities = openingEntities.map((entity) => ({ ...entity }));

    for (const month of timeline) {
      const monthEntities = this.prepareEntitiesForMonth(currentEntities, month.month);
      const baseSnapshot = this.generateMonthlySnapshot(scenario, month, monthEntities);
      const eventResult = this.eventEngine.processEventsForMonth(events, {
        month,
        openingBalances: baseSnapshot.openingBalances,
        openingEntities: baseSnapshot.projectedEntities,
      });
      const snapshot = this.eventEngine.applyEventResultToSnapshot(baseSnapshot, eventResult);

      snapshots.push(snapshot);
      currentEntities = snapshot.projectedEntities.map((entity) => ({ ...entity }));
    }

    return snapshots;
  }

  getProjectedSnapshots(): MonthlySnapshot[] {
    return [...this.projectedSnapshots];
  }

  clearProjectedSnapshots(): void {
    this.projectedSnapshots = [];
  }

  async runProjection(scenario: ProjectionScenario): Promise<ProjectionResult> {
    void this.assumptions;

    const { openingEntities, effectiveStartMonth } = await this.loadOpeningProjectionState(scenario);
    const effectiveScenario = effectiveStartMonth === scenario.startMonth ? scenario : { ...scenario, startMonth: effectiveStartMonth };
    const timeline = this.generateTimeline(effectiveScenario);
    const [events, assumptionsBundle] = await Promise.all([
      this.loadScenarioEvents(scenario),
      this.loadAssumptionsBundleForScenario(scenario),
    ]);
    const normalizedAssumptionsBundle: AssumptionsBundle = {
      ...assumptionsBundle,
      planning: {
        ...assumptionsBundle.planning,
        startMonth: effectiveStartMonth,
      },
    };
    const assumptionContributionEvents = buildContributionEventsFromAssumptions(normalizedAssumptionsBundle);
    const assumptionGrowthEvents = buildGrowthEventsFromAssumptions(normalizedAssumptionsBundle);
    const snapshots = this.buildMonthlySnapshots(
      effectiveScenario,
      [...assumptionContributionEvents, ...events, ...assumptionGrowthEvents],
      timeline,
      openingEntities,
    );

    this.projectedSnapshots = snapshots;

    return {
      scenario: effectiveScenario,
      timeline,
      snapshots,
    };
  }
}

export const projectionEngine = new ProjectionEngine();