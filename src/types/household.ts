export interface Household {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  financial_year_start_month: number;
  planning_start_month: string;
  planning_end_month: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  full_name: string;
  relationship: string;
  date_of_birth: string | null;
  retirement_date: string | null;
  employment_status: string | null;
  is_primary_user: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OwnershipType {
  id: string;
  name: "Individual" | "Joint" | "Household";
  created_at: string;
  updated_at: string;
}

export interface HouseholdInsert {
  name: string;
  base_currency?: string;
  financial_year_start_month: number;
  planning_start_month: string;
  planning_end_month: string;
}

export interface HouseholdUpdate extends Partial<HouseholdInsert> {
  id: string;
}

export interface HouseholdMemberInsert {
  full_name: string;
  relationship: string;
  date_of_birth?: string | null;
  retirement_date?: string | null;
  employment_status?: string | null;
  is_primary_user?: boolean;
  is_active?: boolean;
}

export interface HouseholdMemberUpdate extends Partial<HouseholdMemberInsert> {
  id: string;
}

export interface HouseholdWithMembers {
  household: Household;
  members: HouseholdMember[];
}

export interface HouseholdDashboardSummary {
  householdName: string;
  membersCount: number;
  planningHorizonLabel: string;
  currentFinancialMonthLabel: string;
}
