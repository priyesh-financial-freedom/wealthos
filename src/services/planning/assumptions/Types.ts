import type {
  FinancialPlanningModuleMapper,
  FinancialPlanningModuleRepositoryContract,
  FinancialPlanningModuleServiceContract,
} from "../shared";

export const ASSUMPTIONS_MODULE_KEY = "assumptions" as const;

export type AssumptionsModuleKey = typeof ASSUMPTIONS_MODULE_KEY;

export type AssumptionsPlanningService = FinancialPlanningModuleServiceContract<AssumptionsModuleKey>;

export type AssumptionsPlanningRepository = FinancialPlanningModuleRepositoryContract<AssumptionsModuleKey>;

export type AssumptionsPlanningMapper<TInput = unknown, TOutput = TInput> = FinancialPlanningModuleMapper<TInput, TOutput>;
