import { createFinancialPlanningServiceContract } from "../shared";
import { projectionContextFactory, type ProjectionContext } from "../projectionContext";

import { CASHFLOW_MODULE_KEY } from "./Types";
import type { CashflowPlanningService } from "./Types";

export function createCashflowPlanningService(context: ProjectionContext): CashflowPlanningService {
  return createFinancialPlanningServiceContract(CASHFLOW_MODULE_KEY, context);
}

export const cashflowPlanningService = createCashflowPlanningService(projectionContextFactory.createEmpty());
