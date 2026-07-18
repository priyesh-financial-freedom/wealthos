export type UniversalAccountType =
  | "Savings Account"
  | "Salary Account"
  | "Current Account"
  | "Cash"
  | "Wallet"
  | "EPF"
  | "PPF"
  | "NPS"
  | "Fixed Deposit"
  | "Mutual Fund"
  | "Stock Portfolio"
  | "Gold"
  | "Silver"
  | "Bonds"
  | "Real Estate"
  | "Vehicle"
  | "Insurance"
  | "Credit Card"
  | "Loan";

export type UniversalAccountStatus = "active" | "inactive" | "closed" | "archived";

export interface UniversalAccount {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  account_type: UniversalAccountType;
  owner: string | null;
  joint_owner: string | null;
  nominee: string | null;
  opening_value: number;
  current_value: number;
  currency: string;
  purchase_date: string | null;
  interest_rate: number | null;
  maturity_date: string | null;
  status: UniversalAccountStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UniversalAccountInsert {
  name: string;
  institution?: string | null;
  account_type: UniversalAccountType;
  owner?: string | null;
  joint_owner?: string | null;
  nominee?: string | null;
  opening_value: number;
  current_value: number;
  currency?: string;
  purchase_date?: string | null;
  interest_rate?: number | null;
  maturity_date?: string | null;
  status?: UniversalAccountStatus;
  notes?: string | null;
}

export interface UniversalAccountUpdate extends Partial<UniversalAccountInsert> {
  id: string;
}

export interface UniversalAccountMonthlySnapshot {
  id: string;
  user_id: string;
  universal_account_id: string;
  snapshot_month: number;
  snapshot_year: number;
  opening_value: number;
  contribution: number;
  withdrawal: number;
  closing_value: number;
  interest: number;
  dividend: number;
  gain_loss: number;
  monthly_growth: number;
  cash_flow: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UniversalAccountMonthlySnapshotInsert {
  universal_account_id: string;
  snapshot_month: number;
  snapshot_year: number;
  opening_value: number;
  contribution: number;
  withdrawal: number;
  closing_value: number;
  interest: number;
  dividend: number;
  gain_loss: number;
  notes?: string | null;
}

export interface UniversalAccountMonthlySnapshotUpdate extends Partial<UniversalAccountMonthlySnapshotInsert> {
  id: string;
}

export interface UniversalAccountMetrics {
  monthlyGrowth: number;
  cagr: number | null;
  xirr: number | null;
  totalContributions: number;
  totalWithdrawals: number;
  lifetimeReturn: number;
  currentAllocation: number;
  portfolioWeight: number;
}

export interface UniversalDashboardSummary {
  totalCurrentValue: number;
  totalCash: number;
  totalLiabilities: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  liquidityRatio: number | null;
  trend: Array<{
    month: string;
    total: number;
    inflow: number;
    outflow: number;
  }>;
  allocation: Array<{ name: string; value: number }>;
}
