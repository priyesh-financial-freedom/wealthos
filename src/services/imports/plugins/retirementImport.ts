import { createRetirementAccount, getRetirementAccounts, updateRetirementAccount } from "@/services/retirement";
import type { ImportIssue, ImportModulePlugin, ImportValidationResult, ImportValidatedRecord } from "@/services/imports/types";
import { buildNormalizedRow, isUuid, issue, parseDate, parseNumber, parseString, pickValue } from "@/services/imports/utils";
import type { RetirementAccountInsert, RetirementAccountType } from "@/types/retirementAccount";

const accountTypes: RetirementAccountType[] = ["EPF", "PPF", "NPS"];

interface RetirementImportPayload {
  id?: string;
  values: RetirementAccountInsert;
}

function parseAccountType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return accountTypes.find((item) => item.toLowerCase() === normalized) ?? null;
}

export const retirementImportPlugin: ImportModulePlugin<RetirementImportPayload> = {
  moduleId: "retirement",
  displayName: "Retirement",
  supportedSheets: ["Retirement"],
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<RetirementImportPayload>> = [];
    const existing = await getRetirementAccounts();
    const existingIds = new Set(existing.map((item) => item.id));

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const accountType = parseAccountType(parseString(pickValue(row, ["account_type", "account type", "type"])));
      const institution = parseString(pickValue(row, ["institution"]));
      const accountNumber = parseString(pickValue(row, ["account_number", "account number"]));
      const holderName = parseString(pickValue(row, ["holder_name", "holder name"]));
      const currentValue = parseNumber(pickValue(row, ["current_value", "current value"]));
      const openingDateRaw = pickValue(row, ["opening_date", "opening date"]);
      const openingDate = openingDateRaw === undefined ? null : parseDate(openingDateRaw);

      if (id && !isUuid(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "ID must be a valid UUID." }));
      }

      if (!accountType) {
        issues.push(issue({ sheetName, rowNumber, field: "account_type", message: "Invalid retirement account type." }));
      }

      if (!institution) {
        issues.push(issue({ sheetName, rowNumber, field: "institution", message: "Institution is required." }));
      }

      if (!accountNumber) {
        issues.push(issue({ sheetName, rowNumber, field: "account_number", message: "Account number is required." }));
      }

      if (!holderName) {
        issues.push(issue({ sheetName, rowNumber, field: "holder_name", message: "Holder name is required." }));
      }

      if (currentValue === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_value", message: "Current value must be a valid number." }));
      }

      if (openingDateRaw !== undefined && !openingDate) {
        issues.push(issue({ sheetName, rowNumber, field: "opening_date", message: "Opening date is invalid." }));
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (hasErrors || !accountType || !institution || !accountNumber || !holderName || currentValue === null) {
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

      const monthlyContribution = parseNumber(pickValue(row, ["monthly_contribution", "monthly contribution"]));
      const annualContribution = parseNumber(pickValue(row, ["annual_contribution", "annual contribution"]));

      const values: RetirementAccountInsert = {
        account_type: accountType,
        institution,
        account_number: accountNumber,
        holder_name: holderName,
        opening_date: openingDate,
        current_value: currentValue,
        monthly_contribution: monthlyContribution ?? undefined,
        annual_contribution: annualContribution ?? undefined,
        interest_rate: parseNumber(pickValue(row, ["interest_rate", "interest rate"])) ?? undefined,
        nominee: parseString(pickValue(row, ["nominee"])),
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
    } as ImportValidationResult<RetirementImportPayload>;
  },
  async executeRows(sheetName, records) {
    const issues: ImportIssue[] = [];
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const record of records) {
      try {
        if (record.action === "update" && record.payload.id) {
          await updateRetirementAccount({ id: record.payload.id, ...record.payload.values });
          updated += 1;
        } else {
          await createRetirementAccount(record.payload.values);
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        issues.push(
          issue({
            severity: "error",
            sheetName,
            rowNumber: record.rowNumber,
            message: error instanceof Error ? error.message : "Unable to import retirement row.",
          }),
        );
      }
    }

    return { inserted, updated, failed, issues };
  },
};
