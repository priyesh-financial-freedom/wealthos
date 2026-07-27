import { normalizeAssumptions } from "./assumptions";
import { projectionAnalyticsService } from "./analytics";
import { createProjectionContext, monthKeyForContextIndex } from "./context";
import { runMonthlyPipeline } from "./pipeline";
import {
  createDefaultFinancialRuleRegistry,
} from "./rules/defaultRegistry";
import type { FinancialRuleRegistry } from "./rules/registry";
import type {
  ActualMonthInput,
  BaselineProjectionInput,
  LoanState,
  MonthlyProjection,
  ProjectionBalances,
  ProjectionContext,
  ProjectionKPISet,
  ProjectionVariance,
  RollingProjectionInput,
  VarianceInput,
} from "./types";

function defaultStateForVersion(context: ProjectionContext): MonthlyProjection["state"] {
  if (context.projectionVersion.kind === "BASELINE") {
    return "Baseline";
  }

  return "Forecast";
}

function toLoanStatesFromContext(context: ProjectionContext): LoanState[] {
  if (context.assumptions.loans.length > 0) {
    return context.assumptions.loans.map((loan) => ({ ...loan }));
  }

  return context.liabilities.map((liability) => ({
    id: liability.id,
    outstandingPrincipal: Math.max(0, Number(liability.outstandingAmount ?? 0)),
    annualInterestRate: Math.max(0, Number(liability.annualInterestRate ?? 0)),
    emi: Math.max(0, Number(liability.emi ?? 0)),
  }));
}

function cloneProjection(month: MonthlyProjection): MonthlyProjection {
  return {
    ...month,
    projectionVersion: { ...month.projectionVersion },
    pipeline: [...month.pipeline],
    opening: { ...month.opening },
    activity: { ...month.activity },
    closing: { ...month.closing },
    assumptions: { ...month.assumptions },
    loans: month.loans.map((loan) => ({ ...loan })),
    metadata: month.metadata ? { ...month.metadata } : undefined,
  };
}

function hasActualData(actual: ActualMonthInput): boolean {
  return Boolean(actual.activity || actual.closing || actual.loans || actual.notes);
}

function normalizeClosing(closing: ProjectionBalances): ProjectionBalances {
  return {
    ...closing,
    assets: Math.max(0, Number(closing.assets ?? 0)),
    liabilities: Math.max(0, Number(closing.liabilities ?? 0)),
    cash: Number(closing.cash ?? 0),
    investments: Number(closing.investments ?? 0),
    loanOutstanding: Math.max(0, Number(closing.loanOutstanding ?? 0)),
    netWorth: Number(closing.netWorth ?? 0),
  };
}

export class ProjectionEngine {
  constructor(private readonly ruleRegistry: FinancialRuleRegistry = createDefaultFinancialRuleRegistry()) {}

  generateProjection(inputContext: ProjectionContext): MonthlyProjection[] {
    const context = createProjectionContext({
      ...inputContext,
      assumptions: normalizeAssumptions(inputContext.assumptions),
    });

    if (!Number.isInteger(context.projectionPeriod.months) || context.projectionPeriod.months <= 0) {
      throw new Error("Projection months must be a positive integer.");
    }

    const projection: MonthlyProjection[] = [];
    let runningOpening: ProjectionBalances = { ...context.openingBalances };
    let runningLoans = toLoanStatesFromContext(context);

    for (let monthIndex = 0; monthIndex < context.projectionPeriod.months; monthIndex += 1) {
      const monthKey = monthKeyForContextIndex(context, monthIndex);
      const monthResult = runMonthlyPipeline({
        context,
        monthKey,
        monthIndex,
        state: defaultStateForVersion(context),
        opening: runningOpening,
        loans: runningLoans,
        ruleRegistry: this.ruleRegistry,
      });

      projection.push(monthResult.projection);
      runningOpening = monthResult.nextOpening;
      runningLoans = monthResult.nextLoans;
    }

    if (context.projectionVersion.kind !== "CURRENT") {
      return projection;
    }

    const actualLookup = new Map(
      context.actualMonthlyData.map((item) => [item.monthKey, item]),
    );
    const working = projection.map(cloneProjection);
    let lastActualIndex = -1;

    for (let index = 0; index < working.length; index += 1) {
      const month = working[index];
      const actual = actualLookup.get(month.monthKey);
      if (!month || !actual || !hasActualData(actual)) {
        continue;
      }

      working[index] = this.applyActualMonth(month, actual);
      lastActualIndex = index;
    }

    if (lastActualIndex < 0) {
      return working;
    }

    runningOpening = { ...working[lastActualIndex].closing };
    runningLoans = working[lastActualIndex].loans.map((loan) => ({ ...loan }));

    for (let index = lastActualIndex + 1; index < working.length; index += 1) {
      const monthResult = runMonthlyPipeline({
        context,
        monthKey: working[index].monthKey,
        monthIndex: working[index].monthIndex,
        state: "Forecast",
        opening: runningOpening,
        loans: runningLoans,
        ruleRegistry: this.ruleRegistry,
      });

      working[index] = monthResult.projection;
      runningOpening = monthResult.nextOpening;
      runningLoans = monthResult.nextLoans;
    }

    return working;
  }

  generateBaselineProjection(input: BaselineProjectionInput): MonthlyProjection[] {
    const context = createProjectionContext({
      financialPlan: { id: "plan-baseline" },
      projectionVersion: { id: "version-baseline", kind: "BASELINE" },
      projectionPeriod: {
        startMonthKey: input.startMonthKey,
        months: input.months,
      },
      currentProcessingMonth: input.startMonthKey,
      assumptions: input.assumptions,
      openingBalances: input.openingBalances,
      assets: [],
      liabilities: [],
      incomeSources: [],
      expenseCategories: [],
      contributionRules: [],
      growthRules: [],
      events: [],
      actualMonthlyData: [],
    });

    return this.generateProjection(context);
  }

  generateRollingProjection(input: RollingProjectionInput): MonthlyProjection[] {
    if (input.baselineProjection.length === 0) {
      return [];
    }

    const firstMonth = input.baselineProjection[0];
    const context = createProjectionContext({
      financialPlan: { id: "plan-current" },
      projectionVersion: { id: "version-current", kind: "CURRENT" },
      projectionPeriod: {
        startMonthKey: firstMonth.monthKey,
        months: input.baselineProjection.length,
      },
      currentProcessingMonth: firstMonth.monthKey,
      assumptions: input.assumptions,
      openingBalances: firstMonth.opening,
      assets: [],
      liabilities: [],
      incomeSources: [],
      expenseCategories: [],
      contributionRules: [],
      growthRules: [],
      events: [],
      actualMonthlyData: input.actualMonths,
    });

    return this.generateProjection(context);
  }

  generateScenarioProjection(context: ProjectionContext): MonthlyProjection[] {
    const scenarioContext = createProjectionContext({
      ...context,
      projectionVersion: {
        ...context.projectionVersion,
        kind: "SCENARIO",
      },
    });

    return this.generateProjection(scenarioContext);
  }

  applyActualMonth(
    baselineMonth: MonthlyProjection,
    actualMonth: ActualMonthInput,
  ): MonthlyProjection {
    const mergedActivity = {
      ...baselineMonth.activity,
      ...(actualMonth.activity ?? {}),
    };
    const mergedClosing = normalizeClosing({
      ...baselineMonth.closing,
      ...(actualMonth.closing ?? {}),
    });
    const mergedLoans = actualMonth.loans?.map((loan) => ({ ...loan })) ?? baselineMonth.loans;

    return {
      ...baselineMonth,
      state: "Actual",
      activity: mergedActivity,
      closing: mergedClosing,
      loans: mergedLoans,
      metadata: {
        ...(baselineMonth.metadata ?? {}),
        ...(actualMonth.notes ? { notes: actualMonth.notes } : {}),
      },
    };
  }

  calculateVariance(input: VarianceInput): ProjectionVariance[] {
    return projectionAnalyticsService.calculateVariance(input);
  }

  calculateKPIs(projection: MonthlyProjection[]): ProjectionKPISet {
    return projectionAnalyticsService.calculateKPIs(projection);
  }
}
