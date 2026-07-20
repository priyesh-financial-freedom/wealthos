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