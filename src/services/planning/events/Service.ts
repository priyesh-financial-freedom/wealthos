import { createFinancialPlanningServiceContract } from "../shared";
import { projectionContextFactory, type ProjectionContext } from "../projectionContext";

import { EVENTS_MODULE_KEY } from "./Types";
import type { EventsPlanningService } from "./Types";

export function createEventsPlanningService(context: ProjectionContext): EventsPlanningService {
  return createFinancialPlanningServiceContract(EVENTS_MODULE_KEY, context);
}

export const eventsPlanningService = createEventsPlanningService(projectionContextFactory.createEmpty());
