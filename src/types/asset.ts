export type AssetType =
  | "cash"
  | "checking"
  | "savings"
  | "investment"
  | "real_estate"
  | "vehicle"
  | "business"
  | "other";

export interface Asset {
  id: string;
  user_id: string;
  asset_type: AssetType;
  asset_name: string;
  institution: string | null;
  current_value: number;
  purchase_value: number | null;
  purchase_date: string | null;
  owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetInsert {
  asset_type: AssetType;
  asset_name: string;
  institution?: string | null;
  current_value: number;
  purchase_value?: number | null;
  purchase_date?: string | null;
  owner?: string | null;
  notes?: string | null;
}

export interface AssetUpdate extends Partial<AssetInsert> {
  id: string;
}
