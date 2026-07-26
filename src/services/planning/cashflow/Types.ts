import type {
  FinancialPlanningModuleMapper,
  FinancialPlanningModuleRepositoryContract,
  FinancialPlanningModuleServiceContract,
} from "../shared";

export const CASHFLOW_MODULE_KEY = "cashflow" as const;

export type CashflowModuleKey = typeof CASHFLOW_MODULE_KEY;

export type CashflowPlanningService = FinancialPlanningModuleServiceContract<CashflowModuleKey>;

export type CashflowPlanningRepository = FinancialPlanningModuleRepositoryContract<CashflowModuleKey>;

export type CashflowPlanningMapper<TInput = unknown, TOutput = TInput> = FinancialPlanningModuleMapper<TInput, TOutput>;
