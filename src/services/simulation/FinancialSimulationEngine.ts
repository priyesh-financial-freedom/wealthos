import type { AssumptionsBundle } from "@/types/assumptions";
import type { FinancialEvent } from "@/types/projection";

import type { SimulationInput, SimulationRequest, SnapshotProvider, AssumptionProvider, EventProvider, SimulationContext } from "./SimulationTypes";
import { SimulationRunner, normalizeSimulationError } from "./SimulationRunner";
import type { SimulationOutcome, SimulationError } from "./SimulationOutputs";

export interface FinancialSimulationEngineDependencies {
  snapshotProvider: SnapshotProvider;
  assumptionProvider: AssumptionProvider;
  eventProvider: EventProvider;
  runner?: SimulationRunner;
}

export class FinancialSimulationEngine {
  constructor(private readonly dependencies: FinancialSimulationEngineDependencies) {}

  async run(request: SimulationRequest): Promise<SimulationOutcome> {
    const startedAt = performance.now();
    const traceStartedAt = Date.now();
    console.log("[FinancialSimulationEngine] run start", { snapshotId: request.snapshotId });

    try {
      console.log("[FinancialSimulationEngine] before snapshotProvider.loadSnapshot", { snapshotId: request.snapshotId });
      const snapshot = await this.dependencies.snapshotProvider.loadSnapshot(request.snapshotId);
      console.log("[FinancialSimulationEngine] after snapshotProvider.loadSnapshot", {
        durationMs: Date.now() - traceStartedAt,
        hasSnapshot: Boolean(snapshot),
      });
      if (!snapshot) {
        return this.failure({ code: "MISSING_SNAPSHOT", message: `Snapshot ${request.snapshotId} could not be loaded.` });
      }

      console.log("[FinancialSimulationEngine] before assumptionProvider.loadAssumptions", { snapshotId: request.snapshotId });
      const assumptions = await this.dependencies.assumptionProvider.loadAssumptions(request.snapshotId);
      console.log("[FinancialSimulationEngine] after assumptionProvider.loadAssumptions", {
        durationMs: Date.now() - traceStartedAt,
        hasAssumptions: Boolean(assumptions),
      });
      if (!assumptions) {
        return this.failure({ code: "MISSING_ASSUMPTIONS", message: `Assumptions for snapshot ${request.snapshotId} could not be loaded.` });
      }

      console.log("[FinancialSimulationEngine] before eventProvider.loadEvents", { snapshotId: request.snapshotId });
      const loadedEvents = await this.dependencies.eventProvider.loadEvents(request.snapshotId);
      console.log("[FinancialSimulationEngine] after eventProvider.loadEvents", {
        durationMs: Date.now() - traceStartedAt,
        eventsCount: loadedEvents.length,
      });
      const input = buildSimulationInput(request, assumptions, loadedEvents);
      const context = buildSimulationContext(input, snapshot);
      const runner = this.dependencies.runner ?? new SimulationRunner();
      console.log("[FinancialSimulationEngine] before runner.run", { snapshotId: request.snapshotId });
      const result = await runner.run(context, startedAt);
      console.log("[FinancialSimulationEngine] after runner.run", {
        durationMs: Date.now() - traceStartedAt,
      });

      console.log("[FinancialSimulationEngine] run complete", {
        snapshotId: request.snapshotId,
        durationMs: Date.now() - traceStartedAt,
      });
      return { ok: true, result };
    } catch (error) {
      console.error("[FinancialSimulationEngine] run error", {
        snapshotId: request.snapshotId,
        durationMs: Date.now() - traceStartedAt,
        error,
      });
      const normalized = normalizeSimulationError(error);
      return { ok: false, error: normalized };
    }
  }

  private failure(error: SimulationError): SimulationOutcome {
    return { ok: false, error };
  }
}

export function buildSimulationInput(request: SimulationRequest, assumptions: AssumptionsBundle, events: FinancialEvent[]): SimulationInput {
  const projectionStart = request.scenarioOverrides?.projectionStart ?? request.projectionStart ?? assumptions.planning.startMonth;
  const projectionEnd = request.scenarioOverrides?.projectionEnd ?? request.projectionEnd ?? `${assumptions.planning.endYear}-${String(assumptions.planning.endMonth).padStart(2, "0")}`;

  if (!isValidMonthKey(projectionStart) || !isValidMonthKey(projectionEnd)) {
    throw <SimulationError>{ code: "INVALID_OVERRIDES", message: "Projection start and end must be YYYY-MM month keys." };
  }

  return {
    snapshotId: request.snapshotId,
    assumptions,
    events,
    projectionStart,
    projectionEnd,
    scenarioOverrides: request.scenarioOverrides ?? {},
  };
}

export function buildSimulationContext(input: SimulationInput, snapshot: { id: string; month: string; openingBalances: import("@/types/projection").ProjectionBalanceState; openingEntities: import("@/types/projection").ProjectedEntity[]; }): SimulationContext {
  const resolvedAssumptions = applyAssumptionOverrides(input.assumptions, input.scenarioOverrides?.assumptions);
  const resolvedEvents = [...input.events, ...(input.scenarioOverrides?.events ?? [])];

  return {
    ...input,
    snapshot,
    assumptions: input.assumptions,
    resolvedAssumptions,
    resolvedEvents,
    scenario: {
      id: input.snapshotId,
      name: "Financial simulation",
      description: "Simulation request",
      startMonth: input.scenarioOverrides?.projectionStart ?? input.projectionStart,
      planningHorizonYear: Number((input.scenarioOverrides?.projectionEnd ?? input.projectionEnd).slice(0, 4)),
      assumptions: [],
      events: resolvedEvents,
      isDefault: false,
    },
    timeline: [],
    monthlySnapshots: [],
  };
}

export function applyAssumptionOverrides(base: AssumptionsBundle, overrides?: Partial<AssumptionsBundle>): AssumptionsBundle {
  if (!overrides) {
    return base;
  }

  return {
    ...base,
    ...overrides,
    planning: { ...base.planning, ...overrides.planning },
    income: { ...base.income, ...overrides.income },
    investments: { ...base.investments, ...overrides.investments },
    inflation: { ...base.inflation, ...overrides.inflation },
    loans: { ...base.loans, ...overrides.loans },
    retirement: { ...base.retirement, ...overrides.retirement },
    tax: { ...base.tax, ...overrides.tax },
  };
}

function isValidMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}
