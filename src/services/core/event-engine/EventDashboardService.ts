import type {
  EventReplayRequest,
  FinancialEvent,
  FinancialEventDashboardSummary,
  FinancialEventFilters,
  FinancialEventListOptions,
  FinancialEventListResult,
} from "@/types/financialEvent";

import { endOfMonthIso, startOfMonthIso } from "./dateUtils";
import { EventHistoryService } from "./EventHistoryService";
import { EventReplayService } from "./EventReplayService";
import { EventRepository } from "./EventRepository";

interface EventDashboardServiceDependencies {
  repository?: Pick<EventRepository, "listEvents" | "listPendingEvents" | "listEventsByDate" | "getEvent">;
  historyService?: EventHistoryService;
  replayService?: EventReplayService;
  now?: () => Date;
}

export class EventDashboardService {
  constructor(private readonly dependencies: EventDashboardServiceDependencies = {}) {}

  private get repository() {
    return this.dependencies.repository ?? new EventRepository();
  }

  private get historyService() {
    return this.dependencies.historyService ?? new EventHistoryService({ repository: this.repository as EventRepository });
  }

  private get replayService() {
    return this.dependencies.replayService ?? new EventReplayService({ repository: this.repository as EventRepository });
  }

  private get now() {
    return this.dependencies.now ?? (() => new Date());
  }

  async getDashboard(params: {
    filters?: FinancialEventFilters;
    options?: FinancialEventListOptions;
  } = {}): Promise<{ summary: FinancialEventDashboardSummary; timeline: FinancialEventListResult }> {
    const now = this.now();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const [pending, executedToday, failed, upcoming, timeline] = await Promise.all([
      this.repository.listPendingEvents(now.toISOString(), 5000),
      this.repository.listEventsByDate(todayStart.toISOString(), todayEnd.toISOString(), { statuses: ["EXECUTED"], limit: 5000 }),
      this.historyService.getFailedEvents({ page: 1, pageSize: 1 }),
      this.repository.listEventsByDate(startOfMonthIso(now), endOfMonthIso(now), { statuses: ["PENDING", "SCHEDULED"], limit: 5000 }),
      this.historyService.getTimeline(params.filters, params.options),
    ]);

    return {
      summary: {
        pendingEvents: pending.length,
        executedToday: executedToday.length,
        failedEvents: failed.total,
        upcomingThisMonth: upcoming.length,
      },
      timeline,
    };
  }

  async getEventDetail(eventId: string): Promise<{ event: FinancialEvent | null; executions: Awaited<ReturnType<EventHistoryService["getExecutionHistory"]>> }> {
    const event = await this.repository.getEvent(eventId);
    const executions = await this.historyService.getExecutionHistory(eventId, { page: 1, pageSize: 100 });
    return { event, executions };
  }

  async replay(request: EventReplayRequest) {
    return this.replayService.replay(request);
  }
}
