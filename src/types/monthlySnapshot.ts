export interface MonthlySnapshot {
  id: string;
  user_id: string;
  snapshot_month: number;
  snapshot_year: number;
  status: "closed";
  assets_total: number;
  liabilities_total: number;
  investments_total: number;
  net_worth: number;
  growth_from_previous_month: number;
  growth_from_previous_year: number;
  closed_at: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyAssetSnapshot {
  id: string;
  snapshot_id: string;
  user_id: string;
  snapshot_month: number;
  snapshot_year: number;
  asset_id: string;
  asset_type: string;
  asset_name: string;
  institution: string | null;
  current_value: number;
  cost_basis: number;
  gain_loss: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyInvestmentSnapshot {
  id: string;
  snapshot_id: string;
  user_id: string;
  snapshot_month: number;
  snapshot_year: number;
  investment_id: string;
  investment_name: string;
  category: string;
  region: string;
  sector: string | null;
  amc: string | null;
  current_value: number;
  cost_basis: number;
  gain_loss: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyLiabilitySnapshot {
  id: string;
  snapshot_id: string;
  user_id: string;
  snapshot_month: number;
  snapshot_year: number;
  liability_id: string;
  liability_type: string;
  account_name: string;
  lender: string;
  status: string;
  current_value: number;
  cost_basis: number;
  gain_loss: number;
  outstanding_balance: number;
  created_at: string;
  updated_at: string;
}
