export type BankAccountType = "Savings" | "Salary" | "Current" | "Cash" | "Wallet";
export type BankAccountStatus = "active" | "inactive" | "closed";

export interface BankAccount {
  id: string;
  user_id: string;
  account_type: BankAccountType;
  bank: string;
  account_name: string;
  nickname: string | null;
  account_number: string;
  masked_account_number: string;
  ifsc: string | null;
  currency: string;
  current_balance: number;
  opening_balance: number;
  interest_rate: number;
  owner: string | null;
  nominee: string | null;
  joint_holder: string | null;
  notes: string | null;
  documents_placeholder: string | null;
  status: BankAccountStatus;
  created_at: string;
  updated_at: string;
}

export interface BankAccountInsert {
  account_type: BankAccountType;
  bank: string;
  account_name: string;
  nickname?: string | null;
  account_number: string;
  ifsc?: string | null;
  currency?: string;
  current_balance: number;
  opening_balance: number;
  interest_rate?: number;
  owner?: string | null;
  nominee?: string | null;
  joint_holder?: string | null;
  notes?: string | null;
  documents_placeholder?: string | null;
  status?: BankAccountStatus;
}

export interface BankAccountUpdate extends Partial<BankAccountInsert> {
  id: string;
}

export interface BankAccountMonthlySnapshot {
  id: string;
  user_id: string;
  bank_account_id: string;
  snapshot_month: number;
  snapshot_year: number;
  opening_balance: number;
  deposits: number;
  withdrawals: number;
  closing_balance: number;
  interest_rate: number;
  monthly_change: number;
  cash_flow: number;
  average_balance: number;
  interest_earned: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccountMonthlySnapshotInsert {
  bank_account_id: string;
  snapshot_month: number;
  snapshot_year: number;
  opening_balance: number;
  deposits: number;
  withdrawals: number;
  closing_balance: number;
  interest_rate: number;
  notes?: string | null;
}

export interface BankAccountMonthlySnapshotUpdate extends Partial<BankAccountMonthlySnapshotInsert> {
  id: string;
}

export interface CashTrendPoint {
  month: string;
  totalCash: number;
  inflow: number;
  outflow: number;
}

export interface BankAccountsDashboardModel {
  totalCash: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  liquidityRatio: number | null;
  latestAverageBalance: number;
  latestInterestEarned: number;
  cashTrend: CashTrendPoint[];
  accountTypeAllocation: Array<{ name: string; value: number }>;
}
