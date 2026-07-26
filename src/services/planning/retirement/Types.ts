import type {
  FinancialPlanningModuleMapper,
  FinancialPlanningModuleRepositoryContract,
  FinancialPlanningModuleServiceContract,
} from "../shared";

export const RETIREMENT_MODULE_KEY = "retirement" as const;

export type RetirementModuleKey = typeof RETIREMENT_MODULE_KEY;

export type RetirementPlanningService = FinancialPlanningModuleServiceContract<RetirementModuleKey>;

export type RetirementPlanningRepository = FinancialPlanningModuleRepositoryContract<RetirementModuleKey>;

export type RetirementPlanningMapper<TInput = unknown, TOutput = TInput> = FinancialPlanningModuleMapper<TInput, TOutput>;
