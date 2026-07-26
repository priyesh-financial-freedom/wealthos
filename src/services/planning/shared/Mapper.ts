import type {
  FinancialPlanningModuleKey,
  FinancialPlanningModuleMapper,
} from "./Types";

export function createFinancialPlanningModuleMapper<TInput, TOutput = TInput>(
  _module: FinancialPlanningModuleKey,
): FinancialPlanningModuleMapper<TInput, TOutput> {
  return ((input: TInput) => input as unknown as TOutput);
}
