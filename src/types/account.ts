export type AccountCategory =
  | "Bank Account"
  | "Investment"
  | "Retirement"
  | "Fixed Income"
  | "Real Estate"
  | "Vehicle"
  | "Precious Metals"
  | "Liability"
  | "Insurance"
  | "Credit Card"
  | "Other";

export type AccountStatus = "active" | "inactive" | "closed" | "archived";
export type LinkedItemType = "asset" | "investment" | "liability";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  category: AccountCategory;
  institution: string | null;
  owner: string | null;
  current_value: number;
  currency: string;
  status: AccountStatus;
  linked_item_type: LinkedItemType | null;
  linked_item_id: string | null;
  notes: string | null;
  documents_placeholder: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountInsert {
  name: string;
  category: AccountCategory;
  institution?: string | null;
  owner?: string | null;
  current_value: number;
  currency?: string;
  status?: AccountStatus;
  linked_item_type?: LinkedItemType | null;
  linked_item_id?: string | null;
  notes?: string | null;
  documents_placeholder?: string | null;
}

export interface AccountUpdate extends Partial<AccountInsert> {
  id: string;
}
