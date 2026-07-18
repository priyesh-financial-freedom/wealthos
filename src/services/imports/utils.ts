import type { ImportIssue, ImportRawRow } from "@/services/imports/types";

export function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeSheetName(value: string) {
  return normalizeKey(value);
}

export function buildNormalizedRow(row: ImportRawRow): Record<string, unknown> {
  return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[normalizeKey(String(key))] = value;
    return acc;
  }, {});
}

export function pickValue(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeKey(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return undefined;
}

export function parseString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed = String(value).trim();
  return parsed.length > 0 ? parsed : null;
}

export function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const cleaned = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const millis = excelEpoch.getTime() + value * 86400000;
    const date = new Date(millis);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "yes", "y", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0"].includes(normalized)) {
    return false;
  }

  return null;
}

export function isUuid(value: string | null) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function issue(params: {
  sheetName: string;
  rowNumber: number;
  message: string;
  field?: string;
  severity?: "error" | "warning";
}): ImportIssue {
  return {
    severity: params.severity ?? "error",
    sheetName: params.sheetName,
    rowNumber: params.rowNumber,
    field: params.field,
    message: params.message,
  };
}
