import { createFinancialPlanningRepositoryContract } from "../shared";

import { REPORTS_MODULE_KEY } from "./Types";
import type { ReportsPlanningRepository } from "./Types";

export function createReportsPlanningRepository(): ReportsPlanningRepository {
  return createFinancialPlanningRepositoryContract(REPORTS_MODULE_KEY);
}

export const reportsPlanningRepository = createReportsPlanningRepository();
