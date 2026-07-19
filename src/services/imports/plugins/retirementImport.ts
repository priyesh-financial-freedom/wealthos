import { createRetirementAccount, getRetirementAccounts, updateRetirementAccount } from "@/services/retirement";
import type { ImportIssue, ImportModulePlugin, ImportValidationResult, ImportValidatedRecord } from "@/services/imports/types";
import { buildNormalizedRow, isUuid, issue, parseDate, parseNumber, parseString, pickValue } from "@/services/imports/utils";
import type { ContributionFrequency, ContributionMonth, RetirementAccountInsert, RetirementAccountType } from "@/types/retirementAccount";

interface RetirementImportPayload {
  id?: string;
  values: RetirementAccountInsert;
}

const contributionFrequencies: ContributionFrequency[] = ["Monthly", "Quarterly", "Annual", "One-time"];
const contributionMonths: ContributionMonth[] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseAccountTypeFromSheet(sheetName: string): RetirementAccountType | null {
  const normalized = sheetName.trim().toLowerCase();
  if (normalized.includes("ppf")) {
    return "PPF";
  }
  if (normalized.includes("epf")) {
    return "EPF";
  }
  if (normalized.includes("nps")) {
    return "NPS";
  }
  return null;
}

function parseContributionFrequency(value: string | null): ContributionFrequency | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return contributionFrequencies.find((item) => item.toLowerCase() === normalized) ?? null;
}

function parseContributionMonth(value: string | null): ContributionMonth | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return contributionMonths.find((item) => item.toLowerCase() === normalized) ?? null;
}

export const retirementImportPlugin: ImportModulePlugin<RetirementImportPayload> = {
  moduleId: "retirement",
  displayName: "Retirement",
  supportedSheets: ["PPF Accounts", "EPF Accounts", "NPS Accounts"],
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<RetirementImportPayload>> = [];
    const existing = await getRetirementAccounts();
    const existingById = new Map(existing.map((item) => [item.id, item] as const));
    const accountType = parseAccountTypeFromSheet(sheetName);

    if (!accountType) {
      return {
        totalRows: rows.length,
        records: [],
        issues: [
          issue({
            sheetName,
            rowNumber: 1,
            field: "sheet_name",
            message: "Unsupported retirement sheet. Use PPF Accounts, EPF Accounts, or NPS Accounts.",
          }),
        ],
      };
    }

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const owner = parseString(pickValue(row, ["owner", "holder", "holder_name", "holder name"]));
      const institution = parseString(pickValue(row, ["institution"]));
      const currentBalance = parseNumber(pickValue(row, ["current_balance", "current balance"]));
      const accountNumber = parseString(pickValue(row, ["account_number", "account number"]));
      const openingDateRaw = pickValue(row, ["opening_date", "opening date"]);
      const openingDate = openingDateRaw === undefined ? null : parseDate(openingDateRaw);
      const contributionFrequency = parseContributionFrequency(parseString(pickValue(row, ["contribution_frequency", "contribution frequency"])));
      const contributionAmount = parseNumber(pickValue(row, ["contribution_amount", "contribution amount"]));
      const contributionDay = parseNumber(pickValue(row, ["contribution_day", "contribution day"]));
      const contributionMonth = parseContributionMonth(parseString(pickValue(row, ["contribution_month", "contribution month"])));

      if (id && !isUuid(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "ID must be a valid UUID." }));
      }

      if (!owner) {
        issues.push(issue({ sheetName, rowNumber, field: "owner", message: "Owner is required." }));
      }

      if (!institution) {
        issues.push(issue({ sheetName, rowNumber, field: "institution", message: "Institution is required." }));
      }

      if (currentBalance === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_balance", message: "Current balance must be a valid number." }));
      }

      if (!contributionFrequency) {
        issues.push(issue({ sheetName, rowNumber, field: "contribution_frequency", message: "Contribution frequency is required." }));
      }

      if (contributionAmount === null) {
        issues.push(issue({ sheetName, rowNumber, field: "contribution_amount", message: "Contribution amount must be a valid number." }));
      }

      if (contributionDay !== null && (contributionDay < 1 || contributionDay > 31)) {
        issues.push(issue({ sheetName, rowNumber, field: "contribution_day", message: "Contribution day must be between 1 and 31." }));
      }

      if (contributionFrequency === "Annual" && !contributionMonth) {
        issues.push(issue({ sheetName, rowNumber, field: "contribution_month", message: "Contribution month is required for annual frequency." }));
      }

      if (openingDateRaw !== undefined && !openingDate) {
        issues.push(issue({ sheetName, rowNumber, field: "opening_date", message: "Opening date is invalid." }));
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (hasErrors || !owner || !institution || currentBalance === null || !contributionFrequency || contributionAmount === null) {
        return;
      }

      const existingAccount = id ? existingById.get(id) : null;

      if (id && !existingAccount) {
        issues.push(issue({
          sheetName,
          rowNumber,
          field: "id",
          message: "ID does not exist for this user. Record will be created instead.",
          severity: "warning",
        }));
      }

      const baseValues = {
        account_type: accountType,
        owner,
        institution,
        current_balance: currentBalance,
        account_number: accountNumber,
        opening_date: openingDate,
        interest_rate: parseNumber(pickValue(row, ["interest_rate", "interest rate"])),
        nominee: parseString(pickValue(row, ["nominee"])),
        notes: parseString(pickValue(row, ["notes"])),
        contribution_frequency: contributionFrequency,
        contribution_amount: contributionAmount,
        contribution_day: contributionDay,
        contribution_month: contributionFrequency === "Annual" ? contributionMonth : null,
      };

      let values: RetirementAccountInsert;

      if (accountType === "PPF") {
        values = {
          ...baseValues,
          account_type: "PPF",
          maturity_date: parseDate(pickValue(row, ["maturity_date", "maturity date"])),
        };
      } else if (accountType === "EPF") {
        values = {
          ...baseValues,
          account_type: "EPF",
          employer: parseString(pickValue(row, ["employer"])),
          uan: parseString(pickValue(row, ["uan"])),
          employee_contribution: parseNumber(pickValue(row, ["employee_contribution", "employee contribution"])),
          employer_contribution: parseNumber(pickValue(row, ["employer_contribution", "employer contribution"])),
        };
      } else {
        values = {
          ...baseValues,
          account_type: "NPS",
          pran: parseString(pickValue(row, ["pran"])),
          pop: parseString(pickValue(row, ["pop"])),
          equity_percent: parseNumber(pickValue(row, ["equity_percent", "equity %", "equity percentage"])),
          corporate_debt_percent: parseNumber(pickValue(row, ["corporate_debt_percent", "corporate debt %", "corporate debt percentage"])),
          government_securities_percent: parseNumber(pickValue(row, ["government_securities_percent", "government securities %", "government securities percentage"])),
          alternative_assets_percent: parseNumber(pickValue(row, ["alternative_assets_percent", "alternative assets %", "alternative assets percentage"])),
        };
      }

      records.push({
        rowNumber,
        action: id && existingAccount && existingAccount.account_type === accountType ? "update" : "create",
        payload: {
          id: id && existingAccount && existingAccount.account_type === accountType ? id : undefined,
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
