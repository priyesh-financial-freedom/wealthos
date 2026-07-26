import type {
  FinancialPlanningModuleMapper,
  FinancialPlanningModuleRepositoryContract,
  FinancialPlanningModuleServiceContract,
} from "../shared";

export const PROJECTIONS_MODULE_KEY = "projections" as const;

export type ProjectionsModuleKey = typeof PROJECTIONS_MODULE_KEY;

export type ProjectionsPlanningService = FinancialPlanningModuleServiceContract<ProjectionsModuleKey>;

export type ProjectionsPlanningRepository = FinancialPlanningModuleRepositoryContract<ProjectionsModuleKey>;

export type ProjectionsPlanningMapper<TInput = unknown, TOutput = TInput> = FinancialPlanningModuleMapper<TInput, TOutput>;
