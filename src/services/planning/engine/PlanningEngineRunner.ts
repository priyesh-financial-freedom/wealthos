import { PlanningEngine } from "./PlanningEngine";
import type {
  PlanningEngineDependencies,
  PlanningEngineRequest,
  PlanningEngineResult,
} from "./PlanningEngineResult";
import type { PlanningEngineLogger } from "./PlanningEngineLogger";

export interface PlanningEngineRunnerDependencies<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
> {
  orchestrators: PlanningEngineDependencies<TSimulation, TSummary, TPersisted>;
  logger?: PlanningEngineLogger;
  now?: () => Date;
  createRunId?: (request: PlanningEngineRequest) => string;
}

export class PlanningEngineRunner<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
> {
  constructor(
    private readonly engine: PlanningEngine<TSimulation, TSummary, TPersisted>,
  ) {}

  run(
    request: PlanningEngineRequest = {},
  ): Promise<PlanningEngineResult<TSimulation, TSummary, TPersisted>> {
    return this.engine.run(request);
  }
}

export function createPlanningEngineRunner<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
>(
  dependencies: PlanningEngineRunnerDependencies<TSimulation, TSummary, TPersisted>,
): PlanningEngineRunner<TSimulation, TSummary, TPersisted> {
  const engine = new PlanningEngine<TSimulation, TSummary, TPersisted>({
    orchestrators: dependencies.orchestrators,
    logger: dependencies.logger,
    now: dependencies.now,
    createRunId: dependencies.createRunId,
  });

  return new PlanningEngineRunner(engine);
}
