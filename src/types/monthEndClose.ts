export type MonthEndCloseStatus = "draft" | "closed";
export type MonthEndCloseItemType = "asset" | "liability";
export type MonthEndCloseEntityType =
  | "asset"
  | "bank-account"
  | "investment"
  | "gold-holding"
  | "silver-holding"
  | "fixed-deposit"
  | "retirement-account"
  | "real-estate-property"
  | "liability"
  | "legacy-bucket";

export type MonthEndCloseItemKey =
  | "bank_accounts"
  | "mutual_funds"
  | "stocks"
  | "gold"
  | "silver"
  | "fixed_deposits"
  | "epf"
  | "ppf"
  | "nps"
  | "real_estate"
  | "other_assets"
  | "home_loans"
  | "car_loans"
  | "other_liabilities";

export interface MonthEndCloseItemDefinition {
  key: MonthEndCloseItemKey;
  label: string;
  itemType: MonthEndCloseItemType;
  sortOrder: number;
}

export const MONTH_END_CLOSE_ITEM_DEFINITIONS: MonthEndCloseItemDefinition[] = [
  { key: "bank_accounts", label: "Bank Accounts", itemType: "asset", sortOrder: 10 },
  { key: "mutual_funds", label: "Mutual Funds", itemType: "asset", sortOrder: 20 },
  { key: "stocks", label: "Stocks", itemType: "asset", sortOrder: 30 },
  { key: "gold", label: "Gold", itemType: "asset", sortOrder: 40 },
  { key: "silver", label: "Silver", itemType: "asset", sortOrder: 50 },
  { key: "fixed_deposits", label: "Fixed Deposits", itemType: "asset", sortOrder: 60 },
  { key: "epf", label: "EPF", itemType: "asset", sortOrder: 70 },
  { key: "ppf", label: "PPF", itemType: "asset", sortOrder: 80 },
  { key: "nps", label: "NPS", itemType: "asset", sortOrder: 90 },
  { key: "real_estate", label: "Real Estate", itemType: "asset", sortOrder: 100 },
  { key: "other_assets", label: "Other Assets", itemType: "asset", sortOrder: 110 },
  { key: "home_loans", label: "Home Loans", itemType: "liability", sortOrder: 120 },
  { key: "car_loans", label: "Car Loans", itemType: "liability", sortOrder: 130 },
  { key: "other_liabilities", label: "Other Liabilities", itemType: "liability", sortOrder: 140 },
];

export interface MonthEndClose {
  id: string;
  user_id: string;
  close_month: number;
  close_year: number;
  version_number: number;
  status: MonthEndCloseStatus;
  supersedes_close_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthEndCloseItem {
  id: string;
  close_id: string;
  user_id: string;
  entity_id: string;
  entity_type: MonthEndCloseEntityType | string;
  entity_name: string;
  item_key: MonthEndCloseItemKey;
  item_label: string;
  item_type: MonthEndCloseItemType;
  sort_order: number;
  opening_value: number;
  projected_value: number;
  actual_value: number;
  absolute_variance: number;
  percentage_variance: number | null;
  created_at: string;
  updated_at: string;
}

export interface MonthReference {
  month: number;
  year: number;
  monthKey: string;
  label: string;
}

export interface MonthEndCloseEditorItem {
  rowKey: string;
  entityId: string;
  entityType: MonthEndCloseEntityType | string;
  entityTypeLabel: string;
  entityName: string;
  key: MonthEndCloseItemKey;
  label: string;
  itemType: MonthEndCloseItemType;
  sortOrder: number;
  openingValue: number;
  projectedValue: number;
  actualValue: number;
  absoluteVariance: number;
  percentageVariance: number | null;
}

export interface MonthEndCloseDashboard {
  currentClosedMonth: MonthReference | null;
  pendingMonth: MonthReference;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  monthOverMonthChange: number;
  projectionVariance: number;
  largestPositiveVariance: MonthEndCloseEditorItem | null;
  largestNegativeVariance: MonthEndCloseEditorItem | null;
}

export interface MonthEndCloseKpiSummary {
  cash: number;
  mutualFunds: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  totalsByKey: Record<MonthEndCloseItemKey, number>;
}

export interface MonthEndCloseWorkspace {
  close: MonthEndClose | null;
  month: MonthReference;
  status: MonthEndCloseStatus;
  items: MonthEndCloseEditorItem[];
  dashboard: MonthEndCloseDashboard;
}

export interface MonthEndClosePersistInput {
  closeId?: string | null;
  closeMonth: number;
  closeYear: number;
  items: Array<Pick<MonthEndCloseEditorItem, "entityId" | "entityType" | "entityName" | "key" | "label" | "itemType" | "sortOrder" | "openingValue" | "projectedValue" | "actualValue">>;
}