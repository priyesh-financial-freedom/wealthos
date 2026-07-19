import { createInvestment, getInvestments, updateInvestment } from "@/services/investments";
import type { ImportIssue, ImportModulePlugin, ImportValidationResult, ImportValidatedRecord } from "@/services/imports/types";
import { buildNormalizedRow, isUuid, issue, parseDate, parseNumber, parseString, pickValue } from "@/services/imports/utils";
import type { InvestmentCategory, InvestmentInsert, InvestmentMode, InvestmentOptionType, InvestmentRegion } from "@/types/investment";

const categories: InvestmentCategory[] = [
  "Mutual Funds",
  "Stocks",
  "ETFs",
  "Bonds",
  "Fixed Deposits",
  "EPF",
  "PPF",
  "NPS",
  "Gold",
  "Silver",
  "Sovereign Gold Bonds",
  "Crypto",
  "Cash Equivalents",
];

const regions: InvestmentRegion[] = ["Domestic", "International"];
const investmentModes: InvestmentMode[] = ["Direct", "Regular"];
const optionTypes: InvestmentOptionType[] = ["Growth", "IDCW"];

interface InvestmentImportPayload {
  id?: string;
  values: InvestmentInsert;
}

function parseCategory(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return categories.find((item) => item.toLowerCase() === normalized) ?? null;
}

function parseRegion(value: string | null) {
  if (!value) {
    return "Domestic" as const;
  }

  const normalized = value.toLowerCase();
  return regions.find((item) => item.toLowerCase() === normalized) ?? null;
}

function parseInvestmentMode(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return investmentModes.find((item) => item.toLowerCase() === normalized) ?? null;
}

function parseOptionType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return optionTypes.find((item) => item.toLowerCase() === normalized) ?? null;
}

export const investmentsImportPlugin: ImportModulePlugin<InvestmentImportPayload> = {
  moduleId: "investments",
  displayName: "Investments",
  supportedSheets: ["Investments"],
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<InvestmentImportPayload>> = [];
    const existing = await getInvestments();
    const existingIds = new Set(existing.map((item) => item.id));

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const investmentName = parseString(pickValue(row, ["investment_name", "investment name", "name"]));
      const category = parseCategory(parseString(pickValue(row, ["category"])));
      const units = parseNumber(pickValue(row, ["units"]));
      const navPrice = parseNumber(pickValue(row, ["nav_price", "nav price"]));
      const costBasis = parseNumber(pickValue(row, ["cost_basis", "cost basis"]));
      const region = parseRegion(parseString(pickValue(row, ["region"])));
      const purchaseDateRaw = pickValue(row, ["purchase_date", "purchase date"]);
      const purchaseDate = purchaseDateRaw === undefined ? null : parseDate(purchaseDateRaw);
      const sipAmountRaw = pickValue(row, ["sip_amount", "sip amount"]);
      const sipAmount = sipAmountRaw === undefined ? null : parseNumber(sipAmountRaw);
      const sipDateRaw = pickValue(row, ["sip_date", "sip date"]);
      const sipDate = sipDateRaw === undefined ? null : parseNumber(sipDateRaw);
      const investmentModeRaw = parseString(pickValue(row, ["investment_mode", "investment mode"]));
      const investmentMode = parseInvestmentMode(investmentModeRaw);
      const optionTypeRaw = parseString(pickValue(row, ["option_type", "option type"]));
      const optionType = parseOptionType(optionTypeRaw);

      if (id && !isUuid(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "ID must be a valid UUID." }));
      }

      if (!investmentName) {
        issues.push(issue({ sheetName, rowNumber, field: "investment_name", message: "Investment name is required." }));
      }

      if (!category) {
        issues.push(issue({ sheetName, rowNumber, field: "category", message: "Invalid category." }));
      }

      if (units === null) {
        issues.push(issue({ sheetName, rowNumber, field: "units", message: "Units must be a valid number." }));
      }

      if (navPrice === null) {
        issues.push(issue({ sheetName, rowNumber, field: "nav_price", message: "NAV price must be a valid number." }));
      }

      if (costBasis === null) {
        issues.push(issue({ sheetName, rowNumber, field: "cost_basis", message: "Cost basis must be a valid number." }));
      }

      if (!region) {
        issues.push(issue({ sheetName, rowNumber, field: "region", message: "Invalid region." }));
      }

      if (purchaseDateRaw !== undefined && !purchaseDate) {
        issues.push(issue({ sheetName, rowNumber, field: "purchase_date", message: "Purchase date is invalid." }));
      }

      if (sipAmountRaw !== undefined && sipAmount === null) {
        issues.push(issue({ sheetName, rowNumber, field: "sip_amount", message: "SIP amount must be a valid number." }));
      }

      if (sipDateRaw !== undefined && (sipDate === null || !Number.isInteger(sipDate) || sipDate < 1 || sipDate > 31)) {
        issues.push(issue({ sheetName, rowNumber, field: "sip_date", message: "SIP date must be an integer between 1 and 31." }));
      }

      if (investmentModeRaw && !investmentMode) {
        issues.push(issue({ sheetName, rowNumber, field: "investment_mode", message: "Investment mode must be Direct or Regular." }));
      }

      if (optionTypeRaw && !optionType) {
        issues.push(issue({ sheetName, rowNumber, field: "option_type", message: "Option type must be Growth or IDCW." }));
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (hasErrors || !investmentName || !category || units === null || navPrice === null || costBasis === null || !region) {
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

      const values: InvestmentInsert = {
        investment_name: investmentName,
        category,
        units,
        nav_price: navPrice,
        cost_basis: costBasis,
        today_gain_loss: parseNumber(pickValue(row, ["today_gain_loss", "today gain loss"])) ?? 0,
        sector: parseString(pickValue(row, ["sector"])),
        amc: parseString(pickValue(row, ["amc"])),
        region,
        purchase_date: purchaseDate,
        owner: parseString(pickValue(row, ["owner"])),
        folio_number: parseString(pickValue(row, ["folio_number", "folio number"])),
        amfi_scheme_code: parseString(pickValue(row, ["amfi_scheme_code", "amfi scheme code"])),
        sip_amount: sipAmount,
        sip_date: sipDate,
        investment_mode: investmentMode,
        option_type: optionType,
        broker_platform: parseString(pickValue(row, ["broker_platform", "broker platform"])),
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
    } as ImportValidationResult<InvestmentImportPayload>;
  },
  async executeRows(sheetName, records) {
    const issues: ImportIssue[] = [];
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const record of records) {
      try {
        if (record.action === "update" && record.payload.id) {
          await updateInvestment({ id: record.payload.id, ...record.payload.values });
          updated += 1;
        } else {
          await createInvestment(record.payload.values);
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        issues.push(
          issue({
            severity: "error",
            sheetName,
            rowNumber: record.rowNumber,
            message: error instanceof Error ? error.message : "Unable to import investment row.",
          }),
        );
      }
    }

    return { inserted, updated, failed, issues };
  },
};
