export type DepositType = "FD" | "RD";
export type CompoundingFrequency = "monthly" | "quarterly" | "half-yearly" | "yearly";

export interface FixedDeposit {
  id: string;
  user_id: string;
  deposit_type: DepositType;
  institution: string;
  branch: string | null;
  account_number: string;
  holder: string;
  principal: number;
  interest_rate: number;
  compounding_frequency: CompoundingFrequency;
  current_value: number;
  opening_date: string | null;
  maturity_date: string | null;
  auto_renew: boolean;
  owner: string | null;
  nominee: string | null;
  notes: string | null;
  documents_placeholder: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedDepositInsert {
  deposit_type: DepositType;
  institution: string;
  branch?: string | null;
  account_number: string;
  holder: string;
  principal: number;
  interest_rate: number;
  compounding_frequency?: CompoundingFrequency;
  current_value: number;
  opening_date?: string | null;
  maturity_date?: string | null;
  auto_renew?: boolean;
  owner?: string | null;
  nominee?: string | null;
  notes?: string | null;
  documents_placeholder?: string | null;
}

export interface FixedDepositUpdate extends Partial<FixedDepositInsert> {
  id: string;
}

export interface MonthlyFixedDepositSnapshot {
  id: string;
  user_id: string;
  fixed_deposit_id: string;
  snapshot_month: number;
  snapshot_year: number;
  opening_value: number;
  closing_value: number;
  interest_accrued: number;
  created_at: string;
  updated_at: string;
}
