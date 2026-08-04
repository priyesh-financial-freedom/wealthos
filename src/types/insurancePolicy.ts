export type InsurancePolicyType =
  | "Life"
  | "Health"
  | "Vehicle"
  | "Home"
  | "Travel"
  | "Personal Accident"
  | "Critical Illness"
  | "Term"
  | "ULIP"
  | "Other";

export type InsurancePremiumFrequency = "Monthly" | "Quarterly" | "Half-Yearly" | "Yearly" | "Single";

export type InsurancePolicyStatus = "Active" | "Grace" | "Lapsed" | "Matured" | "Cancelled";

export interface InsurancePolicy {
  id: string;
  user_id: string;
  policy_name: string;
  policy_type: InsurancePolicyType;
  insurer: string;
  policy_number: string;
  owner: string;
  covered_person: string;
  nominee: string | null;
  cover_amount: number;
  premium_amount: number;
  premium_frequency: InsurancePremiumFrequency;
  start_date: string | null;
  renewal_date: string | null;
  maturity_date: string | null;
  status: InsurancePolicyStatus;
  include_in_cash_flow: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsurancePolicyInsert {
  policy_name: string;
  policy_type: InsurancePolicyType;
  insurer: string;
  policy_number: string;
  owner: string;
  covered_person: string;
  nominee?: string | null;
  cover_amount?: number;
  premium_amount?: number;
  premium_frequency?: InsurancePremiumFrequency;
  start_date?: string | null;
  renewal_date?: string | null;
  maturity_date?: string | null;
  status?: InsurancePolicyStatus;
  include_in_cash_flow?: boolean;
  notes?: string | null;
}

export interface InsurancePolicyUpdate extends Partial<InsurancePolicyInsert> {
  id: string;
}

export interface InsurancePolicySummary {
  totalAnnualPremium: number;
  monthlyPremiumEquivalent: number;
  totalLifeCover: number;
  totalHealthCover: number;
  activePolicies: number;
  nextRenewalDue: string | null;
}
