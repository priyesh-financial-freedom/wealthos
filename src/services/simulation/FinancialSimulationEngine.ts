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

    try {
      const snapshot = await this.dependencies.snapshotProvider.loadSnapshot(request.snapshotId);
      if (!snapshot) {
        return this.failure({ code: "MISSING_SNAPSHOT", message: `Snapshot ${request.snapshotId} could not be loaded.` });
      }

      const assumptions = await this.dependencies.assumptionProvider.loadAssumptions(request.snapshotId);
      if (!assumptions) {
        return this.failure({ code: "MISSING_ASSUMPTIONS", message: `Assumptions for snapshot ${request.snapshotId} could not be loaded.` });
      }

      const loadedEvents = await this.dependencies.eventProvider.loadEvents(request.snapshotId);
      const input = buildSimulationInput(request, assumptions, loadedEvents);
      const context = buildSimulationContext(input, snapshot);
      const runner = this.dependencies.runner ?? new SimulationRunner();
      const result = await runner.run(context, startedAt);

      return { ok: true, result };
    } catch (error) {
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
