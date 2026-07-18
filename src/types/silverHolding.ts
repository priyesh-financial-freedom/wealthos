export type SilverHoldingType = "Physical Silver" | "Silver ETF" | "Digital Silver";

export interface SilverHolding {
  id: string;
  user_id: string;
  holding_type: SilverHoldingType;
  description: string;
  quantity: number;
  unit: string;
  purity: string | null;
  purchase_date: string | null;
  cost_basis: number;
  current_value: number;
  custodian: string | null;
  institution: string | null;
  owner: string | null;
  nominee: string | null;
  notes: string | null;
  documents_placeholder: string | null;
  created_at: string;
  updated_at: string;
}

export interface SilverHoldingInsert {
  holding_type: SilverHoldingType;
  description: string;
  quantity: number;
  unit: string;
  purity?: string | null;
  purchase_date?: string | null;
  cost_basis: number;
  current_value: number;
  custodian?: string | null;
  institution?: string | null;
  owner?: string | null;
  nominee?: string | null;
  notes?: string | null;
  documents_placeholder?: string | null;
}

export interface SilverHoldingUpdate extends Partial<SilverHoldingInsert> {
  id: string;
}

export interface MonthlySilverSnapshot {
  id: string;
  user_id: string;
  silver_holding_id: string;
  snapshot_month: number;
  snapshot_year: number;
  opening_value: number;
  closing_value: number;
  created_at: string;
  updated_at: string;
}
