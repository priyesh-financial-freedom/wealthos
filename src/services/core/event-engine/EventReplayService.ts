import type { EventReplayRequest, EventReplayResult, FinancialEvent, FinancialEventExecution } from "@/types/financialEvent";

import { EventExecutor } from "./EventExecutor";
import { EventRepository } from "./EventRepository";
import { EventScheduler } from "./EventScheduler";

interface EventReplayServiceDependencies {
  repository?: Pick<EventRepository, "listEventsByDate" | "updateEvent" | "createExecutionLog">;
  executor?: EventExecutor;
  scheduler?: EventScheduler;
}

export class EventReplayService {
  constructor(private readonly dependencies: EventReplayServiceDependencies = {}) {}

  private get repository() {
    return this.dependencies.repository ?? new EventRepository();
  }

  private get executor() {
    return this.dependencies.executor ?? new EventExecutor();
  }

  private get scheduler() {
    return this.dependencies.scheduler ?? new EventScheduler();
  }

  async replay(request: EventReplayRequest): Promise<EventReplayResult> {
    const dryRun = request.dryRun ?? true;
    const persistResults = request.persistResults ?? false;

    const rows = await this.repository.listEventsByDate(request.dateFrom, request.dateTo, {
      statuses: request.includeStatuses,
      limit: 5000,
    });

    const ordered = this.scheduler.deterministicOrder(rows);
    const executionLogs: FinancialEventExecution[] = [];
    const warnings: string[] = [];
    let executed = 0;
    let failed = 0;

    for (let index = 0; index < ordered.length; index += 1) {
      const event = ordered[index] as FinancialEvent;
      const executionStart = new Date();
      const result = await this.executor.execute(event);
      const executionEnd = new Date();
      const durationMs = Math.max(0, executionEnd.getTime() - executionStart.getTime());

      if (result.success) {
        executed += 1;
      } else {
        failed += 1;
      }

      warnings.push(...result.warnings);
      request.onProgress?.({ completed: index + 1, total: ordered.length, eventId: event.id });

      if (!dryRun && persistResults) {
        const persistedEventStatus = result.success ? "EXECUTED" : "FAILED";
        await this.repository.updateEvent(event.id, {
          status: persistedEventStatus,
          executedAt: result.success ? executionEnd.toISOString() : event.executedAt,
        });

        const executionLog = await this.repository.createExecutionLog({
          eventId: event.id,
          executionStart: executionStart.toISOString(),
          executionEnd: executionEnd.toISOString(),
          durationMs,
          result: result.result,
          warnings: result.warnings,
          errorMessage: result.errorMessage,
          retryCount: result.retryable ? 1 : 0,
        });

        executionLogs.push(executionLog);
      }
    }

    return {
      dryRun,
      total: ordered.length,
      executed,
      failed,
      warnings,
      executionLogs,
    };
  }
}
