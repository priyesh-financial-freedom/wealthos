export type LiabilityType =
  | "Home Loan"
  | "Car Loan"
  | "Personal Loan"
  | "Education Loan"
  | "Credit Card"
  | "Bank Overdraft"
  | "Other Liability";

export type LegacyLiabilityType = "Loan Against Property" | "Overdraft / Line of Credit";

export const LIABILITY_TYPES: LiabilityType[] = [
  "Home Loan",
  "Car Loan",
  "Personal Loan",
  "Education Loan",
  "Credit Card",
  "Bank Overdraft",
  "Other Liability",
];

export type LiabilityStatus = "active" | "paid_off" | "pending" | "closed";

export interface Liability {
  id: string;
  user_id: string;
  liability_type: LiabilityType | LegacyLiabilityType;
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
  owner?: string | null;
  primary_borrower?: string | null;
  co_borrower?: string | null;
  prepayment_allowed?: boolean | null;
  prepayment_done_till_date?: number | null;
  future_prepayment_plan?: number | null;
  estimated_interest_saved?: number | null;
  revised_closure_date?: string | null;
  review_date?: string | null;
  status: LiabilityStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiabilityInsert {
  liability_type: LiabilityType | LegacyLiabilityType;
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
  owner?: string | null;
  primary_borrower?: string | null;
  co_borrower?: string | null;
  prepayment_allowed?: boolean | null;
  prepayment_done_till_date?: number | null;
  future_prepayment_plan?: number | null;
  estimated_interest_saved?: number | null;
  revised_closure_date?: string | null;
  review_date?: string | null;
  status?: LiabilityStatus;
  notes?: string | null;
}

export interface LiabilityUpdate extends Partial<LiabilityInsert> {
  id: string;
}
