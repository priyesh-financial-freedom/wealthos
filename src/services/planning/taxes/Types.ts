import type {
  FinancialPlanningModuleMapper,
  FinancialPlanningModuleRepositoryContract,
  FinancialPlanningModuleServiceContract,
} from "../shared";

export const TAXES_MODULE_KEY = "taxes" as const;

export type TaxesModuleKey = typeof TAXES_MODULE_KEY;

export type TaxesPlanningService = FinancialPlanningModuleServiceContract<TaxesModuleKey>;

export type TaxesPlanningRepository = FinancialPlanningModuleRepositoryContract<TaxesModuleKey>;

export type TaxesPlanningMapper<TInput = unknown, TOutput = TInput> = FinancialPlanningModuleMapper<TInput, TOutput>;
