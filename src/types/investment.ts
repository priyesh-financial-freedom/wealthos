export type InvestmentCategory =
  | "Mutual Funds"
  | "Stocks"
  | "ETFs"
  | "Bonds"
  | "Fixed Deposits"
  | "EPF"
  | "PPF"
  | "NPS"
  | "Gold"
  | "Silver"
  | "Sovereign Gold Bonds"
  | "Crypto"
  | "Cash Equivalents";

export type InvestmentRegion = "Domestic" | "International";
export type InvestmentExposure = "equity" | "debt";
export type InvestmentMode = "Direct" | "Regular";
export type InvestmentOptionType = "Growth" | "IDCW";

export interface Investment {
  id: string;
  user_id: string;
  investment_name: string;
  category: InvestmentCategory;
  units: number;
  nav_price: number;
  cost_basis: number;
  today_gain_loss: number;
  sector: string | null;
  amc: string | null;
  region: InvestmentRegion;
  purchase_date: string | null;
  owner: string | null;
  folio_number: string | null;
  amfi_scheme_code: string | null;
  sip_amount: number | null;
  sip_date: number | null;
  investment_mode: InvestmentMode | null;
  option_type: InvestmentOptionType | null;
  broker_platform: string | null;
  nominee: string | null;
  notes: string | null;
  broker: string | null;
  exchange: string | null;
  isin: string | null;
  average_purchase_price: number | null;
  created_at: string;
  updated_at: string;
  current_value: number;
  gain_loss: number;
  cagr: number | null;
  xirr: number | null;
  exposure: InvestmentExposure;
}

export interface InvestmentInsert {
  investment_name: string;
  category: InvestmentCategory;
  units: number;
  nav_price: number;
  cost_basis: number;
  today_gain_loss?: number | null;
  sector?: string | null;
  amc?: string | null;
  region?: InvestmentRegion;
  purchase_date?: string | null;
  owner?: string | null;
  folio_number?: string | null;
  amfi_scheme_code?: string | null;
  sip_amount?: number | null;
  sip_date?: number | null;
  investment_mode?: InvestmentMode | null;
  option_type?: InvestmentOptionType | null;
  broker_platform?: string | null;
  nominee?: string | null;
  notes?: string | null;
  broker?: string | null;
  exchange?: string | null;
  isin?: string | null;
  average_purchase_price?: number | null;
}

export interface InvestmentUpdate extends Partial<InvestmentInsert> {
  id: string;
}