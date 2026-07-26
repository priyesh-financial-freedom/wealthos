import type { MonthlyLedger } from "../ledger";
import type { OpeningBalanceSnapshot } from "../openingBalance";
import type { ProjectionContext, ProjectionPlanningInputs } from "../projectionContext";
import type { PlanningTimelinePoint } from "../projections";

export type PlanningEngineStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

export interface PlanningEngineIssue {
  step: string;
  message: string;
  field?: string;
}

export interface PlanningEngineState<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
> {
  runId: string;
  status: PlanningEngineStatus;
  stage: string;
  startedAt: string;
  finishedAt: string | null;
  planningInputs: ProjectionPlanningInputs | null;
  openingBalanceSnapshot: OpeningBalanceSnapshot | null;
  projectionContext: ProjectionContext | null;
  timeline: PlanningTimelinePoint[];
  simulation: TSimulation | null;
  monthlyLedger: MonthlyLedger | null;
  summary: TSummary | null;
  persistedResult: TPersisted | null;
  issues: PlanningEngineIssue[];
  error: string | null;
}
