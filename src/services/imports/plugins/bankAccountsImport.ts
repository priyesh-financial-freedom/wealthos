import { createBankAccount, getBankAccounts, updateBankAccount } from "@/services/bankAccounts";
import {
  mapBankAccountRowToCanonicalFields,
  resolveBankAccountColumnMapping,
} from "@/services/imports/mappings/bankAccounts";
import type { ImportIssue, ImportModulePlugin, ImportValidationResult, ImportValidatedRecord } from "@/services/imports/types";
import { isUuid, issue, parseNumber, parseString } from "@/services/imports/utils";
import type { BankAccountInsert, BankAccountType, BankAccountStatus } from "@/types/bankAccount";

const accountTypes: BankAccountType[] = ["Savings", "Salary", "Current", "Cash", "Wallet"];
const statuses: BankAccountStatus[] = ["active", "inactive", "closed"];

interface BankAccountImportPayload {
  id?: string;
  values: BankAccountInsert;
}

function parseAccountType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  const matched = accountTypes.find((item) => item.toLowerCase() === normalized);
  return matched ?? null;
}

function parseStatus(value: string | null) {
  if (!value) {
    return "active" as const;
  }

  const normalized = value.toLowerCase();
  const matched = statuses.find((item) => item.toLowerCase() === normalized);
  return matched ?? null;
}

export const bankAccountsImportPlugin: ImportModulePlugin<BankAccountImportPayload> = {
  moduleId: "bank-accounts",
  displayName: "Bank Accounts",
  supportedSheets: ["Bank Accounts"],
  getColumnMapping(_sheetName, rows) {
    return resolveBankAccountColumnMapping(rows).entries;
  },
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<BankAccountImportPayload>> = [];
    const existing = await getBankAccounts();
    const existingIds = new Set(existing.map((item) => item.id));
    const seenIds = new Set<string>();
    const columnMapping = resolveBankAccountColumnMapping(rows);

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = mapBankAccountRowToCanonicalFields(rawRow, columnMapping);

      const id = parseString(row.id);
      const accountType = parseAccountType(parseString(row.account_type));
      const bank = parseString(row.bank);
      const accountName = parseString(row.account_name);
      const accountNumber = parseString(row.account_number);
      const currentBalance = parseNumber(row.current_balance);
      const openingBalance = parseNumber(row.opening_balance);
      const status = parseStatus(parseString(row.status));

      if (id && !isUuid(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "ID must be a valid UUID." }));
      }

      if (id && seenIds.has(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "Duplicate ID found in sheet." }));
      }

      if (id) {
        seenIds.add(id);
      }

      if (!accountType) {
        issues.push(issue({ sheetName, rowNumber, field: "account_type", message: "Invalid account type." }));
      }

      if (!bank) {
        issues.push(issue({ sheetName, rowNumber, field: "bank", message: "Bank is required." }));
      }

      if (!accountName) {
        issues.push(issue({ sheetName, rowNumber, field: "account_name", message: "Account name is required." }));
      }

      if (!accountNumber) {
        issues.push(issue({ sheetName, rowNumber, field: "account_number", message: "Account number is required." }));
      }

      if (currentBalance === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_balance", message: "Current balance must be a valid number." }));
      }

      if (openingBalance === null) {
        issues.push(issue({ sheetName, rowNumber, field: "opening_balance", message: "Opening balance must be a valid number." }));
      }

      if (!status) {
        issues.push(issue({ sheetName, rowNumber, field: "status", message: "Invalid status." }));
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (hasErrors || !accountType || !bank || !accountName || !accountNumber || currentBalance === null || openingBalance === null || !status) {
        return;
      }

      if (id && !existingIds.has(id)) {
        issues.push(issue({
          sheetName,
          rowNumber,
          field: "id",
          message: "ID does not exist for this user. Record will be created instead.",
          severity: "warning",
        }));
      }

      const values: BankAccountInsert = {
        account_type: accountType,
        bank,
        account_name: accountName,
        account_number: accountNumber,
        current_balance: currentBalance,
        opening_balance: openingBalance,
        currency: parseString(row.currency) ?? "INR",
        interest_rate: parseNumber(row.interest_rate) ?? 0,
        nickname: parseString(row.nickname),
        ifsc: parseString(row.ifsc),
        owner: parseString(row.owner),
        nominee: parseString(row.nominee),
        joint_holder: parseString(row.joint_holder),
        notes: parseString(row.notes),
        documents_placeholder: parseString(row.documents_placeholder),
        status,
      };

      records.push({
        rowNumber,
        action: id && existingIds.has(id) ? "update" : "create",
        payload: {
          id: id && existingIds.has(id) ? id : undefined,
          values,
        },
      });
    });

    return {
      totalRows: rows.length,
      records,
      issues,
    } as ImportValidationResult<BankAccountImportPayload>;
  },
  async executeRows(sheetName, records) {
    const issues: ImportIssue[] = [];
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const record of records) {
      try {
        if (record.action === "update" && record.payload.id) {
          await updateBankAccount({ id: record.payload.id, ...record.payload.values });
          updated += 1;
        } else {
          await createBankAccount(record.payload.values);
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        issues.push(
          issue({
            severity: "error",
            sheetName,
            rowNumber: record.rowNumber,
            message: error instanceof Error ? error.message : "Unable to import bank account row.",
          }),
        );
      }
    }

    return { inserted, updated, failed, issues };
  },
};
