import { createFinancialPlanningModuleMapper } from "../shared";

import { EVENTS_MODULE_KEY } from "./Types";
import type { EventsPlanningMapper } from "./Types";

export function createEventsMapper<TInput = unknown, TOutput = TInput>(): EventsPlanningMapper<TInput, TOutput> {
  return createFinancialPlanningModuleMapper<TInput, TOutput>(EVENTS_MODULE_KEY);
}

export const mapEventsPayload = createEventsMapper();
