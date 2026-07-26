import { createFinancialPlanningServiceContract } from "../shared";
import { projectionContextFactory, type ProjectionContext } from "../projectionContext";

import { REPORTS_MODULE_KEY } from "./Types";
import type { ReportsPlanningService } from "./Types";

export function createReportsPlanningService(context: ProjectionContext): ReportsPlanningService {
  return createFinancialPlanningServiceContract(REPORTS_MODULE_KEY, context);
}

export const reportsPlanningService = createReportsPlanningService(projectionContextFactory.createEmpty());
