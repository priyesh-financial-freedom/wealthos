import type {
  FinancialPlanningModuleMapper,
  FinancialPlanningModuleRepositoryContract,
  FinancialPlanningModuleServiceContract,
} from "../shared";

export const EVENTS_MODULE_KEY = "events" as const;

export type EventsModuleKey = typeof EVENTS_MODULE_KEY;

export type EventsPlanningService = FinancialPlanningModuleServiceContract<EventsModuleKey>;

export type EventsPlanningRepository = FinancialPlanningModuleRepositoryContract<EventsModuleKey>;

export type EventsPlanningMapper<TInput = unknown, TOutput = TInput> = FinancialPlanningModuleMapper<TInput, TOutput>;
