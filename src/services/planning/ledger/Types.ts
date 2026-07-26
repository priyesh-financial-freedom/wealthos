import type {
  FinancialPlanningModuleMapper,
  FinancialPlanningModuleRepositoryContract,
  FinancialPlanningModuleServiceContract,
} from "../shared";

export const LEDGER_MODULE_KEY = "ledger" as const;

export type LedgerModuleKey = typeof LEDGER_MODULE_KEY;

export type LedgerPlanningService = FinancialPlanningModuleServiceContract<LedgerModuleKey>;

export type LedgerPlanningRepository = FinancialPlanningModuleRepositoryContract<LedgerModuleKey>;

export type LedgerPlanningMapper<TInput = unknown, TOutput = TInput> = FinancialPlanningModuleMapper<TInput, TOutput>;

export type ISODateString = string;
export type ISODateTimeString = string;
export type LedgerMonthKey = `${number}-${string}`;

export interface MonthlyLedgerRecord {
  month: LedgerMonthKey;
  openingCash: number;
  openingAssets: number;
  openingLiabilities: number;
  openingNetWorth: number;
  salary: number;
  bonus: number;
  consultingIncome: number;
  rentalIncome: number;
  dividendIncome: number;
  interestIncome: number;
  expenses: number;
  inflation: number;
  emi: number;
  tax: number;
  epfContribution: number;
  ppfContribution: number;
  npsContribution: number;
  mutualFundSip: number;
  stockInvestment: number;
  fdInvestment: number;
  goldInvestment: number;
  investmentGrowth: number;
  loanInterest: number;
  loanPrincipal: number;
  goalFunding: number;
  retirementCorpus: number;
  emergencyFund: number;
  closingCash: number;
  closingAssets: number;
  closingLiabilities: number;
  closingNetWorth: number;
}

export interface MonthlyLedger {
  id: string;
  version: number;
  effectiveDate: ISODateString;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  isActive: boolean;
  futureEffectiveDate: ISODateString | null;
  projectionContextId: string | null;
  scenarioId: string | null;
  records: MonthlyLedgerRecord[];
}

export interface MonthlyLedgerBuildInput {
  month: LedgerMonthKey;
  values?: Partial<Omit<MonthlyLedgerRecord, "month">>;
}

export interface MonthlyLedgerCreateVersionInput {
  id: string;
  version: number;
  effectiveDate: ISODateString;
  isActive?: boolean;
  futureEffectiveDate?: ISODateString | null;
  projectionContextId?: string | null;
  scenarioId?: string | null;
  records?: MonthlyLedgerRecord[];
}

export interface MonthlyLedgerPatchVersionInput {
  id: string;
  version: number;
  isActive?: boolean;
  futureEffectiveDate?: ISODateString | null;
  projectionContextId?: string | null;
  scenarioId?: string | null;
  records?: MonthlyLedgerRecord[];
}

export interface MonthlyLedgerValidationIssue {
  field: string;
  message: string;
}

export interface MonthlyLedgerPersistenceRow {
  ledger_id: string;
  version: number;
  effective_date: ISODateString;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
  is_active: boolean;
  future_effective_date: ISODateString | null;
  projection_context_id: string | null;
  scenario_id: string | null;
  records: MonthlyLedgerRecord[];
}
