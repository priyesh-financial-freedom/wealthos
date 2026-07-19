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
const folioNumberAliases = [
  "folio_number",
  "folio number",
  "folio no",
  "folio no.",
  "folio #",
  "folio",
  "foliono",
  "folio no#",
];

interface InvestmentImportPayload {
  id?: string;
  values: InvestmentInsert;
}

function isStockSheet(sheetName: string) {
  return sheetName.trim().toLowerCase() === "stock holdings";
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
    const stockSheet = isStockSheet(sheetName);

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const investmentName = parseString(pickValue(row, ["investment_name", "investment name", "name"]));
      const parsedCategory = parseCategory(parseString(pickValue(row, ["category"])));
      const category = stockSheet ? parsedCategory ?? "Stocks" : parsedCategory;
      const units = parseNumber(pickValue(row, ["units"]));
      const averagePurchasePrice = parseNumber(
        pickValue(row, ["average_purchase_price", "average purchase price", "avg purchase price", "average price", "purchase price"]),
      );
      const navPrice = stockSheet
        ? parseNumber(pickValue(row, ["current_price", "current price", "nav_price", "nav price", "price"]))
        : parseNumber(pickValue(row, ["nav_price", "nav price"]));
      const costBasis = stockSheet ? null : parseNumber(pickValue(row, ["cost_basis", "cost basis"]));
      const region = parseRegion(parseString(pickValue(row, ["region"])));
      const purchaseDateRaw = pickValue(row, ["purchase_date", "purchase date"]);
      const purchaseDate = purchaseDateRaw === undefined ? null : parseDate(purchaseDateRaw);
      const owner = parseString(pickValue(row, ["owner"]));
      const stockBroker = parseString(pickValue(row, ["broker", "broker_platform", "broker platform", "platform"]));
      const stockExchange = parseString(pickValue(row, ["exchange"]));
      const stockIsin = parseString(pickValue(row, ["isin", "i_s_i_n"]));
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

      if (stockSheet && category && category !== "Stocks") {
        issues.push(issue({ sheetName, rowNumber, field: "category", message: "Category must be Stocks for this sheet." }));
      }

      if (units === null) {
        issues.push(issue({ sheetName, rowNumber, field: "units", message: "Units must be a valid number." }));
      }

      if (navPrice === null) {
        issues.push(
          issue({
            sheetName,
            rowNumber,
            field: stockSheet ? "current_price" : "nav_price",
            message: stockSheet ? "Current price must be a valid number." : "NAV price must be a valid number.",
          }),
        );
      }

      if (!stockSheet && costBasis === null) {
        issues.push(issue({ sheetName, rowNumber, field: "cost_basis", message: "Cost basis must be a valid number." }));
      }

      if (stockSheet && averagePurchasePrice === null) {
        issues.push(issue({ sheetName, rowNumber, field: "average_purchase_price", message: "Average purchase price must be a valid number." }));
      }

      if (stockSheet && !owner) {
        issues.push(issue({ sheetName, rowNumber, field: "owner", message: "Owner is required for stock imports." }));
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
      if (
        hasErrors ||
        !investmentName ||
        !category ||
        units === null ||
        navPrice === null ||
        (!stockSheet && costBasis === null) ||
        (stockSheet && averagePurchasePrice === null) ||
        !region
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

      const values: InvestmentInsert = {
        investment_name: investmentName,
        category,
        units,
        nav_price: navPrice,
        cost_basis: stockSheet ? Number((units * (averagePurchasePrice ?? 0)).toFixed(2)) : (costBasis ?? 0),
        today_gain_loss: stockSheet ? 0 : parseNumber(pickValue(row, ["today_gain_loss", "today gain loss"])) ?? 0,
        sector: parseString(pickValue(row, ["sector"])),
        amc: stockSheet ? null : parseString(pickValue(row, ["amc"])),
        region,
        purchase_date: purchaseDate,
        owner,
        folio_number: stockSheet ? null : parseString(pickValue(row, folioNumberAliases)),
        amfi_scheme_code: stockSheet ? null : parseString(pickValue(row, ["amfi_scheme_code", "amfi scheme code"])),
        sip_amount: stockSheet ? null : sipAmount,
        sip_date: stockSheet ? null : sipDate,
        investment_mode: stockSheet ? null : investmentMode,
        option_type: stockSheet ? null : optionType,
        broker_platform: stockSheet ? null : parseString(pickValue(row, ["broker_platform", "broker platform"])),
        nominee: stockSheet ? null : parseString(pickValue(row, ["nominee"])),
        notes: parseString(pickValue(row, ["notes"])),
        broker: stockSheet ? stockBroker : null,
        exchange: stockSheet ? stockExchange : null,
        isin: stockSheet ? stockIsin : null,
        average_purchase_price: stockSheet ? averagePurchasePrice : null,
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
    const stockSheet = isStockSheet(sheetName);

    console.info("[Stocks Import Execute] executeRows entered", {
      sheetName,
      stockSheet,
      rowsEnteringExecuteRows: records.length,
    });

    if (stockSheet && records.length === 0) {
      console.warn("[Stocks Import Execute] executeRows called with zero records for stock sheet", {
        sheetName,
        rowsEnteringExecuteRows: 0,
      });
    }

    for (const record of records) {
      try {
        if (stockSheet) {
          console.info("[Stocks Import Execute] Row payload", {
            sheetName,
            rowNumber: record.rowNumber,
            action: record.action,
            payloadPassedToInsert: record.payload.values,
          });
        }

        if (record.action === "update" && record.payload.id) {
          await updateInvestment({ id: record.payload.id, ...record.payload.values });
          updated += 1;
        } else {
          await createInvestment(record.payload.values);
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        if (stockSheet) {
          console.error("[Stocks Import Execute] Supabase insert/update error", {
            sheetName,
            rowNumber: record.rowNumber,
            action: record.action,
            payloadPassedToInsert: record.payload.values,
            error: error instanceof Error ? error.message : String(error),
          });
        }

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

    if (stockSheet) {
      console.info("[Stocks Import Execute] Summary", {
        sheetName,
        rowsEnteringExecuteRows: records.length,
        rowsActuallyInserted: inserted,
        rowsUpdated: updated,
        rowsFailed: failed,
      });
    }

    return { inserted, updated, failed, issues };
  },
};
