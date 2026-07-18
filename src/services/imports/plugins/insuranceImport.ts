import { createUniversalAccount, getUniversalAccounts, updateUniversalAccount } from "@/services/universalAccounts";
import type { ImportIssue, ImportModulePlugin, ImportValidationResult, ImportValidatedRecord } from "@/services/imports/types";
import { buildNormalizedRow, isUuid, issue, parseDate, parseNumber, parseString, pickValue } from "@/services/imports/utils";
import type { UniversalAccountInsert, UniversalAccountStatus } from "@/types/universalAccount";

const statuses: UniversalAccountStatus[] = ["active", "inactive", "closed", "archived"];

interface InsuranceImportPayload {
  id?: string;
  values: UniversalAccountInsert;
}

function parseStatus(value: string | null) {
  if (!value) {
    return "active" as const;
  }

  const normalized = value.toLowerCase();
  return statuses.find((item) => item.toLowerCase() === normalized) ?? null;
}

export const insuranceImportPlugin: ImportModulePlugin<InsuranceImportPayload> = {
  moduleId: "insurance",
  displayName: "Insurance",
  supportedSheets: ["Health Insurance", "Life Insurance"],
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<InsuranceImportPayload>> = [];
    const existing = await getUniversalAccounts();
    const existingIds = new Set(existing.map((item) => item.id));

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const name = parseString(pickValue(row, ["policy_name", "policy name", "insurance_name", "insurance name", "name"]));
      const institution = parseString(pickValue(row, ["provider", "insurer", "company", "institution"]));
      const owner = parseString(pickValue(row, ["owner", "holder_name", "holder name", "insured_name", "insured name"]));
      const nominee = parseString(pickValue(row, ["nominee"]));
      const status = parseStatus(parseString(pickValue(row, ["status"])));

      const openingValue = parseNumber(
        pickValue(row, ["opening_value", "opening value", "premium_paid", "premium paid", "sum_assured", "sum assured"]),
      );
      const currentValue = parseNumber(
        pickValue(row, ["current_value", "current value", "cash_value", "cash value", "sum_assured", "sum assured"]),
      );

      const startDateRaw = pickValue(row, ["start_date", "start date", "policy_start_date", "policy start date", "purchase_date", "purchase date"]);
      const endDateRaw = pickValue(row, ["maturity_date", "maturity date", "end_date", "end date", "policy_end_date", "policy end date"]);
      const purchaseDate = startDateRaw === undefined ? null : parseDate(startDateRaw);
      const maturityDate = endDateRaw === undefined ? null : parseDate(endDateRaw);

      if (id && !isUuid(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "ID must be a valid UUID." }));
      }

      if (!name) {
        issues.push(issue({ sheetName, rowNumber, field: "policy_name", message: "Policy name is required." }));
      }

      if (!status) {
        issues.push(issue({ sheetName, rowNumber, field: "status", message: "Invalid status." }));
      }

      if (openingValue === null && currentValue === null) {
        issues.push(
          issue({
            sheetName,
            rowNumber,
            field: "current_value",
            message: "At least one of current value, opening value, premium paid, or sum assured is required.",
          }),
        );
      }

      if (startDateRaw !== undefined && !purchaseDate) {
        issues.push(issue({ sheetName, rowNumber, field: "start_date", message: "Start date is invalid." }));
      }

      if (endDateRaw !== undefined && !maturityDate) {
        issues.push(issue({ sheetName, rowNumber, field: "maturity_date", message: "Maturity date is invalid." }));
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (hasErrors || !name || !status || (openingValue === null && currentValue === null)) {
        return;
      }

      if (id && !existingIds.has(id)) {
        issues.push(
          issue({
            sheetName,
            rowNumber,
            field: "id",
            message: "ID does not exist for this user. Record will be created instead.",
            severity: "warning",
          }),
        );
      }

      const resolvedCurrentValue = currentValue ?? openingValue ?? 0;
      const resolvedOpeningValue = openingValue ?? resolvedCurrentValue;

      const values: UniversalAccountInsert = {
        name,
        account_type: "Insurance",
        opening_value: resolvedOpeningValue,
        current_value: resolvedCurrentValue,
        institution,
        owner,
        nominee,
        purchase_date: purchaseDate,
        maturity_date: maturityDate,
        status,
        notes: parseString(pickValue(row, ["notes"])),
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
    } as ImportValidationResult<InsuranceImportPayload>;
  },
  async executeRows(sheetName, records) {
    const issues: ImportIssue[] = [];
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const record of records) {
      try {
        if (record.action === "update" && record.payload.id) {
          await updateUniversalAccount({ id: record.payload.id, ...record.payload.values });
          updated += 1;
        } else {
          await createUniversalAccount(record.payload.values);
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        issues.push(
          issue({
            severity: "error",
            sheetName,
            rowNumber: record.rowNumber,
            message: error instanceof Error ? error.message : "Unable to import insurance row.",
          }),
        );
      }
    }

    return { inserted, updated, failed, issues };
  },
};
