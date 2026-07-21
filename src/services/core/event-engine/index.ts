import { EventBus } from "./EventBus";
import { EventDashboardService } from "./EventDashboardService";
import { EventExecutor } from "./EventExecutor";
import { EventGenerator } from "./EventGenerator";
import { EventHistoryService } from "./EventHistoryService";
import { EventReplayService } from "./EventReplayService";
import { EventRepository } from "./EventRepository";
import { EventScheduler } from "./EventScheduler";
import { EventValidator } from "./EventValidator";
import { FinancialEventEngine } from "./FinancialEventEngine";

const eventRepository = new EventRepository();
const eventGenerator = new EventGenerator();
const eventValidator = new EventValidator({ repository: eventRepository });
const eventScheduler = new EventScheduler();
const eventExecutor = new EventExecutor();
const eventBus = new EventBus();
const eventHistoryService = new EventHistoryService({ repository: eventRepository });
const eventReplayService = new EventReplayService({ repository: eventRepository, executor: eventExecutor, scheduler: eventScheduler });

export const financialEventEngine = new FinancialEventEngine({
  repository: eventRepository,
  generator: eventGenerator,
  validator: eventValidator,
  scheduler: eventScheduler,
  executor: eventExecutor,
  bus: eventBus,
  historyService: eventHistoryService,
});

export const eventDashboardService = new EventDashboardService({
  repository: eventRepository,
  historyService: eventHistoryService,
  replayService: eventReplayService,
});

export {
  EventRepository,
  EventGenerator,
  EventValidator,
  EventScheduler,
  EventExecutor,
  EventReplayService,
  EventBus,
  EventHistoryService,
  FinancialEventEngine,
  EventDashboardService,
};

export type {
  EventHandler,
} from "./EventExecutor";
