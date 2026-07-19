const currencyCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(maximumFractionDigits: number, minimumFractionDigits = 0) {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  const existing = currencyCache.get(key);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits,
    maximumFractionDigits,
  });

  currencyCache.set(key, formatter);
  return formatter;
}

const numberFormatter = new Intl.NumberFormat("en-IN");

export function formatCurrency(value: number | null | undefined, options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const minimumFractionDigits = options?.minimumFractionDigits ?? 0;
  return getCurrencyFormatter(maximumFractionDigits, minimumFractionDigits).format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return numberFormatter.format(value);
}

export function formatPercent(value: number | null | undefined, options?: { digits?: number; multiply?: boolean }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const digits = options?.digits ?? 1;
  const multiply = options?.multiply ?? true;
  const normalized = multiply ? value * 100 : value;
  return `${normalized.toFixed(digits)}%`;
}

export function formatRatio(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${value.toFixed(digits)}x`;
}

export function formatDate(value: string | null | undefined, locale = "en-IN") {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function truncateLabel(value: string, maxLength = 12) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}
