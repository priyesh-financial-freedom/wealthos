export type RetirementAccountType = "EPF" | "PPF" | "NPS";

export interface RetirementAccount {
  id: string;
  user_id: string;
  account_type: RetirementAccountType;
  institution: string;
  account_number: string;
  holder_name: string;
  opening_date: string | null;
  current_value: number;
  monthly_contribution: number;
  annual_contribution: number;
  interest_rate: number;
  nominee: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetirementAccountInsert {
  account_type: RetirementAccountType;
  institution: string;
  account_number: string;
  holder_name: string;
  opening_date?: string | null;
  current_value: number;
  monthly_contribution?: number;
  annual_contribution?: number;
  interest_rate?: number;
  nominee?: string | null;
  notes?: string | null;
}

export interface RetirementAccountUpdate extends Partial<RetirementAccountInsert> {
  id: string;
}

export interface MonthlyRetirementSnapshot {
  id: string;
  user_id: string;
  retirement_account_id: string;
  snapshot_month: number;
  snapshot_year: number;
  opening_balance: number;
  contribution: number;
  interest: number;
  closing_balance: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyRetirementSnapshotInsert {
  retirement_account_id: string;
  snapshot_month: number;
  snapshot_year: number;
  opening_balance: number;
  contribution?: number;
  interest?: number;
  closing_balance: number;
}

export interface MonthlyRetirementSnapshotUpdate extends Partial<MonthlyRetirementSnapshotInsert> {
  id: string;
}

export interface RetirementTrendPoint {
  month: string;
  total: number;
  contribution: number;
  interest: number;
}

export interface RetirementContributionPoint {
  month: string;
  contribution: number;
}

export interface RetirementYearlyGrowthPoint {
  year: string;
  growth: number;
}

export interface RetirementDashboardModel {
  totalCorpus: number;
  balancesByType: Record<RetirementAccountType, number>;
  monthlyContribution: number;
  annualGrowthAmount: number;
  annualGrowthPercent: number | null;
  retirementAllocationPercent: number;
  trend: RetirementTrendPoint[];
  allocation: Array<{ name: RetirementAccountType; value: number }>;
  contributionHistory: RetirementContributionPoint[];
  yearlyGrowth: RetirementYearlyGrowthPoint[];
}

export interface RetirementExecutiveSummary {
  totalCorpus: number;
  retirementAllocationPercent: number;
  annualGrowthPercent: number | null;
}