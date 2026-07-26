import type {
  FinancialPlanningModuleMapper,
  FinancialPlanningModuleRepositoryContract,
  FinancialPlanningModuleServiceContract,
} from "../shared";

export const GOALS_MODULE_KEY = "goals" as const;

export type GoalsModuleKey = typeof GOALS_MODULE_KEY;

export type GoalsPlanningService = FinancialPlanningModuleServiceContract<GoalsModuleKey>;

export type GoalsPlanningRepository = FinancialPlanningModuleRepositoryContract<GoalsModuleKey>;

export type GoalsPlanningMapper<TInput = unknown, TOutput = TInput> = FinancialPlanningModuleMapper<TInput, TOutput>;
