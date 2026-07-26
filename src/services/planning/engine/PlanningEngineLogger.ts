import type { PlanningEngineEvent } from "./PlanningEngineEvents";

export interface PlanningEngineLogger {
  debug(event: PlanningEngineEvent): void;
  info(event: PlanningEngineEvent): void;
  warn(event: PlanningEngineEvent): void;
  error(event: PlanningEngineEvent): void;
}

export class NoopPlanningEngineLogger implements PlanningEngineLogger {
  debug(_event: PlanningEngineEvent): void {}

  info(_event: PlanningEngineEvent): void {}

  warn(_event: PlanningEngineEvent): void {}

  error(_event: PlanningEngineEvent): void {}
}

export class ConsolePlanningEngineLogger implements PlanningEngineLogger {
  debug(event: PlanningEngineEvent): void {
    console.debug(`[PlanningEngine] ${event.type}`, event);
  }

  info(event: PlanningEngineEvent): void {
    console.info(`[PlanningEngine] ${event.type}`, event);
  }

  warn(event: PlanningEngineEvent): void {
    console.warn(`[PlanningEngine] ${event.type}`, event);
  }

  error(event: PlanningEngineEvent): void {
    console.error(`[PlanningEngine] ${event.type}`, event);
  }
}
