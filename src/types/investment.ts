export type InvestmentCategory =
  | "Mutual Funds"
  | "Stocks"
  | "Bonds"
  | "Fixed Deposits"
  | "Gold"
  | "ESOPs"
  | "Startup Investments"
  | "Other Investments"
  | "ETFs"
  | "EPF"
  | "PPF"
  | "NPS"
  | "Silver"
  | "Sovereign Gold Bonds"
  | "Crypto"
  | "Cash Equivalents";

export type InvestmentStatus = "active" | "inactive" | "closed";

export type InvestmentRegion = "Domestic" | "International";
export type InvestmentExposure = "equity" | "debt";
export type InvestmentMode = "Direct" | "Regular";
export type InvestmentOptionType = "Growth" | "IDCW";

export interface Investment {
  id: string;
  user_id: string;
  owner: string | null;
  institution: string | null;
  investment_name: string;
  investment_type: InvestmentCategory;
  category: InvestmentCategory;
  acquisition_date: string | null;
  cost_value: number;
  status: InvestmentStatus;
  notes: string | null;
  documents_placeholder: string | null;

  monthly_change: number;
  current_month_value: number | null;
  previous_month_value: number | null;

  // Compatibility aliases used across older modules.
  cost_basis: number;
  purchase_date: string | null;

  units: number;
  nav_price: number;
  today_gain_loss: number;
  sector: string | null;
  amc: string | null;
  region: InvestmentRegion;
  folio_number: string | null;
  amfi_scheme_code: string | null;
  sip_amount: number | null;
  sip_date: number | null;
  investment_mode: InvestmentMode | null;
  option_type: InvestmentOptionType | null;
  broker_platform: string | null;
  nominee: string | null;
  broker: string | null;
  exchange: string | null;
  isin: string | null;
  average_purchase_price: number | null;
  demat_account_provider: string | null;
  demat_account_number: string | null;
  fd_number: string | null;
  interest_rate: number | null;
  compounding_frequency: string | null;
  payout_type: string | null;
  maturity_date: string | null;
  maturity_value: number | null;
  issuer?: string | null;
  bond_name?: string | null;
  bond_type?: string | null;
  face_value?: number | null;
  coupon_rate?: number | null;
  coupon_frequency?: string | null;
  purchase_price?: number | null;
  current_market_price?: number | null;
  gold_type?: string | null;
  gold_unit?: string | null;
  storage_location?: string | null;
  esop_vested_shares?: number | null;
  esop_current_share_price?: number | null;
  esop_grant_status?: string | null;
  startup_funding_round?: string | null;
  startup_ownership_percent?: number | null;
  alternative_category?: string | null;
  created_at: string;
  updated_at: string;
  current_value: number;
  gain_loss: number;
  cagr: number | null;
  xirr: number | null;
  exposure: InvestmentExposure;
}

export interface InvestmentInsert {
  owner?: string | null;
  institution?: string | null;
  investment_name: string;
  investment_type?: InvestmentCategory;
  category: InvestmentCategory;
  acquisition_date?: string | null;
  cost_value?: number;
  current_value?: number;
  status?: InvestmentStatus;
  notes?: string | null;
  documents_placeholder?: string | null;

  // Legacy optional fields accepted for compatibility.
  units?: number;
  nav_price?: number;
  cost_basis?: number;
  today_gain_loss?: number | null;
  sector?: string | null;
  amc?: string | null;
  region?: InvestmentRegion;
  purchase_date?: string | null;
  folio_number?: string | null;
  amfi_scheme_code?: string | null;
  sip_amount?: number | null;
  sip_date?: number | null;
  investment_mode?: InvestmentMode | null;
  option_type?: InvestmentOptionType | null;
  broker_platform?: string | null;
  nominee?: string | null;
  broker?: string | null;
  exchange?: string | null;
  isin?: string | null;
  average_purchase_price?: number | null;
  demat_account_provider?: string | null;
  demat_account_number?: string | null;
  fd_number?: string | null;
  interest_rate?: number | null;
  compounding_frequency?: string | null;
  payout_type?: string | null;
  maturity_date?: string | null;
  maturity_value?: number | null;
  issuer?: string | null;
  bond_name?: string | null;
  bond_type?: string | null;
  face_value?: number | null;
  coupon_rate?: number | null;
  coupon_frequency?: string | null;
  purchase_price?: number | null;
  current_market_price?: number | null;
  gold_type?: string | null;
  gold_unit?: string | null;
  storage_location?: string | null;
  esop_vested_shares?: number | null;
  esop_current_share_price?: number | null;
  esop_grant_status?: string | null;
  startup_funding_round?: string | null;
  startup_ownership_percent?: number | null;
  alternative_category?: string | null;
}

export interface StockBusinessKey {
  owner: string;
  demat_account_number: string;
  isin: string;
}

export interface InvestmentUpdate extends Partial<InvestmentInsert> {
  id: string;
}

export interface InvestmentMonthlyHistory {
  id: string;
  user_id: string;
  investment_id: string;
  month_end_date: string;
  closing_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentMonthlyHistoryInsert {
  investment_id: string;
  month_end_date: string;
  closing_value: number;
  notes?: string | null;
}

export interface InvestmentMonthlyHistoryUpdate extends Partial<InvestmentMonthlyHistoryInsert> {
  id: string;
}