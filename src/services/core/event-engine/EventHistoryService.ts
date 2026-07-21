import type { FinancialEvent, FinancialEventExecution, FinancialEventFilters, FinancialEventListOptions, FinancialEventListResult } from "@/types/financialEvent";

import { EventRepository } from "./EventRepository";

interface EventHistoryServiceDependencies {
  repository?: Pick<EventRepository, "listEvents" | "getExecutionHistory">;
}

export interface EventAuditHistoryItem {
  event: FinancialEvent;
  executions: FinancialEventExecution[];
}

export class EventHistoryService {
  constructor(private readonly dependencies: EventHistoryServiceDependencies = {}) {}

  private get repository() {
    return this.dependencies.repository ?? new EventRepository();
  }

  async getTimeline(filters: FinancialEventFilters = {}, options: FinancialEventListOptions = {}): Promise<FinancialEventListResult> {
    return this.repository.listEvents(filters, options);
  }

  async getExecutionHistory(eventId?: string, options: FinancialEventListOptions = {}): Promise<FinancialEventExecution[]> {
    return this.repository.getExecutionHistory(eventId, options);
  }

  async getFailedEvents(options: FinancialEventListOptions = {}): Promise<FinancialEventListResult> {
    return this.repository.listEvents({ status: "FAILED" }, options);
  }

  async getAuditHistory(filters: FinancialEventFilters = {}, options: FinancialEventListOptions = {}): Promise<EventAuditHistoryItem[]> {
    const timeline = await this.repository.listEvents(filters, options);
    const histories = await Promise.all(
      timeline.rows.map(async (event) => ({
        event,
        executions: await this.repository.getExecutionHistory(event.id, { page: 1, pageSize: 25 }),
      })),
    );

    return histories;
  }
}
