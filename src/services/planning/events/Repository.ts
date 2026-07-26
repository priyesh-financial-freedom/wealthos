import { createFinancialPlanningRepositoryContract } from "../shared";

import { EVENTS_MODULE_KEY } from "./Types";
import type { EventsPlanningRepository } from "./Types";

export function createEventsPlanningRepository(): EventsPlanningRepository {
  return createFinancialPlanningRepositoryContract(EVENTS_MODULE_KEY);
}

export const eventsPlanningRepository = createEventsPlanningRepository();
