import type {
  FinancialPlanningModuleMapper,
  FinancialPlanningModuleRepositoryContract,
  FinancialPlanningModuleServiceContract,
} from "../shared";

export const REPORTS_MODULE_KEY = "reports" as const;

export type ReportsModuleKey = typeof REPORTS_MODULE_KEY;

export type ReportsPlanningService = FinancialPlanningModuleServiceContract<ReportsModuleKey>;

export type ReportsPlanningRepository = FinancialPlanningModuleRepositoryContract<ReportsModuleKey>;

export type ReportsPlanningMapper<TInput = unknown, TOutput = TInput> = FinancialPlanningModuleMapper<TInput, TOutput>;
