export type ProjectionViewerBucketKey =
  | "cash"
  | "mutual_funds"
  | "stocks"
  | "epf"
  | "ppf"
  | "nps"
  | "financial_assets_total"
  | "non_financial_assets_total"
  | "liabilities"
  | "net_worth";

export interface ProjectionViewerMonthRow {
  month: string;
  cash: number | null;
  mutual_funds: number | null;
  stocks: number | null;
  epf: number | null;
  ppf: number | null;
  nps: number | null;
  financial_assets_total: number | null;
  non_financial_assets_total: number | null;
  liabilities: number | null;
  net_worth: number | null;
}

interface ProjectionPositionRow {
  month_key: string;
  bucket_key: string;
  closing_value: number | string | null;
}

export const VIEWER_BUCKET_KEYS: ProjectionViewerBucketKey[] = [
  "cash",
  "mutual_funds",
  "stocks",
  "epf",
  "ppf",
  "nps",
  "financial_assets_total",
  "non_financial_assets_total",
  "liabilities",
  "net_worth",
];

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function createEmptyMonthRow(month: string): ProjectionViewerMonthRow {
  return {
    month,
    cash: null,
    mutual_funds: null,
    stocks: null,
    epf: null,
    ppf: null,
    nps: null,
    financial_assets_total: null,
    non_financial_assets_total: null,
    liabilities: null,
    net_worth: null,
  };
}

export function groupMonthlyPositionRows(rows: ProjectionPositionRow[]): ProjectionViewerMonthRow[] {
  const byMonth = new Map<string, ProjectionViewerMonthRow>();

  for (const row of rows) {
    const month = row.month_key;
    const bucket = row.bucket_key as ProjectionViewerBucketKey;

    if (!VIEWER_BUCKET_KEYS.includes(bucket)) {
      continue;
    }

    if (!byMonth.has(month)) {
      byMonth.set(month, createEmptyMonthRow(month));
    }

    const current = byMonth.get(month);
    if (!current) {
      continue;
    }

    current[bucket] = toNumberOrNull(row.closing_value);
  }

  return [...byMonth.values()].sort((left, right) => left.month.localeCompare(right.month));
}
