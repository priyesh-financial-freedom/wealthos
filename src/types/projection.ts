export type ProjectionModule =
  | "assets"
  | "bank-accounts"
  | "investments"
  | "fixed-deposits"
  | "gold"
  | "silver"
  | "real-estate"
  | "retirement"
  | "liabilities"
  | "goals"
  | "cash-flow";

export type ProjectionEventType =
  | "opening-balance"
  | "monthly-contribution"
  | "annual-increment"
  | "salary-growth"
  | "bonus"
  | "epf-contribution"
  | "nps-contribution"
  | "ppf-contribution"
  | "mutual-fund-sip"
  | "stock-investment"
  | "fixed-deposit"
  | "mutual-fund-growth"
  | "stock-growth"
  | "fixed-deposit-growth"
  | "epf-growth"
  | "ppf-growth"
  | "nps-growth"
  | "gold-appreciation"
  | "silver-appreciation"
  | "real-estate-appreciation"
  | "loan-emi"
  | "loan-prepayment"
  | "retirement-stop-salary"
  | "goal-funding"
  | "inflation"
  | "cash-flow"
  | "one-time-event";

export type ProjectionFrequency = "monthly" | "quarterly" | "annual" | "yearly" | "custom" | "one-time";

export interface ProjectionCustomRecurrence {
  intervalMonths?: number | null;
  monthsOfYear?: number[];
}

export interface ProjectionEventMetadata {
  balanceField?: keyof ProjectionBalanceState;
  balanceDelta?: Partial<ProjectionBalanceState>;
  customRecurrence?: ProjectionCustomRecurrence;
  contributionTarget?: "cash" | "investments" | "retirement" | "assets" | "liabilities";
  growthTarget?: "cash" | "investments" | "retirement" | "assets" | "liabilities";
  annualRate?: number;
  monthlyRate?: number;
  allocationShare?: number;
  source?: "assumption" | "event";
  [key: string]: unknown;
}

export interface FinancialAssumption {
  id: string;
  module: ProjectionModule;
  name: string;
  description?: string;
  annualRate?: number | null;
  monthlyRate?: number | null;
  amount?: number | null;
  frequency?: ProjectionFrequency;
  startsOn?: string | null;
  endsOn?: string | null;
  isEnabled: boolean;
}

export interface FinancialEvent {
  id: string;
  module: ProjectionModule;
  type: ProjectionEventType;
  name: string;
  amount: number;
  date: string;
  frequency?: ProjectionFrequency;
  repeatEveryMonths?: number | null;
  startsOn?: string | null;
  endsOn?: string | null;
  isEnabled: boolean;
  metadata?: ProjectionEventMetadata;
}

export interface MonthlyLedgerEntry {
  eventId: string;
  eventName: string;
  eventType: ProjectionEventType;
  module: ProjectionModule;
  month: string;
  amount: number;
  entryType: "contribution" | "growth";
  source: "assumption" | "event";
  target: "cash" | "investments" | "retirement" | "assets" | "liabilities";
  annualRate?: number;
  monthlyRate?: number;
  baseAmount?: number;
}

export type ProjectedEntityKind =
  | "bank-account"
  | "mutual-fund"
  | "stock"
  | "gold"
  | "silver"
  | "fixed-deposit"
  | "epf"
  | "ppf"
  | "nps"
  | "real-estate"
  | "other-asset"
  | "home-loan"
  | "car-loan"
  | "other-liability";

export interface ProjectionBalanceDimensions {
  assets: boolean;
  liabilities: boolean;
  investments: boolean;
  retirement: boolean;
  cash: boolean;
}

export interface ProjectedEntity {
  id: string;
  kind: ProjectedEntityKind;
  name: string;
  month: string;
  openingBalance: number;
  contributionActivity: number;
  growthActivity: number;
  otherActivity: number;
  closingBalance: number;
  dimensions: ProjectionBalanceDimensions;
}

export interface MonthlySnapshot {
  id: string;
  scenarioId: string;
  month: string;
  openingBalance: number;
  closingBalance: number;
  contributions: number;
  growth: number;
  loanPrincipalReduction: number;
  goalFunding: number;
  inflationImpact: number;
  eventsApplied: string[];
  monthlyLedger: MonthlyLedgerEntry[];
  projectedEntities: ProjectedEntity[];
  openingBalances: ProjectionBalanceState;
  closingBalances: ProjectionBalanceState;
}

export interface ProjectionBalanceState {
  assets: number;
  liabilities: number;
  investments: number;
  retirement: number;
  cash: number;
  netWorth: number;
}

export interface MonthlyActual {
  id: string;
  month: string;
  openingBalance?: number | null;
  closingBalance: number;
  contributions?: number | null;
  growth?: number | null;
  loanPrincipalReduction?: number | null;
  goalFunding?: number | null;
  notes?: string | null;
}

export interface MonthlyVariance {
  month: string;
  projected: MonthlySnapshot;
  actual: MonthlyActual;
  closingBalanceVariance: number;
  contributionVariance: number;
  growthVariance: number;
  loanPrincipalVariance: number;
  goalFundingVariance: number;
}

export interface ProjectionScenario {
  id: string;
  name: string;
  description?: string;
  startMonth: string;
  planningHorizonYear: number;
  assumptions: FinancialAssumption[];
  events: FinancialEvent[];
  isDefault: boolean;
}

export interface ProjectionIncomeSource {
  id: string;
  name: string;
  monthlyAmount: number;
  bonusAmount: number;
  bonusMonth: number | null;
  rentalIncome: number;
  businessIncome: number;
  otherIncome: number;
  annualGrowthRate: number;
}

export interface ProjectionExpenseItem {
  id: string;
  name: string;
  monthlyAmount: number;
  category: string;
  annualInflationRate: number;
}

export interface ProjectionInsurancePolicy {
  id: string;
  name: string;
  owner: string | null;
  monthlyPremium: number;
  annualPremium: number;
  coverageAmount: number;
}

export interface ProjectionTaxProfile {
  regime: "old" | "new" | "custom";
  effectiveTaxRate: number;
  surchargeRate: number;
  cessRate: number;
  note: string;
}

export interface ProjectionFamilyMember {
  id: string;
  name: string;
  relationship: string;
  birthDate: string | null;
  currentAge: number | null;
  isDependent: boolean;
}

export interface ProjectionGoalFundingItem {
  goalId: string;
  goalName: string;
  targetAmount: number;
  fundedAmount: number;
  remainingAmount: number;
  targetDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export interface ProjectionCurvePoint {
  month: string;
  value: number;
}

export interface ProjectionGoalFundingSummary {
  totalGoals: number;
  fundedGoals: number;
  totalGoalFunding: number;
  remainingGoalFunding: number;
  items: ProjectionGoalFundingItem[];
}

export interface ProjectionRetirementReadiness {
  status: "not-evaluated";
  message: string;
}

export interface MonthlyLedgerRecord {
  month: string;
  age: number;
  openingCash: number;
  openingInvestments: number;
  openingAssets: number;
  openingLiabilities: number;
  salary: number;
  bonus: number;
  rentalIncome: number;
  businessIncome: number;
  otherIncome: number;
  livingExpenses: number;
  insurancePremium: number;
  taxes: number;
  emis: number;
  loanPrincipal: number;
  loanInterest: number;
  investmentContributions: number;
  investmentReturns: number;
  goalFunding: number;
  emergencyFund: number;
  closingCash: number;
  closingInvestments: number;
  closingAssets: number;
  closingLiabilities: number;
  closingNetWorth: number;
  liquidity: number;
  retirementCorpus: number;
}

export type MonthlyLedger = readonly Readonly<MonthlyLedgerRecord>[];

export interface ProjectionRunResult {
  monthlyLedger: MonthlyLedger;
  netWorthCurve: ProjectionCurvePoint[];
  investmentCurve: ProjectionCurvePoint[];
  cashCurve: ProjectionCurvePoint[];
  loanCurve: ProjectionCurvePoint[];
  goalFundingSummary: ProjectionGoalFundingSummary;
  retirementReadiness: ProjectionRetirementReadiness;
}