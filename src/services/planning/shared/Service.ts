import type {
  FinancialPlanningModuleKey,
  FinancialPlanningModuleServiceContract,
} from "./Types";
import type { ProjectionContext } from "../projectionContext/Types";

export function createFinancialPlanningServiceContract<
  TModule extends FinancialPlanningModuleKey,
>(module: TModule, context: ProjectionContext): FinancialPlanningModuleServiceContract<TModule> {
  return {
    metadata: {
      domain: "financialPlanning",
      module,
    },
    context,
  };
}
