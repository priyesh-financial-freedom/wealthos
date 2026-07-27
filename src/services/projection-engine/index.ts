export { ProjectionEngine } from "./engine";
export {
  FINANCIAL_RULE_STEP_ORDER,
  type FinancialRule,
  type FinancialRuleExecutionInput,
  type FinancialRuleFamily,
  type FinancialRuleStep,
} from "./rules/contracts";
export { FinancialRuleRegistry } from "./rules/registry";
export { createDefaultFinancialRuleRegistry } from "./rules/defaultRegistry";
export { MonthlyProjectionDomainState } from "./rules/state";
export {
  createDefaultProductRegistry,
  HomeLoanProduct,
  MutualFundProduct,
  NPSProduct,
  PPFProduct,
  ProductRegistry,
  PropertyProduct,
  SalaryProduct,
} from "./products";
export { createProjectionContext, monthKeyForContextIndex } from "./context";
export { addMonths, compareMonthKeys, parseMonthKey, toMonthKey } from "./calendar";
export { calculateMonthlyEventImpact } from "./events";
export {
  ProjectionAnalyticsService,
  calculateAchievementPercent,
  calculateProjectionKPIs,
  calculateProjectionVariance,
  calculateTrendMetrics,
  projectionAnalyticsService,
} from "./analytics";
export { MONTHLY_CALCULATION_PIPELINE, normalizeBalances, runMonthlyPipeline } from "./pipeline";
export { normalizeAssumptions, buildMonthlyAssumptions, annualRateToMonthlyRate } from "./assumptions";
export { calculateContribution, calculateContributionFromRules } from "./contributions";
export { calculateGrowthFromRates, calculateInvestmentGrowth } from "./growth";
export { calculateLoansForMonth } from "./loans";
export type {
  ActualMonthInput,
  ActualMonthlyData,
  AssetPosition,
  BaselineProjectionInput,
  ContributionRule,
  ContributionRuleType,
  ExpenseCategory,
  FinancialPlanDescriptor,
  GrowthRule,
  GrowthTarget,
  IncomeSource,
  LiabilityPosition,
  LoanAssumption,
  LoanState,
  MonthlyAssumptionSet,
  MonthlyPipelineStep,
  MonthlyProjection,
  ProjectionAnalytics,
  ProjectionActivity,
  ProjectionAssumptions,
  ProjectionBalances,
  ProjectionContext,
  ProjectionEvent,
  ProjectionEventCategory,
  ProjectionEventFrequency,
  ProjectionKPISet,
  ProjectionMonthState,
  ProjectionPeriod,
  ProjectionTrendMetrics,
  ProjectionVersion,
  ProjectionVersionKind,
  ProjectionVariance,
  RollingProjectionInput,
  VarianceInput,
} from "./types";
export type {
  FinancialProduct,
  HomeLoanProductData,
  LoanPrepaymentDefinition,
  MutualFundProductData,
  MutualFundSIPDefinition,
  NPSContributionDefinition,
  NPSProductData,
  PPFContributionDefinition,
  PPFProductData,
  ProductValidationIssue,
  ProductValidationResult,
  PropertyAssetDefinition,
  PropertyProductData,
  SalaryProductData,
} from "./products";