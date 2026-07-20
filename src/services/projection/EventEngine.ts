import type { FinancialEvent, MonthlyLedgerEntry, MonthlySnapshot, ProjectedEntity, ProjectionBalanceState, ProjectionFrequency } from "@/types/projection";

export interface EventExecutionMonth {
  month: string;
  year: number;
}

export interface EventExecutionContext {
  month: EventExecutionMonth;
  openingBalances: ProjectionBalanceState;
  openingEntities: ProjectedEntity[];
}

export interface EventEffect {
  balanceDelta: Partial<ProjectionBalanceState>;
  contributionsDelta: number;
  growthDelta: number;
  loanPrincipalReductionDelta: number;
  goalFundingDelta: number;
  inflationImpactDelta: number;
}

export interface AppliedEvent {
  eventId: string;
  eventName: string;
  eventType: FinancialEvent["type"];
  amount: number;
  month: string;
  effect: EventEffect;
}

export interface EventProcessingResult {
  updatedBalances: ProjectionBalanceState;
  updatedEntities: ProjectedEntity[];
  contributionsDelta: number;
  growthDelta: number;
  loanPrincipalReductionDelta: number;
  goalFundingDelta: number;
  inflationImpactDelta: number;
  netWorthDelta: number;
  appliedEvents: AppliedEvent[];
  monthlyLedgerEntries: MonthlyLedgerEntry[];
  eventLabels: string[];
}

interface NormalizedEventSchedule {
  frequency: ProjectionFrequency;
  intervalMonths: number | null;
  anchorMonth: string;
  oneTimeMonth: string;
  startMonth: string;
  endMonth: string | null;
  customMonthsOfYear: number[];
}

export interface EventProcessorContext {
  event: FinancialEvent;
  month: string;
  openingBalances: ProjectionBalanceState;
  openingEntities?: ProjectedEntity[];
}

export interface FinancialEventProcessor {
  id: string;
  supports(event: FinancialEvent): boolean;
  buildEffect(context: EventProcessorContext): EventEffect;
}

function isProjectionBalanceKey(key: string): key is keyof ProjectionBalanceState {
  return key === "assets" || key === "liabilities" || key === "investments" || key === "retirement" || key === "cash" || key === "netWorth";
}

export class ProjectionEventEngine {
  private readonly processors: FinancialEventProcessor[] = [];

  registerProcessor(processor: FinancialEventProcessor): void {
    this.processors.push(processor);
  }

  unregisterProcessor(processorId: string): void {
    const index = this.processors.findIndex((processor) => processor.id === processorId);
    if (index >= 0) {
      this.processors.splice(index, 1);
    }
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

  private monthKeyFromDate(dateValue: string | null | undefined): string | null {
    if (!dateValue) {
      return null;
    }

    const trimmed = dateValue.trim();

    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 7);
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return this.formatMonthKey(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1);
  }

  private normalizeFrequency(frequency: ProjectionFrequency | undefined): ProjectionFrequency {
    if (!frequency) {
      return "one-time";
    }

    if (frequency === "annual") {
      return "yearly";
    }

    return frequency;
  }

  private getIntervalMonths(event: FinancialEvent, frequency: ProjectionFrequency): number | null {
    if (frequency === "one-time") {
      return null;
    }

    if (frequency === "monthly") {
      return 1;
    }

    if (frequency === "quarterly") {
      return 3;
    }

    if (frequency === "yearly") {
      return 12;
    }

    const metadataInterval = Number(event.metadata?.customRecurrence?.intervalMonths ?? 0);
    const requestedInterval = Number(event.repeatEveryMonths ?? 0);
    const resolved = requestedInterval > 0 ? requestedInterval : metadataInterval;
    return resolved > 0 ? Math.floor(resolved) : 1;
  }

  private getCustomMonthsOfYear(event: FinancialEvent): number[] {
    const months = event.metadata?.customRecurrence?.monthsOfYear;

    if (!Array.isArray(months)) {
      return [];
    }

    return months
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 12);
  }

  private compareMonthKeys(left: string, right: string): number {
    const leftMonth = this.parseMonthKey(left);
    const rightMonth = this.parseMonthKey(right);

    if (leftMonth.year !== rightMonth.year) {
      return leftMonth.year - rightMonth.year;
    }

    return leftMonth.month - rightMonth.month;
  }

  private monthDiff(fromMonth: string, toMonth: string): number {
    const from = this.parseMonthKey(fromMonth);
    const to = this.parseMonthKey(toMonth);

    return (to.year - from.year) * 12 + (to.month - from.month);
  }

  normalizeEventSchedule(event: FinancialEvent): NormalizedEventSchedule {
    const frequency = this.normalizeFrequency(event.frequency);
    const oneTimeMonth = this.monthKeyFromDate(event.date);

    if (!oneTimeMonth) {
      throw new Error(`Invalid event date for ${event.id}`);
    }

    const startMonth = this.monthKeyFromDate(event.startsOn) ?? oneTimeMonth;
    const endMonth = this.monthKeyFromDate(event.endsOn);
    const anchorMonth = startMonth;
    const customMonthsOfYear = this.getCustomMonthsOfYear(event);

    return {
      frequency,
      intervalMonths: this.getIntervalMonths(event, frequency),
      anchorMonth,
      oneTimeMonth,
      startMonth,
      endMonth,
      customMonthsOfYear,
    };
  }

  isEventEffectiveForMonth(event: FinancialEvent, month: string): boolean {
    if (!event.isEnabled) {
      return false;
    }

    const schedule = this.normalizeEventSchedule(event);

    if (this.compareMonthKeys(month, schedule.startMonth) < 0) {
      return false;
    }

    if (schedule.endMonth && this.compareMonthKeys(month, schedule.endMonth) > 0) {
      return false;
    }

    if (schedule.frequency === "one-time") {
      return this.compareMonthKeys(month, schedule.oneTimeMonth) === 0;
    }

    const interval = schedule.intervalMonths ?? 1;
    const elapsedMonths = this.monthDiff(schedule.anchorMonth, month);

    if (elapsedMonths < 0) {
      return false;
    }

    if (schedule.frequency === "custom" && schedule.customMonthsOfYear.length > 0) {
      const current = this.parseMonthKey(month);
      if (!schedule.customMonthsOfYear.includes(current.month)) {
        return false;
      }
    }

    return elapsedMonths % interval === 0;
  }

  selectApplicableEvents(events: FinancialEvent[], month: string): FinancialEvent[] {
    return events.filter((event) => this.isEventEffectiveForMonth(event, month));
  }

  buildDefaultEventEffect(event: FinancialEvent): EventEffect {
    const amount = Number(event.amount ?? 0);
    const metadata = event.metadata ?? {};

    const balanceDelta: Partial<ProjectionBalanceState> = {
      assets: amount,
      cash: amount,
      netWorth: amount,
    };

    const explicitBalanceDelta = metadata.balanceDelta;
    if (explicitBalanceDelta && typeof explicitBalanceDelta === "object") {
      const normalizedBalanceDelta: Partial<ProjectionBalanceState> = {};
      for (const [key, value] of Object.entries(explicitBalanceDelta)) {
        if (isProjectionBalanceKey(key)) {
          normalizedBalanceDelta[key] = Number(value ?? 0);
        }
      }

      return {
        balanceDelta: normalizedBalanceDelta,
        contributionsDelta: amount,
        growthDelta: 0,
        loanPrincipalReductionDelta: 0,
        goalFundingDelta: event.type === "goal-funding" ? amount : 0,
        inflationImpactDelta: event.type === "inflation" ? amount : 0,
      };
    }

    const balanceField = typeof metadata.balanceField === "string" ? metadata.balanceField : null;
    if (balanceField && isProjectionBalanceKey(balanceField)) {
      balanceDelta.assets = 0;
      balanceDelta.cash = 0;
      balanceDelta.netWorth = 0;
      balanceDelta[balanceField] = amount;
    }

    if (event.type === "goal-funding") {
      return {
        balanceDelta,
        contributionsDelta: 0,
        growthDelta: 0,
        loanPrincipalReductionDelta: 0,
        goalFundingDelta: amount,
        inflationImpactDelta: 0,
      };
    }

    if (event.type === "inflation") {
      return {
        balanceDelta,
        contributionsDelta: 0,
        growthDelta: 0,
        loanPrincipalReductionDelta: 0,
        goalFundingDelta: 0,
        inflationImpactDelta: amount,
      };
    }

    return {
      balanceDelta,
      contributionsDelta: amount,
      growthDelta: 0,
      loanPrincipalReductionDelta: 0,
      goalFundingDelta: 0,
      inflationImpactDelta: 0,
    };
  }

  applyEffectToBalances(balances: ProjectionBalanceState, effect: EventEffect): ProjectionBalanceState {
    const next: ProjectionBalanceState = { ...balances };

    for (const [key, value] of Object.entries(effect.balanceDelta)) {
      if (!isProjectionBalanceKey(key)) {
        continue;
      }

      const delta = Number(value ?? 0);
      next[key] = Number(next[key] ?? 0) + delta;
    }

    return next;
  }

  private resolveProcessor(event: FinancialEvent): FinancialEventProcessor | null {
    return this.processors.find((processor) => processor.supports(event)) ?? null;
  }

  deriveBalancesFromEntities(entities: ProjectedEntity[]): ProjectionBalanceState {
    const assets = entities.reduce((sum, entity) => sum + (entity.dimensions.assets ? Number(entity.closingBalance ?? 0) : 0), 0);
    const liabilities = entities.reduce((sum, entity) => sum + (entity.dimensions.liabilities ? Number(entity.closingBalance ?? 0) : 0), 0);
    const investments = entities.reduce((sum, entity) => sum + (entity.dimensions.investments ? Number(entity.closingBalance ?? 0) : 0), 0);
    const retirement = entities.reduce((sum, entity) => sum + (entity.dimensions.retirement ? Number(entity.closingBalance ?? 0) : 0), 0);
    const cash = entities.reduce((sum, entity) => sum + (entity.dimensions.cash ? Number(entity.closingBalance ?? 0) : 0), 0);

    return {
      assets,
      liabilities,
      investments,
      retirement,
      cash,
      netWorth: assets + investments - liabilities,
    };
  }

  private entityMatchesTarget(entity: ProjectedEntity, target: "cash" | "investments" | "retirement" | "assets" | "liabilities"): boolean {
    if (target === "cash") {
      return entity.dimensions.cash;
    }

    if (target === "investments") {
      return entity.dimensions.investments;
    }

    if (target === "retirement") {
      return entity.dimensions.retirement;
    }

    if (target === "liabilities") {
      return entity.dimensions.liabilities;
    }

    return entity.dimensions.assets;
  }

  private applyDeltaToEntities(
    entities: ProjectedEntity[],
    target: "cash" | "investments" | "retirement" | "assets" | "liabilities",
    delta: number,
    activityType: "contribution" | "growth" | "other",
  ): ProjectedEntity[] {
    if (!Number.isFinite(delta) || delta === 0) {
      return entities;
    }

    const next = entities.map((entity) => ({ ...entity }));
    const eligibleIndexes = next
      .map((entity, index) => ({ entity, index }))
      .filter(({ entity }) => this.entityMatchesTarget(entity, target))
      .map(({ index }) => index);

    if (eligibleIndexes.length === 0) {
      return next;
    }

    const basis = eligibleIndexes.map((index) => Math.max(0, Number(next[index].closingBalance ?? 0)));
    const basisTotal = basis.reduce((sum, value) => sum + value, 0);
    const hasBasis = basisTotal > 0;

    let allocated = 0;
    for (let i = 0; i < eligibleIndexes.length; i += 1) {
      const index = eligibleIndexes[i];
      const entity = next[index];
      const share = i === eligibleIndexes.length - 1
        ? delta - allocated
        : hasBasis
          ? delta * (basis[i] / basisTotal)
          : delta / eligibleIndexes.length;

      allocated += share;
      entity.closingBalance = Number(entity.closingBalance ?? 0) + share;

      if (activityType === "contribution") {
        entity.contributionActivity = Number(entity.contributionActivity ?? 0) + share;
      } else if (activityType === "growth") {
        entity.growthActivity = Number(entity.growthActivity ?? 0) + share;
      } else {
        entity.otherActivity = Number(entity.otherActivity ?? 0) + share;
      }
    }

    return next;
  }

  private applyNonLedgerEffectToEntities(entities: ProjectedEntity[], effect: EventEffect): ProjectedEntity[] {
    let next = entities;

    const deltas: Array<{ target: "assets" | "liabilities" | "investments" | "retirement" | "cash"; value: number }> = [
      { target: "assets", value: Number(effect.balanceDelta.assets ?? 0) },
      { target: "liabilities", value: Number(effect.balanceDelta.liabilities ?? 0) },
      { target: "investments", value: Number(effect.balanceDelta.investments ?? 0) },
      { target: "retirement", value: Number(effect.balanceDelta.retirement ?? 0) },
      { target: "cash", value: Number(effect.balanceDelta.cash ?? 0) },
    ];

    for (const entry of deltas) {
      if (entry.value !== 0) {
        next = this.applyDeltaToEntities(next, entry.target, entry.value, "other");
      }
    }

    return next;
  }

  private normalizeLedgerTarget(target: unknown): "cash" | "investments" | "retirement" | "assets" | "liabilities" {
    if (target === "cash" || target === "investments" || target === "retirement" || target === "assets" || target === "liabilities") {
      return target;
    }

    return "assets";
  }

  private buildEventEffect(event: FinancialEvent, context: EventExecutionContext): EventEffect {
    const processor = this.resolveProcessor(event);

    if (!processor) {
      return this.buildDefaultEventEffect(event);
    }

    return processor.buildEffect({
      event,
      month: context.month.month,
      openingBalances: context.openingBalances,
      openingEntities: context.openingEntities,
    });
  }

  processEventsForMonth(events: FinancialEvent[], context: EventExecutionContext): EventProcessingResult {
    const applicable = this.selectApplicableEvents(events, context.month.month);

    const appliedEvents: AppliedEvent[] = [];
    const monthlyLedgerEntries: MonthlyLedgerEntry[] = [];
    let updatedEntities: ProjectedEntity[] = context.openingEntities.map((entity) => ({ ...entity }));
    let updatedBalances: ProjectionBalanceState = this.deriveBalancesFromEntities(updatedEntities);
    let contributionsDelta = 0;
    let growthDelta = 0;
    let loanPrincipalReductionDelta = 0;
    let goalFundingDelta = 0;
    let inflationImpactDelta = 0;

    for (const event of applicable) {
      const preEventBalances = { ...updatedBalances };
      const effect = this.buildEventEffect(event, {
        month: context.month,
        openingBalances: updatedBalances,
        openingEntities: updatedEntities,
      });
      contributionsDelta += effect.contributionsDelta;
      growthDelta += effect.growthDelta;
      loanPrincipalReductionDelta += effect.loanPrincipalReductionDelta;
      goalFundingDelta += effect.goalFundingDelta;
      inflationImpactDelta += effect.inflationImpactDelta;

      if (effect.contributionsDelta !== 0) {
        const target = this.normalizeLedgerTarget(event.metadata?.contributionTarget);
        updatedEntities = this.applyDeltaToEntities(updatedEntities, target, Number(effect.contributionsDelta ?? 0), "contribution");
        monthlyLedgerEntries.push({
          eventId: event.id,
          eventName: event.name,
          eventType: event.type,
          module: event.module,
          month: context.month.month,
          amount: Number(effect.contributionsDelta ?? 0),
          entryType: "contribution",
          source: event.metadata?.source === "assumption" ? "assumption" : "event",
          target,
        });
      }

      if (effect.growthDelta !== 0) {
        const target = this.normalizeLedgerTarget(event.metadata?.growthTarget ?? event.metadata?.contributionTarget);
        const targetField = target as keyof ProjectionBalanceState;
        const allocationShare = Number(event.metadata?.allocationShare ?? 1);
        const normalizedShare = Number.isFinite(allocationShare) && allocationShare > 0 ? Math.min(1, allocationShare) : 1;
        const baseAmount = Number(preEventBalances[targetField] ?? 0) * normalizedShare;
        updatedEntities = this.applyDeltaToEntities(updatedEntities, target, Number(effect.growthDelta ?? 0), "growth");
        monthlyLedgerEntries.push({
          eventId: event.id,
          eventName: event.name,
          eventType: event.type,
          module: event.module,
          month: context.month.month,
          amount: Number(effect.growthDelta ?? 0),
          entryType: "growth",
          source: event.metadata?.source === "assumption" ? "assumption" : "event",
          target,
          annualRate: Number(event.metadata?.annualRate ?? 0),
          monthlyRate: Number(event.metadata?.monthlyRate ?? 0),
          baseAmount,
        });
      }

      if (effect.contributionsDelta === 0 && effect.growthDelta === 0) {
        updatedEntities = this.applyNonLedgerEffectToEntities(updatedEntities, effect);
      }

      updatedBalances = this.deriveBalancesFromEntities(updatedEntities);

      appliedEvents.push({
        eventId: event.id,
        eventName: event.name,
        eventType: event.type,
        amount: Number(event.amount ?? 0),
        month: context.month.month,
        effect,
      });
    }

    const netWorthDelta = Number(updatedBalances.netWorth ?? 0) - Number(context.openingBalances.netWorth ?? 0);

    return {
      updatedBalances,
      updatedEntities,
      contributionsDelta,
      growthDelta,
      loanPrincipalReductionDelta,
      goalFundingDelta,
      inflationImpactDelta,
      netWorthDelta,
      appliedEvents,
      monthlyLedgerEntries,
      eventLabels: appliedEvents.map((event) => `${event.eventName} (${event.eventId})`),
    };
  }

  applyEventResultToSnapshot(snapshot: MonthlySnapshot, result: EventProcessingResult): MonthlySnapshot {
    const closingBalances = this.deriveBalancesFromEntities(result.updatedEntities);

    return {
      ...snapshot,
      contributions: snapshot.contributions + result.contributionsDelta,
      growth: snapshot.growth + result.growthDelta,
      loanPrincipalReduction: snapshot.loanPrincipalReduction + result.loanPrincipalReductionDelta,
      goalFunding: snapshot.goalFunding + result.goalFundingDelta,
      inflationImpact: snapshot.inflationImpact + result.inflationImpactDelta,
      projectedEntities: result.updatedEntities.map((entity) => ({ ...entity })),
      closingBalances,
      closingBalance: closingBalances.netWorth,
      eventsApplied: [...snapshot.eventsApplied, ...result.eventLabels],
      monthlyLedger: [...snapshot.monthlyLedger, ...result.monthlyLedgerEntries],
    };
  }
}

export const projectionEventEngine = new ProjectionEventEngine();