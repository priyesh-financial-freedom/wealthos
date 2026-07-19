export type LiabilityType =
  | "Home Loan"
  | "Car Loan"
  | "Personal Loan"
  | "Education Loan"
  | "Loan Against Property"
  | "Credit Card"
  | "Overdraft / Line of Credit"
  | "Other Liability";

export const LIABILITY_TYPES: LiabilityType[] = [
  "Home Loan",
  "Car Loan",
  "Personal Loan",
  "Education Loan",
  "Loan Against Property",
  "Credit Card",
  "Overdraft / Line of Credit",
  "Other Liability",
];

export type LiabilityStatus = "active" | "paid_off" | "pending" | "closed";

export interface Liability {
  id: string;
  user_id: string;
  liability_type: LiabilityType;
  lender: string;
  account_name: string;
  outstanding_amount: number;
  original_amount: number | null;
  interest_rate: number | null;
  emi: number | null;
  start_date: string | null;
  end_date: string | null;
  due_day: number | null;
  due_date: string | null;
  tenure_months: number | null;
  credit_limit: number | null;
  sanction_limit: number | null;
  status: LiabilityStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiabilityInsert {
  liability_type: LiabilityType;
  lender: string;
  account_name: string;
  outstanding_amount: number;
  original_amount?: number | null;
  interest_rate?: number | null;
  emi?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  due_day?: number | null;
  due_date?: string | null;
  tenure_months?: number | null;
  credit_limit?: number | null;
  sanction_limit?: number | null;
  status?: LiabilityStatus;
  notes?: string | null;
}

export interface LiabilityUpdate extends Partial<LiabilityInsert> {
  id: string;
}
