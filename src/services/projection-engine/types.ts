export type ProjectionMonthState = "Baseline" | "Actual" | "Forecast";

export type ProjectionVersionKind = "BASELINE" | "CURRENT" | "SCENARIO" | (string & {});

export interface ProjectionVersion {
  id: string;
  kind: ProjectionVersionKind;
  name?: string;
}

export type MonthlyPipelineStep =
  | "opening-balances"
  | "income"
  | "expenses"
  | "events"
  | "investment-contributions"
  | "investment-growth"
  | "loan-processing"
  | "asset-appreciation"
  | "closing-balances"
  | "monthly-projection";

export interface ProjectionBalances {
  cash: number;
  investments: number;
  assets: number;
  liabilities: number;
  loanOutstanding: number;
  netWorth: number;
}

export interface ProjectionActivity {
  income: number;
  expenses: number;
  eventImpact: number;
  contribution: number;
  investmentGrowth: number;
  assetAppreciation: number;
  loanPayment: number;
  loanInterest: number;
  loanPrincipal: number;
  netCashFlow: number;
}

export interface LoanAssumption {
  id: string;
  outstandingPrincipal: number;
  annualInterestRate: number;
  emi: number;
}

export interface LoanState {
  id: string;
  outstandingPrincipal: number;
  annualInterestRate: number;
  emi: number;
}

export interface AssetPosition {
  id: string;
  category: string;
  currentValue: number;
}

export interface LiabilityPosition {
  id: string;
  category: string;
  outstandingAmount: number;
  annualInterestRate?: number;
  emi?: number;
}

export interface IncomeSource {
  id: string;
  name: string;
  monthlyAmount: number;
  growthRateAnnual?: number;
  enabled?: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  monthlyAmount: number;
  inflationRateAnnual?: number;
  enabled?: boolean;
}

export type ContributionRuleType =
  | "fixed"
  | "percent-of-income"
  | "surplus-linked"
  | "sip"
  | "epf"
  | "ppf"
  | "nps-monthly"
  | "nps-annual"
  | (string & {});

export interface ContributionRule {
  id: string;
  type: ContributionRuleType;
  amount?: number;
  percentage?: number;
  scheduleMonth?: number;
  frequency?: "monthly" | "annual";
  metadata?: Record<string, unknown>;
  enabled?: boolean;
}

export type GrowthTarget = "investments" | "assets";

export interface GrowthRule {
  id: string;
  target: GrowthTarget;
  annualRate: number;
  enabled?: boolean;
}

export type ProjectionEventCategory =
  | "Income Event"
  | "Expense Event"
  | "One-Time Expense"
  | "Asset Purchase"
  | "Asset Sale"
  | "Loan Prepayment"
  | "Retirement"
  | "Marriage"
  | "Education Expense"
  | "Property Purchase"
  | "Property Sale"
  | "Custom";

export type ProjectionEventFrequency = "once" | "monthly" | "quarterly" | "annual";

export interface ProjectionEvent {
  id: string;
  name: string;
  category: ProjectionEventCategory;
  effectiveMonth: string;
  startMonth: string;
  endMonth?: string;
  amount: number;
  frequency: ProjectionEventFrequency;
  enabled: boolean;
}

export interface ActualMonthlyData {
  monthKey: string;
  activity?: Partial<ProjectionActivity>;
  closing?: Partial<ProjectionBalances>;
  loans?: LoanState[];
  notes?: string;
}

export interface FinancialPlanDescriptor {
  id: string;
  name?: string;
}

export interface ProjectionPeriod {
  startMonthKey: string;
  months: number;
}

export interface ProjectionAssumptions {
  incomeMonthly: number;
  incomeAnnualGrowthRate: number;
  expensesMonthly: number;
  inflationAnnualRate: number;
  investmentGrowthAnnualRate: number;
  contributionMonthly: number;
  contributionAnnualStepUpRate: number;
  loans: LoanAssumption[];
}

export interface MonthlyAssumptionSet {
  income: number;
  expenses: number;
  plannedContribution: number;
  incomeMonthlyGrowthRate: number;
  inflationMonthlyRate: number;
  investmentGrowthMonthlyRate: number;
}

export interface MonthlyProjection {
  projectionVersion: ProjectionVersion;
  monthKey: string;
  monthIndex: number;
  state: ProjectionMonthState;
  pipeline: readonly MonthlyPipelineStep[];
  opening: ProjectionBalances;
  activity: ProjectionActivity;
  closing: ProjectionBalances;
  assumptions: MonthlyAssumptionSet;
  loans: LoanState[];
  metadata?: {
    notes?: string;
    [key: string]: unknown;
  };
}

export interface ProjectionVariance {
  monthKey: string;
  cashVariance: number;
  investmentVariance: number;
  liabilityVariance: number;
  netWorthVariance: number;
  incomeVariance: number;
  expenseVariance: number;
  contributionVariance: number;
  growthVariance: number;
}

export interface ProjectionKPISet {
  months: number;
  endingNetWorth: number;
  netWorthGrowth: number;
  averageMonthlySurplus: number;
  averageSavingsRate: number;
  negativeCashFlowMonths: number;
  debtToAssetRatioEnd: number;
}

export interface ProjectionTrendMetrics {
  monthKey: string;
  netWorth: number;
  netCashFlow: number;
  debtToAssetRatio: number;
}

export interface ProjectionAnalytics {
  kpis: ProjectionKPISet;
  variance: ProjectionVariance[];
  achievementPercent: number;
  trendMetrics: ProjectionTrendMetrics[];
}

export interface ProjectionContext {
  financialPlan: FinancialPlanDescriptor;
  projectionVersion: ProjectionVersion;
  projectionPeriod: ProjectionPeriod;
  currentProcessingMonth: string;
  assumptions: ProjectionAssumptions;
  openingBalances: ProjectionBalances;
  assets: readonly AssetPosition[];
  liabilities: readonly LiabilityPosition[];
  incomeSources: readonly IncomeSource[];
  expenseCategories: readonly ExpenseCategory[];
  contributionRules: readonly ContributionRule[];
  growthRules: readonly GrowthRule[];
  events: readonly ProjectionEvent[];
  actualMonthlyData: readonly ActualMonthlyData[];
}

export interface BaselineProjectionInput {
  startMonthKey: string;
  months: number;
  openingBalances: ProjectionBalances;
  assumptions: ProjectionAssumptions;
}

export interface ActualMonthInput {
  monthKey: string;
  activity?: Partial<ProjectionActivity>;
  closing?: Partial<ProjectionBalances>;
  loans?: LoanState[];
  notes?: string;
}

export interface RollingProjectionInput {
  baselineProjection: MonthlyProjection[];
  assumptions: ProjectionAssumptions;
  actualMonths: ActualMonthInput[];
}

export interface VarianceInput {
  baselineProjection: MonthlyProjection[];
  actualProjection: MonthlyProjection[];
}