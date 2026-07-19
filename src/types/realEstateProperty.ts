export type RealEstatePropertyType = "Apartment" | "Villa" | "Independent House" | "Plot" | "Commercial" | "Other";

export const REAL_ESTATE_PROPERTY_TYPES: RealEstatePropertyType[] = [
  "Apartment",
  "Villa",
  "Independent House",
  "Plot",
  "Commercial",
  "Other",
];

export type OccupancyStatus = "self_occupied" | "rented";

export interface RealEstateProperty {
  id: string;
  user_id: string;
  property_name: string;
  property_type: RealEstatePropertyType;
  owner: string;
  purchase_date: string | null;
  purchase_price: number;
  current_market_value: number;
  address: string | null;
  city: string;
  state: string;
  pin_code: string | null;
  occupancy_status: OccupancyStatus;
  monthly_rent: number | null;
  linked_home_loan_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RealEstatePropertyInsert {
  property_name: string;
  property_type: RealEstatePropertyType;
  owner: string;
  purchase_date?: string | null;
  purchase_price: number;
  current_market_value: number;
  address?: string | null;
  city: string;
  state: string;
  pin_code?: string | null;
  occupancy_status: OccupancyStatus;
  monthly_rent?: number | null;
  linked_home_loan_id?: string | null;
  notes?: string | null;
}

export interface RealEstatePropertyUpdate extends Partial<RealEstatePropertyInsert> {
  id: string;
}
