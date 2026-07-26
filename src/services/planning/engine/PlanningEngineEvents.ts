export const PLANNING_ENGINE_STEPS = [
  "load-planning-inputs",
  "load-opening-balance",
  "build-projection-context",
  "generate-monthly-timeline",
  "execute-monthly-simulation",
  "generate-monthly-ledger",
  "generate-summary",
  "persist-results",
] as const;

export type PlanningEngineStep = (typeof PLANNING_ENGINE_STEPS)[number];

export type PlanningEngineEventType =
  | "pipeline-started"
  | "pipeline-completed"
  | "pipeline-failed"
  | "step-started"
  | "step-completed"
  | "step-failed";

export interface PlanningEngineEvent {
  type: PlanningEngineEventType;
  step: PlanningEngineStep | "pipeline";
  at: string;
  message: string;
  metadata?: Record<string, unknown>;
}
