import type { ImportColumnMappingEntry, ImportRawRow } from "@/services/imports/types";
import { normalizeKey } from "@/services/imports/utils";

interface BankAccountColumnConfigItem {
  field: string;
  required: boolean;
  aliases: string[];
}

export const bankAccountColumnConfig: BankAccountColumnConfigItem[] = [
  { field: "id", required: false, aliases: ["ID"] },
  { field: "bank", required: true, aliases: ["Bank Name", "Bank"] },
  { field: "account_name", required: true, aliases: ["Account Name", "Name"] },
  { field: "account_number", required: true, aliases: ["Account Number"] },
  { field: "current_balance", required: true, aliases: ["Latest Balance", "Current Balance", "Balance"] },
  { field: "opening_balance", required: true, aliases: ["Opening Balance"] },
  { field: "account_type", required: true, aliases: ["Account Type", "Type"] },
  { field: "status", required: false, aliases: ["Status"] },
  { field: "currency", required: false, aliases: ["Currency"] },
  { field: "interest_rate", required: false, aliases: ["Interest Rate"] },
  { field: "nickname", required: false, aliases: ["Nickname"] },
  { field: "ifsc", required: false, aliases: ["IFSC"] },
  { field: "owner", required: false, aliases: ["Owner"] },
  { field: "nominee", required: false, aliases: ["Nominee"] },
  { field: "joint_holder", required: false, aliases: ["Joint Holder"] },
  { field: "notes", required: false, aliases: ["Notes"] },
  { field: "documents_placeholder", required: false, aliases: ["Documents Placeholder"] },
];

export interface BankAccountResolvedColumnMapping {
  entries: ImportColumnMappingEntry[];
  headerByField: Record<string, string | null>;
}

function collectWorkbookHeaders(rows: ImportRawRow[]) {
  const headers = new Map<string, string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const normalized = normalizeKey(key);
      if (!headers.has(normalized)) {
        headers.set(normalized, key);
      }
    }
  }

  return headers;
}

export function resolveBankAccountColumnMapping(rows: ImportRawRow[]): BankAccountResolvedColumnMapping {
  const workbookHeaders = collectWorkbookHeaders(rows);
  const entries: ImportColumnMappingEntry[] = [];
  const headerByField: Record<string, string | null> = {};

  for (const config of bankAccountColumnConfig) {
    const mappedHeader = config.aliases
      .map((alias) => workbookHeaders.get(normalizeKey(alias)) ?? null)
      .find((value) => value !== null) ?? null;

    entries.push({
      field: config.field,
      workbookColumn: mappedHeader,
      required: config.required,
    });

    headerByField[config.field] = mappedHeader;
  }

  return { entries, headerByField };
}

export function mapBankAccountRowToCanonicalFields(
  rawRow: ImportRawRow,
  mapping: BankAccountResolvedColumnMapping,
): Record<string, unknown> {
  return Object.entries(mapping.headerByField).reduce<Record<string, unknown>>((acc, [field, header]) => {
    acc[field] = header ? rawRow[header] : undefined;
    return acc;
  }, {});
}
