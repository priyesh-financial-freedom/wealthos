export type AssumptionSection = "income" | "investments" | "inflation" | "loans" | "retirement" | "tax" | "planning";

export enum AssumptionCategoryKey {
  Income = "INCOME",
  Inflation = "INFLATION",
  InvestmentReturns = "INVESTMENT_RETURNS",
  Retirement = "RETIREMENT",
  Tax = "TAX",
  Loans = "LOANS",
  EmergencyPlanning = "EMERGENCY_PLANNING",
  Market = "MARKET",
}

export enum AssumptionDataType {
  Number = "NUMBER",
  Percentage = "PERCENTAGE",
  Currency = "CURRENCY",
  Integer = "INTEGER",
  Boolean = "BOOLEAN",
  Text = "TEXT",
  Month = "MONTH",
  Enum = "ENUM",
}

export enum AssumptionValueSource {
  System = "SYSTEM",
  User = "USER",
  Imported = "IMPORTED",
}

export interface AssumptionCategory {
  id: string;
  key: AssumptionCategoryKey;
  name: string;
  description: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Assumption {
  id: string;
  categoryId: string;
  key: string;
  name: string;
  description: string | null;
  dataType: AssumptionDataType;
  unit: string | null;
  defaultValue: unknown;
  minimum: number | null;
  maximum: number | null;
  helpText: string | null;
  required: boolean;
  isActive: boolean;
  advancedOnly: boolean;
  allowedValues: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssumptionProfile {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssumptionValue {
  id: string;
  userId: string;
  profileId: string;
  assumptionId: string;
  value: unknown;
  source: AssumptionValueSource;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyVersion {
  id: string;
  userId: string;
  profileId: string;
  versionNumber: number;
  versionName: string;
  notes: string | null;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

export interface AssumptionWithValue extends Assumption {
  category: AssumptionCategory;
  currentValue: unknown;
  valueId: string | null;
}

export interface ProfileComparisonItem {
  assumptionId: string;
  assumptionKey: string;
  assumptionName: string;
  categoryKey: AssumptionCategoryKey;
  leftValue: unknown;
  rightValue: unknown;
}

export interface ValidationIssue {
  assumptionId: string;
  assumptionKey: string;
  message: string;
}

export interface ProfileValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface IncomeAssumptions {
  monthlyIncome: number;
  annualIncrementRate: number;
  salaryGrowthRate: number;
  bonusAmount: number;
  bonusMonth: number;
  otherMonthlyIncome: number;
  salaryStopMonth: number;
  salaryStopYear: number;
}

export interface InvestmentAssumptions {
  monthlySipAmount: number;
  stockInvestmentAmount: number;
  annualIncrementRate: number;
  expectedReturnRate: number;
  fixedDepositRate: number;
  goldAppreciationRate: number;
  realEstateAppreciationRate: number;
}

export interface InflationAssumptions {
  generalInflationRate: number;
  educationInflationRate: number;
  healthcareInflationRate: number;
  retirementInflationRate: number;
}

export interface LoanAssumptions {
  averageInterestRate: number;
  emiIncrementRate: number;
  annualPrepaymentAmount: number;
  annualPrepaymentMonth: number;
  useExtraCashForPrepayment: boolean;
}

export interface RetirementAssumptions {
  epfEmployeeContributionRate: number;
  epfEmployerContributionRate: number;
  npsContributionRate: number;
  ppfMonthlyContribution: number;
  retirementTargetAge: number;
  salaryStopMonth: number;
  salaryStopYear: number;
}

export interface TaxAssumptions {
  regime: "old" | "new" | "custom";
  effectiveTaxRate: number;
  surchargeRate: number;
  cessRate: number;
  note: string;
}

export interface PlanningHorizon {
  startMonth: string;
  endYear: number;
  endMonth: number;
}

export interface AssumptionsBundle {
  income: IncomeAssumptions;
  investments: InvestmentAssumptions;
  inflation: InflationAssumptions;
  loans: LoanAssumptions;
  retirement: RetirementAssumptions;
  tax: TaxAssumptions;
  planning: PlanningHorizon;
}

export type AssumptionPayload =
  | IncomeAssumptions
  | InvestmentAssumptions
  | InflationAssumptions
  | LoanAssumptions
  | RetirementAssumptions
  | TaxAssumptions
  | PlanningHorizon;

export interface AssumptionRecord {
  id: string;
  section: AssumptionSection;
  scenarioKey: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}