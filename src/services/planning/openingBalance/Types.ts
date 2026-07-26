export const OPENING_BALANCE_MODULE_KEY = "openingBalance" as const;

export type OpeningBalanceModuleKey = typeof OPENING_BALANCE_MODULE_KEY;

export interface OpeningBalanceBuildRequest {
  id: string;
  version: number;
  effectiveDate: string;
  isActive?: boolean;
  futureEffectiveDate?: string | null;
}

export interface OpeningBalanceComparisonRequest {
  previous: { id: string; version: number };
  current: { id: string; version: number };
}
