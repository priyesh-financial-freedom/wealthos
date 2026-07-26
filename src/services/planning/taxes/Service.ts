import { createFinancialPlanningServiceContract } from "../shared";
import { projectionContextFactory, type ProjectionContext } from "../projectionContext";

import { TAXES_MODULE_KEY } from "./Types";
import type { TaxesPlanningService } from "./Types";

export function createTaxesPlanningService(context: ProjectionContext): TaxesPlanningService {
  return createFinancialPlanningServiceContract(TAXES_MODULE_KEY, context);
}

export const taxesPlanningService = createTaxesPlanningService(projectionContextFactory.createEmpty());
