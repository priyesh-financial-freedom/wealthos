import { buildContributionEventsFromAssumptions, buildGrowthEventsFromAssumptions, projectionEngine } from "@/services/projection";
import type { MonthlySnapshot, ProjectionScenario } from "@/types/projection";

import type {
  ProjectionCalculator,
  ProjectionCalculatorResult,
  SimulationContext,
  SimulationError,
  SimulationResult,
  SimulationSeriesPoint,
} from "./SimulationTypes";
import type { SimulationCashFlowForecast, SimulationMetadata, SimulationNetWorthProjection, SimulationAssetProjection, SimulationLiabilityProjection, SimulationGoalReadiness, SimulationSummary } from "./SimulationOutputs";

const SIMULATION_VERSION = "1.0.0";

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

    const timeline = projectionEngine.generateTimeline(scenario);
    const assumptionEvents = [
      ...buildContributionEventsFromAssumptions(context.resolvedAssumptions),
      ...buildGrowthEventsFromAssumptions(context.resolvedAssumptions),
    ];
    const monthlySnapshots = projectionEngine.buildMonthlySnapshots(
      scenario,
      [...assumptionEvents, ...context.resolvedEvents],
      timeline,
      context.snapshot.openingEntities,
    );

    return { timeline, monthlySnapshots, scenario };
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
