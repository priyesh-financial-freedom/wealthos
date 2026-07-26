import type { ProjectionContext } from "../projectionContext/Types";

export type FinancialPlanningModuleKey =
  | "projectionContext"
  | "inputs"
  | "openingBalance"
  | "assumptions"
  | "projections"
  | "ledger"
  | "events"
  | "goals"
  | "retirement"
  | "taxes"
  | "cashflow"
  | "reports";

export interface FinancialPlanningModuleMetadata<TModule extends FinancialPlanningModuleKey = FinancialPlanningModuleKey> {
  domain: "financialPlanning";
  module: TModule;
}

export interface FinancialPlanningModuleServiceContract<TModule extends FinancialPlanningModuleKey = FinancialPlanningModuleKey> {
  metadata: FinancialPlanningModuleMetadata<TModule>;
  context: ProjectionContext;
}

export interface FinancialPlanningModuleRepositoryContract<TModule extends FinancialPlanningModuleKey = FinancialPlanningModuleKey> {
  metadata: FinancialPlanningModuleMetadata<TModule>;
}

export interface FinancialPlanningValidationIssue {
  field: string;
  message: string;
}

export type FinancialPlanningModuleMapper<TInput, TOutput> = (
  input: TInput,
) => TOutput;
