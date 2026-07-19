export type RetirementAccountType = "EPF" | "PPF" | "NPS";
export type ContributionFrequency = "Monthly" | "Quarterly" | "Annual" | "One-time";

export type ContributionMonth =
  | "January"
  | "February"
  | "March"
  | "April"
  | "May"
  | "June"
  | "July"
  | "August"
  | "September"
  | "October"
  | "November"
  | "December";

export interface BaseRetirementAccount {
  id: string;
  user_id: string;
  account_type: RetirementAccountType;
  owner: string;
  institution: string;
  current_balance: number;
  account_number: string | null;
  opening_date: string | null;
  interest_rate: number | null;
  nominee: string | null;
  notes: string | null;
  contribution_frequency: ContributionFrequency;
  contribution_amount: number;
  contribution_day: number | null;
  contribution_month: ContributionMonth | null;
  created_at: string;
  updated_at: string;
}

export interface PpfAccount extends BaseRetirementAccount {
  account_type: "PPF";
  maturity_date: string | null;
}

export interface EpfAccount extends BaseRetirementAccount {
  account_type: "EPF";
  employer: string | null;
  uan: string | null;
  employee_contribution: number | null;
  employer_contribution: number | null;
}

export interface NpsAccount extends BaseRetirementAccount {
  account_type: "NPS";
  pran: string | null;
  pop: string | null;
  equity_percent: number | null;
  corporate_debt_percent: number | null;
  government_securities_percent: number | null;
  alternative_assets_percent: number | null;
}

export type RetirementAccount = PpfAccount | EpfAccount | NpsAccount;

export interface BaseRetirementAccountInsert {
  owner: string;
  institution: string;
  current_balance: number;
  account_number?: string | null;
  opening_date?: string | null;
  interest_rate?: number | null;
  nominee?: string | null;
  notes?: string | null;
  contribution_frequency: ContributionFrequency;
  contribution_amount: number;
  contribution_day?: number | null;
  contribution_month?: ContributionMonth | null;
}

export interface PpfAccountInsert extends BaseRetirementAccountInsert {
  account_type: "PPF";
  maturity_date?: string | null;
}

export interface EpfAccountInsert extends BaseRetirementAccountInsert {
  account_type: "EPF";
  employer?: string | null;
  uan?: string | null;
  employee_contribution?: number | null;
  employer_contribution?: number | null;
}

export interface NpsAccountInsert extends BaseRetirementAccountInsert {
  account_type: "NPS";
  pran?: string | null;
  pop?: string | null;
  equity_percent?: number | null;
  corporate_debt_percent?: number | null;
  government_securities_percent?: number | null;
  alternative_assets_percent?: number | null;
}

export type RetirementAccountInsert = PpfAccountInsert | EpfAccountInsert | NpsAccountInsert;

export interface RetirementAccountUpdate {
  id: string;
  account_type: RetirementAccountType;
  values: Partial<RetirementAccountInsert>;
}

export interface RetirementDashboardModel {
  totalRetirementAssets: number;
  balancesByType: Record<RetirementAccountType, number>;
  ownerAllocation: Array<{ name: string; value: number }>;
  accountTypeAllocation: Array<{ name: RetirementAccountType; value: number }>;
}

export interface RetirementExecutiveSummary {
  totalRetirementAssets: number;
}