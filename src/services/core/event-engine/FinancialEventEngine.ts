import type {
  EventExecutionCreateInput,
  EventExecutionResult,
  EventValidationResult,
  FinancialEvent,
  FinancialEventCreateInput,
} from "@/types/financialEvent";

import { EventBus } from "./EventBus";
import { EventExecutor } from "./EventExecutor";
import { EventGenerator } from "./EventGenerator";
import { EventHistoryService } from "./EventHistoryService";
import { EventRepository } from "./EventRepository";
import { EventScheduler } from "./EventScheduler";
import { EventValidator } from "./EventValidator";

interface FinancialEventEngineDependencies {
  repository?: EventRepository;
  generator?: EventGenerator;
  validator?: EventValidator;
  scheduler?: EventScheduler;
  executor?: EventExecutor;
  bus?: EventBus;
  historyService?: EventHistoryService;
  now?: () => Date;
}

export interface FinancialEventEngineRunInput {
  dateFrom?: string;
  dateTo?: string;
  dryRun?: boolean;
  persistGeneratedEvents?: boolean;
  executeDueEvents?: boolean;
}

export interface FinancialEventEngineRunResult {
  generatedCount: number;
  validatedCount: number;
  persistedCount: number;
  scheduledCount: number;
  executedCount: number;
  failedCount: number;
  validationFailures: Array<{ event: FinancialEventCreateInput; validation: EventValidationResult }>;
  executionResults: Array<{ event: FinancialEvent; result: EventExecutionResult }>;
  executionLogs: EventExecutionCreateInput[];
}

export class FinancialEventEngine {
  private readonly eventBus: EventBus;

  constructor(private readonly dependencies: FinancialEventEngineDependencies = {}) {
    this.eventBus = this.dependencies.bus ?? new EventBus();
    this.eventBus.registerDefaultSubscribers();
  }

  private get repository() {
    return this.dependencies.repository ?? new EventRepository();
  }

  private get generator() {
    return this.dependencies.generator ?? new EventGenerator();
  }

  private get validator() {
    return this.dependencies.validator ?? new EventValidator({ repository: this.repository });
  }

  private get scheduler() {
    return this.dependencies.scheduler ?? new EventScheduler();
  }

  private get executor() {
    return this.dependencies.executor ?? new EventExecutor();
  }

  private get bus() {
    return this.eventBus;
  }

  private get historyService() {
    return this.dependencies.historyService ?? new EventHistoryService({ repository: this.repository });
  }

  private get now() {
    return this.dependencies.now ?? (() => new Date());
  }

  async run(input: FinancialEventEngineRunInput = {}): Promise<FinancialEventEngineRunResult> {
    const dryRun = input.dryRun ?? false;
    const persistGeneratedEvents = input.persistGeneratedEvents ?? true;
    const executeDueEvents = input.executeDueEvents ?? true;

    const generatedSeeds = await this.generator.generate({ dateFrom: input.dateFrom, dateTo: input.dateTo });
    const expanded = this.scheduler.expandRecurringEvents(generatedSeeds);

    const validationFailures: Array<{ event: FinancialEventCreateInput; validation: EventValidationResult }> = [];
    const validInputs: FinancialEventCreateInput[] = [];

    for (const candidate of expanded) {
      const validation = await this.validator.validateCreateInput(candidate);
      if (!validation.valid) {
        validationFailures.push({ event: candidate, validation });
        continue;
      }
      validInputs.push(candidate);
    }

    let persistedEvents: FinancialEvent[] = [];
    if (!dryRun && persistGeneratedEvents) {
      for (const item of validInputs) {
        const created = await this.repository.createEvent(item);
        persistedEvents.push(created);
      }
    } else {
      const auth = await this.repository.getAuthenticatedUser();
      persistedEvents = validInputs.map((item) => this.scheduler.toTransientEvent(item, auth.user.id));
    }

    const due = executeDueEvents
      ? persistedEvents.filter((event) => new Date(event.scheduledAt).getTime() <= this.now().getTime())
      : [];

    const executionResults: Array<{ event: FinancialEvent; result: EventExecutionResult }> = [];
    const executionLogs: EventExecutionCreateInput[] = [];

    for (const event of this.scheduler.deterministicOrder(due)) {
      const startedAt = new Date();
      const result = await this.executor.execute(event);
      const endedAt = new Date();
      const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());

      executionResults.push({ event, result });

      const log: EventExecutionCreateInput = {
        eventId: event.id,
        executionStart: startedAt.toISOString(),
        executionEnd: endedAt.toISOString(),
        durationMs,
        result: result.result,
        warnings: result.warnings,
        errorMessage: result.errorMessage,
        retryCount: result.retryable ? 1 : 0,
      };
      executionLogs.push(log);

      if (!dryRun && persistGeneratedEvents) {
        await this.repository.updateEvent(event.id, {
          status: result.success ? "EXECUTED" : "FAILED",
          executedAt: result.success ? endedAt.toISOString() : event.executedAt,
        });

        await this.repository.createExecutionLog(log);
      }

      if (result.success) {
        await this.bus.publish("decision-engine", {
          type: "EVENT_EXECUTED",
          event,
          emittedAt: endedAt.toISOString(),
          metadata: result.result,
        });
      } else {
        await this.bus.publish("decision-engine", {
          type: "EVENT_FAILED",
          event,
          emittedAt: endedAt.toISOString(),
          metadata: {
            errorMessage: result.errorMessage,
            warnings: result.warnings,
          },
        });
      }
    }

    return {
      generatedCount: generatedSeeds.length,
      validatedCount: validInputs.length,
      persistedCount: persistedEvents.length,
      scheduledCount: persistedEvents.length,
      executedCount: executionResults.filter((entry) => entry.result.success).length,
      failedCount: executionResults.filter((entry) => !entry.result.success).length,
      validationFailures,
      executionResults,
      executionLogs,
    };
  }

  async timeline(params?: { page?: number; pageSize?: number; status?: FinancialEvent["status"] | "ALL" }) {
    return this.historyService.getTimeline(
      { status: params?.status },
      {
        page: params?.page,
        pageSize: params?.pageSize,
      },
    );
  }
}
