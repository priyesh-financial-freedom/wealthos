import { ProjectionContextFactory, projectionContextFactory } from "../projectionContext";
import { buildDeterministicPlanningRunId } from "../shared";

import type {
  PlanningEngineDependencies,
  PlanningEngineRequest,
  PlanningEngineResult,
} from "./PlanningEngineResult";
import type { PlanningEngineEvent, PlanningEngineStep } from "./PlanningEngineEvents";
import { NoopPlanningEngineLogger, type PlanningEngineLogger } from "./PlanningEngineLogger";
import type { PlanningEngineIssue, PlanningEngineState } from "./PlanningEngineState";

interface PlanningEngineRuntimeDependencies<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
> {
  projectionContextFactory?: ProjectionContextFactory;
  logger?: PlanningEngineLogger;
  now?: () => Date;
  createRunId?: (request: PlanningEngineRequest) => string;
  orchestrators: PlanningEngineDependencies<TSimulation, TSummary, TPersisted>;
}

interface PipelineContext<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
> {
  request: PlanningEngineRequest;
  state: PlanningEngineState<TSimulation, TSummary, TPersisted>;
  events: PlanningEngineEvent[];
}

interface PipelineStep<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
> {
  id: PlanningEngineStep;
  run: (context: PipelineContext<TSimulation, TSummary, TPersisted>) => Promise<void>;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toVersionString(value: unknown): string {
  if (value === null || value === undefined) {
    return "unknown";
  }

  const text = String(value).trim();
  return text.length > 0 ? text : "unknown";
}

function planningInputVersion(planningInputs: Record<string, unknown>): string {
  const entries = Object.entries(planningInputs)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      const version = value && typeof value === "object"
        ? (value as Record<string, unknown>).version
        : undefined;

      return `${key}:${toVersionString(version)}`;
    });

  return entries.join(",");
}

function toIssue(step: string, error: unknown): PlanningEngineIssue {
  return {
    step,
    message: normalizeError(error),
  };
}

export class PlanningEngine<
  TSimulation = unknown,
  TSummary = unknown,
  TPersisted = unknown,
> {
  private readonly orchestrators: PlanningEngineDependencies<TSimulation, TSummary, TPersisted>;

  private readonly logger: PlanningEngineLogger;

  private readonly now: () => Date;

  private readonly createRunId: (request: PlanningEngineRequest) => string;

  private readonly contextFactory: ProjectionContextFactory;

  constructor(dependencies: PlanningEngineRuntimeDependencies<TSimulation, TSummary, TPersisted>) {
    this.orchestrators = dependencies.orchestrators;
    this.logger = dependencies.logger ?? new NoopPlanningEngineLogger();
    this.now = dependencies.now ?? (() => new Date());
    this.contextFactory = dependencies.projectionContextFactory ?? projectionContextFactory;
    this.createRunId = dependencies.createRunId ?? (() => "planning-run-pending");
  }

  async run(request: PlanningEngineRequest = {}): Promise<PlanningEngineResult<TSimulation, TSummary, TPersisted>> {
    const runId = request.runId ?? this.createRunId(request);
    const startedAt = this.now().toISOString();

    const state: PlanningEngineState<TSimulation, TSummary, TPersisted> = {
      runId,
      status: "running",
      stage: "pipeline",
      startedAt,
      finishedAt: null,
      planningInputs: null,
      openingBalanceSnapshot: null,
      projectionContext: null,
      timeline: [],
      simulation: null,
      monthlyLedger: null,
      summary: null,
      persistedResult: null,
      issues: [],
      error: null,
    };

    const context: PipelineContext<TSimulation, TSummary, TPersisted> = {
      request,
      state,
      events: [],
    };

    this.emit(context, {
      type: "pipeline-started",
      step: "pipeline",
      at: startedAt,
      message: "Planning engine pipeline started.",
      metadata: { runId },
    });

    try {
      for (const step of this.buildPipeline()) {
        await this.runStep(step, context);
      }

      context.state.status = "completed";
      context.state.stage = "pipeline";
      context.state.finishedAt = this.now().toISOString();

      this.emit(context, {
        type: "pipeline-completed",
        step: "pipeline",
        at: context.state.finishedAt,
        message: "Planning engine pipeline completed.",
        metadata: { runId },
      });

      return {
        ok: true,
        runId,
        state: context.state,
        events: context.events,
        error: null,
      };
    } catch (error) {
      const normalizedError = normalizeError(error);
      const failedAt = this.now().toISOString();

      context.state.status = "failed";
      context.state.finishedAt = failedAt;
      context.state.error = normalizedError;
      context.state.issues = [...context.state.issues, toIssue(context.state.stage, error)];

      this.emit(context, {
        type: "pipeline-failed",
        step: "pipeline",
        at: failedAt,
        message: "Planning engine pipeline failed.",
        metadata: { runId, error: normalizedError },
      });

      return {
        ok: false,
        runId,
        state: context.state,
        events: context.events,
        error: normalizedError,
      };
    }
  }

  private buildPipeline(): Array<PipelineStep<TSimulation, TSummary, TPersisted>> {
    return [
      {
        id: "load-planning-inputs",
        run: async (context) => {
          context.state.planningInputs = await this.orchestrators.loadPlanningInputs(context.request);
        },
      },
      {
        id: "load-opening-balance",
        run: async (context) => {
          const inputs = context.state.planningInputs;
          if (!inputs) {
            throw new Error("Planning inputs are missing before opening balance load.");
          }

          context.state.openingBalanceSnapshot = await this.orchestrators.loadOpeningBalanceSnapshot(
            context.request,
            inputs,
          );
        },
      },
      {
        id: "build-projection-context",
        run: async (context) => {
          const inputs = context.state.planningInputs;
          const snapshot = context.state.openingBalanceSnapshot;
          if (!inputs || !snapshot) {
            throw new Error("Inputs or opening balance snapshot is missing before projection context build.");
          }

          const projectionContext = await this.orchestrators.buildProjectionContext({
            request: context.request,
            runId: context.state.runId,
            planningInputs: inputs,
            openingBalanceSnapshot: snapshot,
          });

          const deterministicRunId = buildDeterministicPlanningRunId({
            planningInputVersion: planningInputVersion(inputs as Record<string, unknown>),
            openingSnapshotVersion: toVersionString(snapshot.version),
            scenarioId: toVersionString(projectionContext.scenario?.id),
            projectionStart: projectionContext.projectionStartDate,
            projectionEnd: projectionContext.projectionEndDate,
          });

          context.state.runId = deterministicRunId;

          // Defensive serialization roundtrip check to keep context shape stable.
          const serialized = this.contextFactory.toSerializable(projectionContext);
          serialized.runId = deterministicRunId;
          const rebuilt = this.contextFactory.fromSerializable(serialized);
          if (!rebuilt.context) {
            throw new Error("Projection context validation failed after serialization roundtrip.");
          }

          context.state.projectionContext = rebuilt.context;
        },
      },
      {
        id: "generate-monthly-timeline",
        run: async (context) => {
          const projectionContext = context.state.projectionContext;
          if (!projectionContext) {
            throw new Error("Projection context is missing before timeline generation.");
          }

          context.state.timeline = await this.orchestrators.generateMonthlyTimeline(
            projectionContext,
            context.request,
          );
        },
      },
      {
        id: "execute-monthly-simulation",
        run: async (context) => {
          const projectionContext = context.state.projectionContext;
          if (!projectionContext) {
            throw new Error("Projection context is missing before simulation.");
          }

          context.state.simulation = await this.orchestrators.executeMonthlySimulation({
            request: context.request,
            runId: context.state.runId,
            projectionContext,
            timeline: context.state.timeline,
          });
        },
      },
      {
        id: "generate-monthly-ledger",
        run: async (context) => {
          const projectionContext = context.state.projectionContext;
          const simulation = context.state.simulation;
          if (!projectionContext || simulation === null) {
            throw new Error("Projection context or simulation output is missing before ledger generation.");
          }

          context.state.monthlyLedger = await this.orchestrators.generateMonthlyLedger({
            request: context.request,
            runId: context.state.runId,
            projectionContext,
            timeline: context.state.timeline,
            simulation,
          });
        },
      },
      {
        id: "generate-summary",
        run: async (context) => {
          const projectionContext = context.state.projectionContext;
          const simulation = context.state.simulation;
          const monthlyLedger = context.state.monthlyLedger;

          if (!projectionContext || simulation === null || !monthlyLedger) {
            throw new Error("Projection context, simulation, or ledger is missing before summary generation.");
          }

          context.state.summary = await this.orchestrators.generateSummary({
            request: context.request,
            runId: context.state.runId,
            projectionContext,
            timeline: context.state.timeline,
            simulation,
            monthlyLedger,
          });
        },
      },
      {
        id: "persist-results",
        run: async (context) => {
          const projectionContext = context.state.projectionContext;
          const simulation = context.state.simulation;
          const monthlyLedger = context.state.monthlyLedger;
          const summary = context.state.summary;

          if (!projectionContext || simulation === null || !monthlyLedger || summary === null) {
            throw new Error("Required state is missing before persistence.");
          }

          context.state.persistedResult = await this.orchestrators.persistResults({
            request: context.request,
            runId: context.state.runId,
            projectionContext,
            timeline: context.state.timeline,
            simulation,
            monthlyLedger,
            summary,
          });
        },
      },
    ];
  }

  private async runStep(
    step: PipelineStep<TSimulation, TSummary, TPersisted>,
    context: PipelineContext<TSimulation, TSummary, TPersisted>,
  ): Promise<void> {
    context.state.stage = step.id;

    const startedAt = this.now().toISOString();
    this.emit(context, {
      type: "step-started",
      step: step.id,
      at: startedAt,
      message: `Step started: ${step.id}`,
    });

    try {
      await step.run(context);

      const completedAt = this.now().toISOString();
      this.emit(context, {
        type: "step-completed",
        step: step.id,
        at: completedAt,
        message: `Step completed: ${step.id}`,
      });
    } catch (error) {
      const failedAt = this.now().toISOString();
      const normalizedError = normalizeError(error);
      context.state.error = normalizedError;
      context.state.issues = [...context.state.issues, toIssue(step.id, error)];

      this.emit(context, {
        type: "step-failed",
        step: step.id,
        at: failedAt,
        message: `Step failed: ${step.id}`,
        metadata: { error: normalizedError },
      });

      throw error;
    }
  }

  private emit(
    context: PipelineContext<TSimulation, TSummary, TPersisted>,
    event: PlanningEngineEvent,
  ): void {
    context.events.push(event);

    if (event.type === "pipeline-failed" || event.type === "step-failed") {
      this.logger.error(event);
      return;
    }

    if (event.type === "pipeline-started" || event.type === "pipeline-completed") {
      this.logger.info(event);
      return;
    }

    this.logger.debug(event);
  }
}
