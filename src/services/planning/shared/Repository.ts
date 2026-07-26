import type {
  FinancialPlanningModuleKey,
  FinancialPlanningModuleRepositoryContract,
} from "./Types";

export function createFinancialPlanningRepositoryContract<
  TModule extends FinancialPlanningModuleKey,
>(module: TModule): FinancialPlanningModuleRepositoryContract<TModule> {
  return {
    metadata: {
      domain: "financialPlanning",
      module,
    },
  };
}
