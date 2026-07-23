import type { AssumptionsBundle } from "@/types/assumptions";
import type { ProjectionTimelinePoint } from "@/services/projection";
import type { MonthlySnapshot, ProjectedEntity, ProjectionBalanceState, ProjectionScenario, FinancialEvent } from "@/types/projection";

export interface SimulationSnapshot {
  id: string;
  month: string;
  openingBalances: ProjectionBalanceState;
  openingEntities: ProjectedEntity[];
}

export interface SimulationScenarioOverrides {
  assumptions?: Partial<AssumptionsBundle>;
  events?: FinancialEvent[];
  projectionStart?: string;
  projectionEnd?: string;
  metadata?: Record<string, unknown>;
}

export interface SimulationRequest {
  snapshotId: string;
  projectionStart?: string;
  projectionEnd?: string;
  scenarioOverrides?: SimulationScenarioOverrides;
}

export interface SnapshotProvider {
  loadSnapshot(snapshotId: string): Promise<SimulationSnapshot | null>;
}

export interface AssumptionProvider {
  loadAssumptions(snapshotId: string): Promise<AssumptionsBundle | null>;
}

export interface EventProvider {
  loadEvents(snapshotId: string): Promise<FinancialEvent[]>;
}

export interface SimulationInput {
  snapshotId: string;
  assumptions: AssumptionsBundle;
  events: FinancialEvent[];
  projectionStart: string;
  projectionEnd: string;
  scenarioOverrides: SimulationScenarioOverrides;
}

export interface SimulationContext extends SimulationInput {
  snapshot: SimulationSnapshot;
  scenario: ProjectionScenario;
  timeline: ProjectionTimelinePoint[];
  monthlySnapshots: MonthlySnapshot[];
  resolvedAssumptions: AssumptionsBundle;
  resolvedEvents: FinancialEvent[];
}

export interface ProjectionCalculatorResult {
  timeline: ProjectionTimelinePoint[];
  monthlySnapshots: MonthlySnapshot[];
  scenario: ProjectionScenario;
}

export interface ProjectionCalculator {
  calculate(context: SimulationContext): Promise<ProjectionCalculatorResult>;
}
