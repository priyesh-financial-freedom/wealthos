import type { MonthlyLedger } from "../ledger";
import type { OpeningBalanceSnapshot } from "../openingBalance";
import type { ProjectionContext, ProjectionPlanningInputs } from "../projectionContext";
import type { PlanningTimelinePoint } from "../projections";

import type { PlanningEngineEvent } from "./PlanningEngineEvents";
import type { PlanningEngineState } from "./PlanningEngineState";

export interface PlanningEngineRequest {
  runId?: string;
  asOfDate?: string;
  initiatedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface PlanningEngineContextInput {
  request: PlanningEngineRequest;
  runId: string;
  planningInputs: ProjectionPlanningInputs;
  openingBalanceSnapshot: OpeningBalanceSnapshot;
}

export interface PlanningEngineSimulationInput {
  request: PlanningEngineRequest;
  runId: string;
  projectionContext: ProjectionContext;
  timeline: PlanningTimelinePoint[];
}

export interface PlanningEngineLedgerInput<TSimulation = unknown> {
  request: PlanningEngineRequest;
  runId: string;
  projectionContext: ProjectionContext;
  timeline: PlanningTimelinePoint[];
  simulation: TSimulation;
}

export interface PlanningEngineSummaryInput<TSimulation = unknown> {
  request: PlanningEngineRequest;
  runId: string;
  projectionContext: ProjectionContext;
  timeline: PlanningTimelinePoint[];
  simulation: TSimulation;
  monthlyLedger: MonthlyLedger;
}

export interface PlanningEnginePersistInput<TSimulation = unknown, TSummary = unknown> {
  request: PlanningEngineRequest;
  runId: string;
  projectionContext: ProjectionContext;
  timeline: PlanningTimelinePoint[];
  simulation: TSimulation;
  monthlyLedger: MonthlyLedger;
  summary: TSummary;
}

export interface PlanningEngineDependencies<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
> {
  loadPlanningInputs: (request: PlanningEngineRequest) => Promise<ProjectionPlanningInputs>;
  loadOpeningBalanceSnapshot: (request: PlanningEngineRequest, planningInputs: ProjectionPlanningInputs) => Promise<OpeningBalanceSnapshot>;
  buildProjectionContext: (input: PlanningEngineContextInput) => Promise<ProjectionContext>;
  generateMonthlyTimeline: (projectionContext: ProjectionContext, request: PlanningEngineRequest) => Promise<PlanningTimelinePoint[]>;
  executeMonthlySimulation: (input: PlanningEngineSimulationInput) => Promise<TSimulation>;
  generateMonthlyLedger: (input: PlanningEngineLedgerInput<TSimulation>) => Promise<MonthlyLedger>;
  generateSummary: (input: PlanningEngineSummaryInput<TSimulation>) => Promise<TSummary>;
  persistResults: (input: PlanningEnginePersistInput<TSimulation, TSummary>) => Promise<TPersisted>;
}

export interface PlanningEngineResult<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
> {
  ok: boolean;
  runId: string;
  state: PlanningEngineState<TSimulation, TSummary, TPersisted>;
  events: PlanningEngineEvent[];
  error: string | null;
}
