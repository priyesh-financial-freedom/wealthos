import { createFixedDeposit, getFixedDeposits, updateFixedDeposit } from "@/services/fixedDeposits";
import type { ImportIssue, ImportModulePlugin, ImportValidationResult, ImportValidatedRecord } from "@/services/imports/types";
import { buildNormalizedRow, isUuid, issue, parseBoolean, parseDate, parseNumber, parseString, pickValue } from "@/services/imports/utils";
import type { CompoundingFrequency, DepositType, FixedDepositInsert } from "@/types/fixedDeposit";

const depositTypes: DepositType[] = ["FD", "RD"];
const compoundingFrequencies: CompoundingFrequency[] = ["monthly", "quarterly", "half-yearly", "yearly"];

interface FixedDepositImportPayload {
  id?: string;
  values: FixedDepositInsert;
}

function parseDepositType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase();
  return depositTypes.find((item) => item.toUpperCase() === normalized) ?? null;
}

function parseCompoundingFrequency(value: string | null) {
  if (!value) {
    return "quarterly" as const;
  }

  const normalized = value.toLowerCase();
  return compoundingFrequencies.find((item) => item.toLowerCase() === normalized) ?? null;
}

export const fixedDepositsImportPlugin: ImportModulePlugin<FixedDepositImportPayload> = {
  moduleId: "fixed-deposits",
  displayName: "Fixed Deposits",
  supportedSheets: ["Fixed Deposits"],
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<FixedDepositImportPayload>> = [];
    const existing = await getFixedDeposits();
    const existingIds = new Set(existing.map((item) => item.id));

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const depositType = parseDepositType(parseString(pickValue(row, ["deposit_type", "deposit type", "type"])));
      const institution = parseString(pickValue(row, ["institution"]));
      const accountNumber = parseString(pickValue(row, ["account_number", "account number"]));
      const holder = parseString(pickValue(row, ["holder"]));
      const principal = parseNumber(pickValue(row, ["principal"]));
      const interestRate = parseNumber(pickValue(row, ["interest_rate", "interest rate"]));
      const currentValue = parseNumber(pickValue(row, ["current_value", "current value"]));
      const compoundingFrequency = parseCompoundingFrequency(parseString(pickValue(row, ["compounding_frequency", "compounding frequency"])));
      const openingDateRaw = pickValue(row, ["opening_date", "opening date"]);
      const maturityDateRaw = pickValue(row, ["maturity_date", "maturity date"]);
      const openingDate = openingDateRaw === undefined ? null : parseDate(openingDateRaw);
      const maturityDate = maturityDateRaw === undefined ? null : parseDate(maturityDateRaw);
      const autoRenewRaw = pickValue(row, ["auto_renew", "auto renew"]);
      const autoRenew = autoRenewRaw === undefined ? false : parseBoolean(autoRenewRaw);

      if (id && !isUuid(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "ID must be a valid UUID." }));
      }

      if (!depositType) {
        issues.push(issue({ sheetName, rowNumber, field: "deposit_type", message: "Invalid deposit type." }));
      }

      if (!institution) {
        issues.push(issue({ sheetName, rowNumber, field: "institution", message: "Institution is required." }));
      }

      if (!accountNumber) {
        issues.push(issue({ sheetName, rowNumber, field: "account_number", message: "Account number is required." }));
      }

      if (!holder) {
        issues.push(issue({ sheetName, rowNumber, field: "holder", message: "Holder is required." }));
      }

      if (principal === null) {
        issues.push(issue({ sheetName, rowNumber, field: "principal", message: "Principal must be a valid number." }));
      }

      if (interestRate === null) {
        issues.push(issue({ sheetName, rowNumber, field: "interest_rate", message: "Interest rate must be a valid number." }));
      }

      if (currentValue === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_value", message: "Current value must be a valid number." }));
      }

      if (!compoundingFrequency) {
        issues.push(issue({ sheetName, rowNumber, field: "compounding_frequency", message: "Invalid compounding frequency." }));
      }

      if (openingDateRaw !== undefined && !openingDate) {
        issues.push(issue({ sheetName, rowNumber, field: "opening_date", message: "Opening date is invalid." }));
      }

      if (maturityDateRaw !== undefined && !maturityDate) {
        issues.push(issue({ sheetName, rowNumber, field: "maturity_date", message: "Maturity date is invalid." }));
      }

      if (autoRenewRaw !== undefined && autoRenew === null) {
        issues.push(issue({ sheetName, rowNumber, field: "auto_renew", message: "Auto renew must be a boolean value." }));
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (
        hasErrors ||
        !depositType ||
        !institution ||
        !accountNumber ||
        !holder ||
        principal === null ||
        interestRate === null ||
        currentValue === null ||
        !compoundingFrequency ||
        autoRenew === null
      ) {
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

      const values: FixedDepositInsert = {
        deposit_type: depositType,
        institution,
        account_number: accountNumber,
        holder,
        principal,
        interest_rate: interestRate,
        current_value: currentValue,
        compounding_frequency: compoundingFrequency,
        opening_date: openingDate,
        maturity_date: maturityDate,
        auto_renew: autoRenew,
        branch: parseString(pickValue(row, ["branch"])),
        owner: parseString(pickValue(row, ["owner"])),
        nominee: parseString(pickValue(row, ["nominee"])),
        notes: parseString(pickValue(row, ["notes"])),
        documents_placeholder: parseString(pickValue(row, ["documents_placeholder", "documents placeholder"])),
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
    } as ImportValidationResult<FixedDepositImportPayload>;
  },
  async executeRows(sheetName, records) {
    const issues: ImportIssue[] = [];
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const record of records) {
      try {
        if (record.action === "update" && record.payload.id) {
          await updateFixedDeposit({ id: record.payload.id, ...record.payload.values });
          updated += 1;
        } else {
          await createFixedDeposit(record.payload.values);
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        issues.push(
          issue({
            severity: "error",
            sheetName,
            rowNumber: record.rowNumber,
            message: error instanceof Error ? error.message : "Unable to import fixed deposit row.",
          }),
        );
      }
    }

    return { inserted, updated, failed, issues };
  },
};
