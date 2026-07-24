import type { GoalPriority } from "@/types/financialGoal";

export type PlanningAssumptionCategoryKey =
  | "PERSONAL"
  | "INCOME"
  | "INFLATION"
  | "INVESTMENTS"
  | "LOANS"
  | "TAXES"
  | "RETIREMENT";

export type PlanningScenarioPreset = "BASE" | "CONSERVATIVE" | "OPTIMISTIC" | "CUSTOM";

export type LoanPrepaymentStrategy = "NONE" | "AVALANCHE" | "SNOWBALL" | "HYBRID";

export type PlanningAssumptionUnit = "years" | "percent" | "currency" | "months" | "strategy" | "priority";

export type PlanningAssumptionEngineId =
  | "PROJECTION_ENGINE"
  | "RETIREMENT_PLANNING"
  | "GOAL_PROBABILITY_ANALYSIS"
  | "CASH_FLOW_FORECASTING"
  | "FAMILY_WEALTH_TIMELINE"
  | "AI_FINANCIAL_ADVISOR"
  | "EXECUTIVE_DASHBOARD";

export type PlanningAssumptionDependency =
  | "longevity"
  | "salary"
  | "goal-cost-escalation"
  | "retirement-corpus"
  | "tax-drag"
  | "debt-cost"
  | "asset-return"
  | "liquidity-buffer";

export interface EffectivePlanningAssumptions {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  spouseLifeExpectancy: number;
  salaryGrowthRate: number;
  bonusGrowthRate: number;
  businessIncomeGrowth: number;
  rentalIncomeGrowth: number;
  otherIncomeGrowth: number;
  generalInflation: number;
  medicalInflation: number;
  educationInflation: number;
  lifestyleInflation: number;
  propertyInflation: number;
  luxuryInflation: number;
  equityReturn: number;
  debtReturn: number;
  goldReturn: number;
  silverReturn: number;
  realEstateReturn: number;
  cashReturn: number;
  epfReturn: number;
  ppfReturn: number;
  npsEquityReturn: number;
  npsDebtReturn: number;
  homeLoanInterest: number;
  carLoanInterest: number;
  personalLoanInterest: number;
  loanPrepaymentStrategy: LoanPrepaymentStrategy;
  incomeTaxRate: number;
  capitalGainsTax: number;
  dividendTax: number;
  rentalTaxRate: number;
  withdrawalRate: number;
  retirementExpenseRatio: number;
  legacyTarget: number;
  emergencyCorpusMonths: number;
  goalFundingPriority: GoalPriority;
}

export type PlanningAssumptionKey = keyof EffectivePlanningAssumptions;

export type PlanningAssumptionOverrides = Partial<EffectivePlanningAssumptions>;

export interface PlanningAssumptionRecord extends PlanningAssumptionOverrides {
  id: string;
  userId: string;
  scenarioId: string | null;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningScenarioSummary {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: string;
  preset: PlanningScenarioPreset;
}

export interface PlanningGoalSummary {
  id: string;
  name: string;
  linkedScenarioId: string | null;
  priority: GoalPriority;
}

export interface PlanningFamilyProfile {
  primaryDateOfBirth: string | null;
  spouseDateOfBirth: string | null;
  primaryCurrentAge: number;
  spouseCurrentAge: number | null;
  updatedAt: string | null;
}

export type PlanningAssumptionScopeSelection =
  | { level: "USER_DEFAULTS" }
  | { level: "SCENARIO"; scenarioId: string }
  | { level: "GOAL"; goalId: string; scenarioId?: string | null };

export type PlanningAssumptionInheritanceLevel = 1 | 2 | 3 | 4;

export type PlanningAssumptionProvenanceSource =
  | "SYSTEM_DEFAULT"
  | "USER_DEFAULT"
  | "SCENARIO_OVERRIDE"
  | "GOAL_OVERRIDE";

export interface PlanningAssumptionProvenance<Key extends PlanningAssumptionKey = PlanningAssumptionKey> {
  key: Key;
  source: PlanningAssumptionProvenanceSource;
  inheritanceLevel: PlanningAssumptionInheritanceLevel;
  overrideActive: boolean;
  inheritedFromKey: Key | null;
  scopeId: string | null;
  category: PlanningAssumptionCategoryKey;
  unit: PlanningAssumptionUnit;
  dependencies: readonly PlanningAssumptionDependency[];
  affectedEngines: readonly PlanningAssumptionEngineId[];
}

export type ResolvedPlanningAssumptionFieldMap = {
  [Key in PlanningAssumptionKey]: {
    value: EffectivePlanningAssumptions[Key];
    provenance: PlanningAssumptionProvenance<Key>;
  };
};

export interface EffectivePlanningAssumptionResult {
  values: EffectivePlanningAssumptions;
  fields: ResolvedPlanningAssumptionFieldMap;
}

export interface PlanningAssumptionDocumentationItem {
  key: PlanningAssumptionKey;
  label: string;
  category: PlanningAssumptionCategoryKey;
  description: string;
  tooltip: string;
  helpContent: PlanningAssumptionHelpContent;
  unit: PlanningAssumptionUnit;
  dependencies: readonly PlanningAssumptionDependency[];
  affectedEngines: readonly PlanningAssumptionEngineId[];
}

export interface PlanningAssumptionHelpContent {
  shortDescription: string;
  detailedExplanation: string;
  whyItMatters: string;
  recommendedRange: string;
  defaultValue: string;
  exampleCalculation?: string;
  effectOfIncrease: string;
  effectOfDecrease: string;
}

export interface PlanningAssumptionEditorState {
  scope: PlanningAssumptionScopeSelection;
  scenarios: PlanningScenarioSummary[];
  activeScenarioId: string | null;
  goal: PlanningGoalSummary | null;
  familyProfile: PlanningFamilyProfile;
  effective: EffectivePlanningAssumptionResult;
  inherited: EffectivePlanningAssumptions;
  recommended: EffectivePlanningAssumptions;
  overrides: PlanningAssumptionOverrides;
  documentation: readonly PlanningAssumptionDocumentationItem[];
}

export interface PlanningAssumptionFieldOption {
  label: string;
  value: string;
}

export type PlanningAssumptionInputKind = "integer" | "percentage" | "currency" | "select";

export interface PlanningAssumptionFieldDefinition {
  key: PlanningAssumptionKey;
  category: PlanningAssumptionCategoryKey;
  label: string;
  description: string;
  tooltip: string;
  helpContent: PlanningAssumptionHelpContent;
  inputKind: PlanningAssumptionInputKind;
  unit: PlanningAssumptionUnit;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly PlanningAssumptionFieldOption[];
}

export interface PlanningAssumptionRegistryItem extends PlanningAssumptionFieldDefinition {
  defaultValue: EffectivePlanningAssumptions[PlanningAssumptionKey];
  recommendedValue: EffectivePlanningAssumptions[PlanningAssumptionKey];
  dependencies: readonly PlanningAssumptionDependency[];
  affectedEngines: readonly PlanningAssumptionEngineId[];
}

export interface PlanningAssumptionSectionDefinition {
  category: PlanningAssumptionCategoryKey;
  label: string;
  description: string;
  fieldKeys: readonly PlanningAssumptionKey[];
}

export const PLANNING_ASSUMPTION_KEYS = [
  "retirementAge",
  "lifeExpectancy",
  "spouseLifeExpectancy",
  "salaryGrowthRate",
  "bonusGrowthRate",
  "businessIncomeGrowth",
  "rentalIncomeGrowth",
  "otherIncomeGrowth",
  "generalInflation",
  "medicalInflation",
  "educationInflation",
  "lifestyleInflation",
  "propertyInflation",
  "luxuryInflation",
  "equityReturn",
  "debtReturn",
  "goldReturn",
  "silverReturn",
  "realEstateReturn",
  "cashReturn",
  "epfReturn",
  "ppfReturn",
  "npsEquityReturn",
  "npsDebtReturn",
  "homeLoanInterest",
  "carLoanInterest",
  "personalLoanInterest",
  "loanPrepaymentStrategy",
  "incomeTaxRate",
  "capitalGainsTax",
  "dividendTax",
  "rentalTaxRate",
  "withdrawalRate",
  "retirementExpenseRatio",
  "legacyTarget",
  "emergencyCorpusMonths",
  "goalFundingPriority",
] as const satisfies readonly PlanningAssumptionKey[];

export const DISPLAY_PLANNING_ASSUMPTION_KEYS = [
  "retirementAge",
  "lifeExpectancy",
  "spouseLifeExpectancy",
  "salaryGrowthRate",
  "bonusGrowthRate",
  "businessIncomeGrowth",
  "rentalIncomeGrowth",
  "otherIncomeGrowth",
  "generalInflation",
  "medicalInflation",
  "educationInflation",
  "lifestyleInflation",
  "propertyInflation",
  "luxuryInflation",
  "equityReturn",
  "debtReturn",
  "goldReturn",
  "silverReturn",
  "realEstateReturn",
  "cashReturn",
  "epfReturn",
  "ppfReturn",
  "npsEquityReturn",
  "npsDebtReturn",
  "homeLoanInterest",
  "carLoanInterest",
  "personalLoanInterest",
  "loanPrepaymentStrategy",
  "incomeTaxRate",
  "capitalGainsTax",
  "dividendTax",
  "rentalTaxRate",
  "withdrawalRate",
  "retirementExpenseRatio",
  "legacyTarget",
  "emergencyCorpusMonths",
] as const satisfies readonly PlanningAssumptionKey[];

export const PLANNING_ASSUMPTION_COLUMN_BY_KEY = {
  retirementAge: "retirement_age",
  lifeExpectancy: "life_expectancy",
  spouseLifeExpectancy: "spouse_life_expectancy",
  salaryGrowthRate: "salary_growth_rate",
  bonusGrowthRate: "bonus_growth_rate",
  businessIncomeGrowth: "business_income_growth",
  rentalIncomeGrowth: "rental_income_growth",
  otherIncomeGrowth: "other_income_growth",
  generalInflation: "general_inflation",
  medicalInflation: "medical_inflation",
  educationInflation: "education_inflation",
  lifestyleInflation: "lifestyle_inflation",
  propertyInflation: "property_inflation",
  luxuryInflation: "luxury_inflation",
  equityReturn: "equity_return",
  debtReturn: "debt_return",
  goldReturn: "gold_return",
  silverReturn: "silver_return",
  realEstateReturn: "real_estate_return",
  cashReturn: "cash_return",
  epfReturn: "epf_return",
  ppfReturn: "ppf_return",
  npsEquityReturn: "nps_equity_return",
  npsDebtReturn: "nps_debt_return",
  homeLoanInterest: "home_loan_interest",
  carLoanInterest: "car_loan_interest",
  personalLoanInterest: "personal_loan_interest",
  loanPrepaymentStrategy: "loan_prepayment_strategy",
  incomeTaxRate: "income_tax_rate",
  capitalGainsTax: "capital_gains_tax",
  dividendTax: "dividend_tax",
  rentalTaxRate: "rental_tax_rate",
  withdrawalRate: "withdrawal_rate",
  retirementExpenseRatio: "retirement_expense_ratio",
  legacyTarget: "legacy_target",
  emergencyCorpusMonths: "emergency_corpus_months",
  goalFundingPriority: "goal_funding_priority",
} as const satisfies Record<(typeof PLANNING_ASSUMPTION_KEYS)[number], string>;
