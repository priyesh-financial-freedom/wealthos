import type { MonthlySnapshot } from "@/types/projection";

export type SimulationErrorCode = "MISSING_SNAPSHOT" | "MISSING_ASSUMPTIONS" | "INVALID_OVERRIDES" | "PROJECTION_FAILURE";

export interface SimulationError {
  code: SimulationErrorCode;
  message: string;
  details?: string;
}

export interface SimulationSeriesPoint {
  month: string;
  value: number;
  delta: number;
}

export interface SimulationSummary {
  snapshotId: string;
  projectionStart: string;
  projectionEnd: string;
  snapshotCount: number;
  openingNetWorth: number;
  finalNetWorth: number;
  netWorthChange: number;
}

export interface SimulationGoalReadiness {
  status: "not-evaluated";
  message: string;
}

export interface SimulationCashFlowForecast {
  points: SimulationSeriesPoint[];
}

export interface SimulationNetWorthProjection {
  points: SimulationSeriesPoint[];
}

export interface SimulationAssetProjection {
  points: SimulationSeriesPoint[];
}

export interface SimulationLiabilityProjection {
  points: SimulationSeriesPoint[];
}

export interface SimulationMetadata {
  snapshotId: string;
  projectionStart: string;
  projectionEnd: string;
  scenarioOverridesApplied: boolean;
  assumptionCount: number;
  eventCount: number;
  timelineMonths: number;
}

export interface SimulationResult {
  summary: SimulationSummary;
  monthlySnapshots: MonthlySnapshot[];
  goalReadiness: SimulationGoalReadiness;
  cashFlowForecast: SimulationCashFlowForecast;
  netWorthProjection: SimulationNetWorthProjection;
  assetProjection: SimulationAssetProjection;
  liabilityProjection: SimulationLiabilityProjection;
  metadata: SimulationMetadata;
  executionTime: number;
  simulationVersion: string;
}

export type SimulationOutcome =
  | { ok: true; result: SimulationResult }
  | { ok: false; error: SimulationError };
