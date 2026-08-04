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

export interface ProjectionViewerMonthSnapshot {
  month: string;
  net_worth: number | null;
  financial_assets_total: number | null;
  retirement_corpus: number | null;
  property_value: number | null;
  total_debt: number | null;
  monthly_income: number | null;
  monthly_expense: number | null;
  corpus_drawdown: number | null;
}

interface ProjectionPositionRow {
  month_key: string;
  bucket_key: string;
  closing_value: number | string | null;
  metadata?: Record<string, unknown>;
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

function sumNullableValues(values: Array<number | null>): number | null {
  const numericValues = values.filter((value): value is number => value !== null);

  if (numericValues.length === 0) {
    return null;
  }

  return numericValues.reduce((accumulator, value) => accumulator + value, 0);
}

function toMetadataNumber(metadata: Record<string, unknown> | undefined, key: string): number | null {
  if (!metadata || typeof metadata[key] === "undefined" || metadata[key] === null) {
    return null;
  }

  const parsed = Number(metadata[key]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function groupMonthlyPositionSnapshots(rows: ProjectionPositionRow[]): ProjectionViewerMonthSnapshot[] {
  interface SnapshotAccumulator {
    month: string;
    cash: number | null;
    mutualFunds: number | null;
    stocks: number | null;
    epf: number | null;
    ppf: number | null;
    nps: number | null;
    financialAssetsTotal: number | null;
    nonFinancialAssetsTotal: number | null;
    liabilities: number | null;
    netWorth: number | null;
    monthlyIncome: number | null;
    monthlyExpense: number | null;
  }

  const byMonth = new Map<string, SnapshotAccumulator>();

  for (const row of rows) {
    const month = row.month_key;
    const bucket = row.bucket_key as ProjectionViewerBucketKey;

    if (!VIEWER_BUCKET_KEYS.includes(bucket)) {
      continue;
    }

    if (!byMonth.has(month)) {
      byMonth.set(month, {
        month,
        cash: null,
        mutualFunds: null,
        stocks: null,
        epf: null,
        ppf: null,
        nps: null,
        financialAssetsTotal: null,
        nonFinancialAssetsTotal: null,
        liabilities: null,
        netWorth: null,
        monthlyIncome: null,
        monthlyExpense: null,
      });
    }

    const current = byMonth.get(month);
    if (!current) {
      continue;
    }

    const closingValue = toNumberOrNull(row.closing_value);

    if (bucket === "cash") {
      current.monthlyIncome = toMetadataNumber(row.metadata, "salaryIncomeFromCommonCurve")
        ?? toMetadataNumber(row.metadata, "salaryGrossFromCommonCurve");
      current.monthlyExpense = toMetadataNumber(row.metadata, "monthlyTotalCashOutflow")
        ?? toMetadataNumber(row.metadata, "expenseApplied");
    }

    if (bucket === "cash") {
      current.cash = closingValue;
    } else if (bucket === "mutual_funds") {
      current.mutualFunds = closingValue;
    } else if (bucket === "stocks") {
      current.stocks = closingValue;
    } else if (bucket === "epf") {
      current.epf = closingValue;
    } else if (bucket === "ppf") {
      current.ppf = closingValue;
    } else if (bucket === "nps") {
      current.nps = closingValue;
    } else if (bucket === "financial_assets_total") {
      current.financialAssetsTotal = closingValue;
    } else if (bucket === "non_financial_assets_total") {
      current.nonFinancialAssetsTotal = closingValue;
    } else if (bucket === "liabilities") {
      current.liabilities = closingValue;
    } else if (bucket === "net_worth") {
      current.netWorth = closingValue;
    }
  }

  return [...byMonth.values()]
    .sort((left, right) => left.month.localeCompare(right.month))
    .map((snapshot) => {
      const retirementCorpus = sumNullableValues([snapshot.epf, snapshot.ppf, snapshot.nps]);
      const corpusDrawdown = snapshot.monthlyIncome === null || snapshot.monthlyExpense === null
        ? null
        : snapshot.monthlyIncome - snapshot.monthlyExpense;

      return {
        month: snapshot.month,
        net_worth: snapshot.netWorth,
        financial_assets_total: snapshot.financialAssetsTotal,
        retirement_corpus: retirementCorpus,
        property_value: snapshot.nonFinancialAssetsTotal,
        total_debt: snapshot.liabilities,
        monthly_income: snapshot.monthlyIncome,
        monthly_expense: snapshot.monthlyExpense,
        corpus_drawdown: corpusDrawdown,
      };
    });
}
