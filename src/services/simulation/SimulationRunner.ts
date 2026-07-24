import { CURRENT_PLANNING_ASSUMPTION_BASELINE } from "@/services/assumptions";
import { createMonthlyLedgerRecord, type ProjectionContext, type ProjectionMonthState } from "@/services/projection/ProjectionContext";
import { projectionEngine } from "@/services/projection";
import type { MonthlySnapshot, ProjectionScenario } from "@/types/projection";

import type {
  ProjectionCalculator,
  ProjectionCalculatorResult,
  SimulationContext,
} from "./SimulationTypes";
import type {
  SimulationAssetProjection,
  SimulationCashFlowForecast,
  SimulationError,
  SimulationGoalReadiness,
  SimulationLiabilityProjection,
  SimulationMetadata,
  SimulationNetWorthProjection,
  SimulationResult,
  SimulationSummary,
} from "./SimulationOutputs";

const SIMULATION_VERSION = "1.0.0";

function deriveOpeningState(snapshot: SimulationContext["snapshot"]): ProjectionMonthState {
  return snapshot.openingEntities.reduce<ProjectionMonthState>(
    (accumulator, entity) => {
      const amount = Number(entity.closingBalance ?? entity.openingBalance ?? 0);

      if (entity.dimensions.cash) {
        accumulator.cash += amount;
      }

      if (entity.dimensions.investments) {
        if (entity.dimensions.retirement) {
          accumulator.retirementCorpus += amount;
        } else {
          accumulator.investments += amount;
        }
      }

      if (entity.dimensions.assets && !entity.dimensions.cash) {
        accumulator.assets += amount;
      }

      if (entity.dimensions.liabilities) {
        accumulator.liabilities += amount;
      }

      return accumulator;
    },
    { cash: 0, investments: 0, assets: 0, liabilities: 0, retirementCorpus: 0 },
  );
}

function buildEffectiveAssumptions(context: SimulationContext) {
  return {
    ...CURRENT_PLANNING_ASSUMPTION_BASELINE,
    currentAge: CURRENT_PLANNING_ASSUMPTION_BASELINE.currentAge,
    retirementAge: Number(context.resolvedAssumptions.retirement.retirementTargetAge ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.retirementAge),
    salaryGrowthRate: Number(context.resolvedAssumptions.income.salaryGrowthRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.salaryGrowthRate),
    generalInflation: Number(context.resolvedAssumptions.inflation.generalInflationRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.generalInflation),
    medicalInflation: Number(context.resolvedAssumptions.inflation.healthcareInflationRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.medicalInflation),
    educationInflation: Number(context.resolvedAssumptions.inflation.educationInflationRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.educationInflation),
    lifestyleInflation: Number(context.resolvedAssumptions.inflation.retirementInflationRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.lifestyleInflation),
    equityReturn: Number(context.resolvedAssumptions.investments.expectedReturnRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.equityReturn),
    debtReturn: Number(context.resolvedAssumptions.investments.fixedDepositRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.debtReturn),
    goldReturn: Number(context.resolvedAssumptions.investments.goldAppreciationRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.goldReturn),
    realEstateReturn: Number(context.resolvedAssumptions.investments.realEstateAppreciationRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.realEstateReturn),
    homeLoanInterest: Number(context.resolvedAssumptions.loans.averageInterestRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.homeLoanInterest),
    incomeTaxRate: Number(context.resolvedAssumptions.tax.effectiveTaxRate ?? CURRENT_PLANNING_ASSUMPTION_BASELINE.incomeTaxRate),
  };
}

function buildProjectionContext(context: SimulationContext, scenario: ProjectionScenario): ProjectionContext {
  const openingState = deriveOpeningState(context.snapshot);
  const effectiveAssumptions = buildEffectiveAssumptions(context);

  return {
    scenario,
    assumptions: context.resolvedAssumptions,
    effectiveAssumptions,
    assets: [],
    liabilities: [],
    bankAccounts: [],
    investments: [],
    realEstate: [],
    retirementAccounts: [],
    fixedDeposits: [],
    goldHoldings: [],
    silverHoldings: [],
    insurancePolicies: [],
    insuranceAccounts: [],
    incomeSources: [],
    expenses: [],
    goals: [],
    taxes: {
      regime: context.resolvedAssumptions.tax.regime,
      effectiveTaxRate: Number(context.resolvedAssumptions.tax.effectiveTaxRate ?? 0),
      surchargeRate: Number(context.resolvedAssumptions.tax.surchargeRate ?? 0),
      cessRate: Number(context.resolvedAssumptions.tax.cessRate ?? 0),
      note: context.resolvedAssumptions.tax.note,
    },
    familyMembers: [],
    planningHorizon: context.resolvedAssumptions.planning,
    currentDate: new Date(),
    projectionStartDate: context.projectionStart,
    currentMonth: context.projectionStart,
    monthIndex: 0,
    openingSource: { kind: "live-balance-sheet", asOfMonth: context.snapshot.month },
    financialEvents: context.resolvedEvents,
    monthlyLedger: [],
    currentRecord: createMonthlyLedgerRecord(context.projectionStart, effectiveAssumptions.currentAge, openingState),
    currentState: openingState,
  };
}

export class ProjectionEngineSimulationCalculator implements ProjectionCalculator {
  async calculate(context: SimulationContext): Promise<ProjectionCalculatorResult> {
    const scenario: ProjectionScenario = {
      id: context.snapshotId,
      name: "Financial simulation",
      description: "Simulation engine execution",
      startMonth: context.projectionStart,
      planningHorizonYear: Number(context.projectionEnd.slice(0, 4)),
      assumptions: [],
      events: context.resolvedEvents,
      isDefault: false,
    };

    const projectionContext = buildProjectionContext(context, scenario);
    const result = await projectionEngine.run(projectionContext);

    return { timeline: result.timeline, monthlySnapshots: result.snapshots, scenario };
  }
}

export class SimulationRunner {
  constructor(private readonly calculator: ProjectionCalculator = new ProjectionEngineSimulationCalculator()) {}

  async run(context: SimulationContext, startedAt = performance.now()): Promise<SimulationResult> {
    const result = await this.calculator.calculate(context);

    return this.buildResult(context, result, startedAt);
  }

  buildResult(context: SimulationContext, calculation: ProjectionCalculatorResult, startedAt: number): SimulationResult {
    const monthlySnapshots = calculation.monthlySnapshots;
    const executionTime = Math.max(0, performance.now() - startedAt);
    const summary = buildSummary(context.snapshotId, context.projectionStart, context.projectionEnd, monthlySnapshots);
    const cashFlowForecast = buildCashFlowForecast(monthlySnapshots);
    const netWorthProjection = buildNetWorthProjection(monthlySnapshots);
    const assetProjection = buildAssetProjection(monthlySnapshots);
    const liabilityProjection = buildLiabilityProjection(monthlySnapshots);
    const metadata = buildMetadata(context, calculation.timeline.length);

    return {
      summary,
      monthlySnapshots,
      goalReadiness: buildGoalReadiness(),
      cashFlowForecast,
      netWorthProjection,
      assetProjection,
      liabilityProjection,
      metadata,
      executionTime,
      simulationVersion: SIMULATION_VERSION,
    };
  }
}

export function normalizeSimulationError(error: unknown): SimulationError {
  if (isSimulationError(error)) {
    return error;
  }

  return {
    code: "PROJECTION_FAILURE",
    message: error instanceof Error ? error.message : "Simulation failed",
  };
}

export function buildSummary(snapshotId: string, projectionStart: string, projectionEnd: string, monthlySnapshots: MonthlySnapshot[]): SimulationSummary {
  const firstSnapshot = monthlySnapshots[0];
  const lastSnapshot = monthlySnapshots[monthlySnapshots.length - 1];
  const openingNetWorth = Number(firstSnapshot?.openingBalances.netWorth ?? 0);
  const finalNetWorth = Number(lastSnapshot?.closingBalances.netWorth ?? openingNetWorth);

  return {
    snapshotId,
    projectionStart,
    projectionEnd,
    snapshotCount: monthlySnapshots.length,
    openingNetWorth,
    finalNetWorth,
    netWorthChange: finalNetWorth - openingNetWorth,
  };
}

export function buildCashFlowForecast(monthlySnapshots: MonthlySnapshot[]): SimulationCashFlowForecast {
  return {
    points: monthlySnapshots.map((snapshot) => ({
      month: snapshot.month,
      value: Number(snapshot.closingBalances.cash ?? 0),
      delta: Number(snapshot.closingBalances.cash ?? 0) - Number(snapshot.openingBalances.cash ?? 0),
    })),
  };
}

export function buildNetWorthProjection(monthlySnapshots: MonthlySnapshot[]): SimulationNetWorthProjection {
  return {
    points: monthlySnapshots.map((snapshot) => ({
      month: snapshot.month,
      value: Number(snapshot.closingBalances.netWorth ?? 0),
      delta: Number(snapshot.closingBalances.netWorth ?? 0) - Number(snapshot.openingBalances.netWorth ?? 0),
    })),
  };
}

export function buildAssetProjection(monthlySnapshots: MonthlySnapshot[]): SimulationAssetProjection {
  return {
    points: monthlySnapshots.map((snapshot) => ({
      month: snapshot.month,
      value: Number(snapshot.closingBalances.assets ?? 0),
      delta: Number(snapshot.closingBalances.assets ?? 0) - Number(snapshot.openingBalances.assets ?? 0),
    })),
  };
}

export function buildLiabilityProjection(monthlySnapshots: MonthlySnapshot[]): SimulationLiabilityProjection {
  return {
    points: monthlySnapshots.map((snapshot) => ({
      month: snapshot.month,
      value: Number(snapshot.closingBalances.liabilities ?? 0),
      delta: Number(snapshot.closingBalances.liabilities ?? 0) - Number(snapshot.openingBalances.liabilities ?? 0),
    })),
  };
}

export function buildGoalReadiness(): SimulationGoalReadiness {
  return {
    status: "not-evaluated",
    message: "Goal readiness evaluation will be introduced by the planning modules.",
  };
}

export function buildMetadata(context: SimulationContext, timelineMonths: number): SimulationMetadata {
  return {
    snapshotId: context.snapshotId,
    projectionStart: context.projectionStart,
    projectionEnd: context.projectionEnd,
    scenarioOverridesApplied: Boolean(Object.keys(context.scenarioOverrides ?? {}).length),
    assumptionCount: Object.keys(context.resolvedAssumptions).length,
    eventCount: context.resolvedEvents.length,
    timelineMonths,
  };
}

function isSimulationError(error: unknown): error is SimulationError {
  return Boolean(error && typeof error === "object" && "code" in error && "message" in error);
}
