export type GoldHoldingType = "Physical Gold" | "Gold ETF" | "Sovereign Gold Bond" | "Digital Gold";

export interface GoldHolding {
  id: string;
  user_id: string;
  holding_type: GoldHoldingType;
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

export interface GoldHoldingInsert {
  holding_type: GoldHoldingType;
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

export interface GoldHoldingUpdate extends Partial<GoldHoldingInsert> {
  id: string;
}

export interface MonthlyGoldSnapshot {
  id: string;
  user_id: string;
  gold_holding_id: string;
  snapshot_month: number;
  snapshot_year: number;
  opening_value: number;
  closing_value: number;
  created_at: string;
  updated_at: string;
}
