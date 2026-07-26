import { createInvestment, createInvestmentMonthlyHistory, getInvestments, updateInvestment } from "@/services/investments";
import { upsertMutualFundSchemeMaster } from "@/services/investments/mutualFundSchemeMaster";
import type {
  ImportColumnMappingEntry,
  ImportIssue,
  ImportModulePlugin,
  ImportRawRow,
  ImportValidationResult,
  ImportValidatedRecord,
} from "@/services/imports/types";
import { buildNormalizedRow, isUuid, issue, normalizeKey, parseDate, parseNumber, parseString, pickValue } from "@/services/imports/utils";
import type { InvestmentCategory, InvestmentInsert, InvestmentMode, InvestmentOptionType, InvestmentRegion } from "@/types/investment";

const categories: InvestmentCategory[] = [
  "Mutual Funds",
  "Stocks",
  "Bonds",
  "Fixed Deposits",
  "Gold",
  "ESOPs",
  "Startup Investments",
  "Other Investments",
  "ETFs",
  "EPF",
  "PPF",
  "NPS",
  "Silver",
  "Sovereign Gold Bonds",
  "Crypto",
  "Cash Equivalents",
];

const regions: InvestmentRegion[] = ["Domestic", "International"];
const investmentModes: InvestmentMode[] = ["Direct", "Regular"];
const optionTypes: InvestmentOptionType[] = ["Growth", "IDCW"];

const investmentNameAliases = [
  "investment_name",
  "investment name",
  "scheme_name",
  "scheme name",
  "name",
];
const categoryAliases = ["category", "investment_type", "investment type"];
const ownerAliases = ["owner"];
const nomineeAliases = ["nominee"];
const amcAliases = ["amc", "fund_house", "fund house", "asset_management_company", "asset management company"];
const amfiSchemeCodeAliases = [
  "amfi_scheme_code",
  "amfi scheme code",
  "scheme_code",
  "scheme code",
  "amfi code",
];
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
const investmentModeAliases = ["investment_mode", "investment mode", "mode"];
const optionTypeAliases = ["option_type", "option type", "option"];
const brokerPlatformAliases = ["broker_platform", "broker platform", "platform"];
const unitsAliases = ["units", "unit", "total_units", "total units", "units_held", "units held"];
const navPriceAliases = ["nav_price", "nav price", "current_nav", "current nav", "nav"];
const currentMarketValueAliases = [
  "current_market_value",
  "current market value",
  "current_value",
  "current value",
  "market_value",
  "market value",
];
const costBasisAliases = ["cost_basis", "cost basis", "purchase_value", "purchase value", "invested_value", "invested value"];
const sipAmountAliases = ["sip_amount", "sip amount", "monthly_sip", "monthly sip"];
const sipDateAliases = ["sip_date", "sip date"];
const purchaseDateAliases = ["purchase_date", "purchase date", "acquisition_date", "acquisition date"];
const regionAliases = ["region"];
const sectorAliases = ["sector", "sector_theme", "sector theme", "theme", "sector / theme"];
const notesAliases = ["notes"];
const documentsAliases = ["documents_placeholder", "documents placeholder", "documents"];
const monthEndDateAliases = ["month_end_date", "month end date", "as_of_date", "as of date"];
const monthEndValueAliases = ["month_end_value", "month end value", "closing_value", "closing value"];

const stockCurrentPriceAliases = ["current_price", "current price", "price", ...navPriceAliases];
const stockAveragePurchasePriceAliases = [
  "average_purchase_price",
  "average purchase price",
  "avg_purchase_price",
  "avg purchase price",
  "average price",
  "purchase price",
];
const stockBrokerAliases = ["broker", ...brokerPlatformAliases];
const stockExchangeAliases = ["exchange"];
const stockIsinAliases = ["isin", "i_s_i_n"];

const calculatedOnlyAliases = {
  currentValue: currentMarketValueAliases,
  gainLoss: ["gain_loss", "gain loss", "today_gain_loss", "today gain loss", "unrealized_gain_loss", "unrealized gain loss"],
  gainPercent: ["gain_percent", "gain %", "gain_percentage", "gain percentage", "return %"],
};

const investmentColumnConfig: Array<{ field: string; required: boolean; aliases: string[] }> = [
  { field: "id", required: false, aliases: ["id"] },
  { field: "investment_name", required: true, aliases: investmentNameAliases },
  { field: "category", required: false, aliases: categoryAliases },
  { field: "amc", required: false, aliases: amcAliases },
  { field: "amfi_scheme_code", required: false, aliases: amfiSchemeCodeAliases },
  { field: "folio_number", required: false, aliases: folioNumberAliases },
  { field: "owner", required: false, aliases: ownerAliases },
  { field: "nominee", required: false, aliases: nomineeAliases },
  { field: "investment_mode", required: false, aliases: investmentModeAliases },
  { field: "option_type", required: false, aliases: optionTypeAliases },
  { field: "broker_platform", required: false, aliases: brokerPlatformAliases },
  { field: "units", required: true, aliases: unitsAliases },
  { field: "nav_price", required: true, aliases: navPriceAliases },
  { field: "current_market_value", required: false, aliases: currentMarketValueAliases },
  { field: "cost_basis", required: true, aliases: costBasisAliases },
  { field: "sip_amount", required: false, aliases: sipAmountAliases },
  { field: "sip_date", required: false, aliases: sipDateAliases },
  { field: "purchase_date", required: false, aliases: purchaseDateAliases },
  { field: "region", required: false, aliases: regionAliases },
  { field: "sector", required: false, aliases: sectorAliases },
  { field: "notes", required: false, aliases: notesAliases },
  { field: "documents_placeholder", required: false, aliases: documentsAliases },
  { field: "month_end_date", required: false, aliases: monthEndDateAliases },
  { field: "month_end_value", required: false, aliases: monthEndValueAliases },
  { field: "gain_loss_calculated", required: false, aliases: calculatedOnlyAliases.gainLoss },
  { field: "gain_percent_calculated", required: false, aliases: calculatedOnlyAliases.gainPercent },
  { field: "average_purchase_price", required: false, aliases: stockAveragePurchasePriceAliases },
  { field: "current_price", required: false, aliases: stockCurrentPriceAliases },
  { field: "broker", required: false, aliases: stockBrokerAliases },
  { field: "exchange", required: false, aliases: stockExchangeAliases },
  { field: "isin", required: false, aliases: stockIsinAliases },
];

interface InvestmentImportPayload {
  id?: string;
  values: InvestmentInsert;
  monthEndDate?: string | null;
  monthEndValue?: number | null;
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

function resolveInvestmentColumnMapping(rows: ImportRawRow[]): ImportColumnMappingEntry[] {
  const workbookHeaders = collectWorkbookHeaders(rows);

  return investmentColumnConfig.map((config) => {
    const workbookColumn =
      config.aliases.map((alias) => workbookHeaders.get(normalizeKey(alias)) ?? null).find((value) => value !== null) ?? null;

    return {
      field: config.field,
      workbookColumn,
      required: config.required,
    };
  });
}

function endOfMonthIso(dateString: string | null) {
  if (!dateString) {
    return new Date().toISOString().slice(0, 10);
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const end = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

function mutualFundKey(params: { owner: string | null; folio: string | null; amfiSchemeCode: string | null }) {
  return `${(params.owner ?? "").trim().toLowerCase()}::${(params.folio ?? "").trim().toLowerCase()}::${(params.amfiSchemeCode ?? "").trim().toLowerCase()}`;
}

function isValidAmfiSchemeCode(value: string | null) {
  if (!value) {
    return false;
  }

  return /^\d{6,12}$/.test(value.trim());
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
  getColumnMapping(_sheetName, rows) {
    return resolveInvestmentColumnMapping(rows);
  },
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<InvestmentImportPayload>> = [];
    const existing = await getInvestments();
    const existingIds = new Set(existing.map((item) => item.id));
    const existingMutualFundsByKey = existing
      .filter((item) => item.investment_type === "Mutual Funds")
      .reduce<Map<string, string>>((acc, item) => {
        acc.set(
          mutualFundKey({ owner: item.owner, folio: item.folio_number, amfiSchemeCode: item.amfi_scheme_code }),
          item.id,
        );
        return acc;
      }, new Map());
    const stockSheet = isStockSheet(sheetName);
    const inBatchMutualFundKeys = new Set<string>();

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const investmentName = parseString(pickValue(row, investmentNameAliases));
      const parsedCategory = parseCategory(parseString(pickValue(row, categoryAliases)));
      const category = stockSheet ? parsedCategory ?? "Stocks" : parsedCategory ?? "Mutual Funds";

      const units = parseNumber(pickValue(row, unitsAliases));
      const navPrice = stockSheet
        ? parseNumber(pickValue(row, stockCurrentPriceAliases))
        : parseNumber(pickValue(row, navPriceAliases));
      const explicitCurrentMarketValueRaw = pickValue(row, currentMarketValueAliases);
      const explicitCurrentMarketValue =
        explicitCurrentMarketValueRaw === undefined ? null : parseNumber(explicitCurrentMarketValueRaw);

      const costBasisRaw = pickValue(row, costBasisAliases);
      const costBasisFromWorkbook = costBasisRaw === undefined ? null : parseNumber(costBasisRaw);
      const averagePurchasePrice = parseNumber(pickValue(row, stockAveragePurchasePriceAliases));
      const derivedCostBasisFromAverage =
        units !== null && averagePurchasePrice !== null ? Number((units * averagePurchasePrice).toFixed(2)) : null;
      const costBasis = stockSheet
        ? (costBasisFromWorkbook ?? derivedCostBasisFromAverage)
        : costBasisFromWorkbook;

      const computedCurrentValue =
        units !== null && navPrice !== null ? Number((units * navPrice).toFixed(2)) : null;
      const resolvedCurrentValue = computedCurrentValue ?? explicitCurrentMarketValue;

      const region = parseRegion(parseString(pickValue(row, regionAliases)));
      const purchaseDateRaw = pickValue(row, purchaseDateAliases);
      const purchaseDate = purchaseDateRaw === undefined ? null : parseDate(purchaseDateRaw);
      const owner = parseString(pickValue(row, ownerAliases));
      const stockBroker = parseString(pickValue(row, stockBrokerAliases));
      const stockExchange = parseString(pickValue(row, stockExchangeAliases));
      const stockIsin = parseString(pickValue(row, stockIsinAliases));
      const sipAmountRaw = pickValue(row, sipAmountAliases);
      const sipAmount = sipAmountRaw === undefined ? null : parseNumber(sipAmountRaw);
      const sipDateRaw = pickValue(row, sipDateAliases);
      const sipDate = sipDateRaw === undefined ? null : parseNumber(sipDateRaw);
      const investmentModeRaw = parseString(pickValue(row, investmentModeAliases));
      const investmentMode = parseInvestmentMode(investmentModeRaw);
      const optionTypeRaw = parseString(pickValue(row, optionTypeAliases));
      const optionType = parseOptionType(optionTypeRaw);

      const folioNumber = stockSheet ? null : parseString(pickValue(row, folioNumberAliases));
      const amfiSchemeCode = stockSheet ? null : parseString(pickValue(row, amfiSchemeCodeAliases));

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

      if (costBasis === null) {
        issues.push(
          issue({
            sheetName,
            rowNumber,
            field: stockSheet ? "cost_basis" : "cost_basis",
            message: "Purchase value / cost basis must be a valid number.",
          }),
        );
      }

      if (stockSheet && !owner) {
        issues.push(issue({ sheetName, rowNumber, field: "owner", message: "Owner is required for stock imports." }));
      }

      if (category === "Mutual Funds") {
        if (!owner) {
          issues.push(issue({ sheetName, rowNumber, field: "owner", message: "Owner is required for Mutual Fund imports." }));
        }

        if (!folioNumber) {
          issues.push(issue({ sheetName, rowNumber, field: "folio_number", message: "Folio Number is required for Mutual Fund imports." }));
        }

        if (!amfiSchemeCode) {
          issues.push(issue({ sheetName, rowNumber, field: "amfi_scheme_code", message: "AMFI Scheme Code is required for Mutual Fund imports." }));
        } else if (!isValidAmfiSchemeCode(amfiSchemeCode)) {
          issues.push(issue({ sheetName, rowNumber, field: "amfi_scheme_code", message: "AMFI Scheme Code must be a 6 to 12 digit number." }));
        }
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

      if (units !== null && units < 0) {
        issues.push(issue({ sheetName, rowNumber, field: "units", message: "Units must be zero or greater." }));
      }

      if (navPrice !== null && navPrice < 0) {
        issues.push(
          issue({
            sheetName,
            rowNumber,
            field: stockSheet ? "current_price" : "nav_price",
            message: stockSheet ? "Current price must be zero or greater." : "NAV price must be zero or greater.",
          }),
        );
      }

      if (costBasis !== null && costBasis < 0) {
        issues.push(issue({ sheetName, rowNumber, field: "cost_basis", message: "Cost basis must be zero or greater." }));
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

      if (explicitCurrentMarketValueRaw !== undefined && explicitCurrentMarketValue === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_market_value", message: "Current market value must be a valid number." }));
      }

      const providedGainLoss = pickValue(row, calculatedOnlyAliases.gainLoss);
      const providedGainPercent = pickValue(row, calculatedOnlyAliases.gainPercent);

      if (category === "Mutual Funds" && explicitCurrentMarketValueRaw !== undefined) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "current_market_value",
            message: "Current market value column is not imported for Mutual Funds. Importer recalculates as Units x Current NAV.",
          }),
        );
      }

      if (providedGainLoss !== undefined) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "gain_loss",
            message: "Gain/Loss columns are ignored during import. Value is recalculated as Current Value - Purchase Value.",
          }),
        );
      }

      if (providedGainPercent !== undefined) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "gain_percent",
            message: "Gain % columns are ignored during import. Value is recalculated from Gain/Loss and Purchase Value.",
          }),
        );
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (hasErrors || !investmentName || !category || units === null || navPrice === null || costBasis === null || !region) {
        return;
      }

      if (resolvedCurrentValue === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_market_value", message: "Unable to derive current value from Units and NAV." }));
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

      const todayGainLoss = Number((resolvedCurrentValue - costBasis).toFixed(2));

      const values: InvestmentInsert = {
        investment_name: investmentName,
        category,
        units,
        nav_price: navPrice,
        current_value: resolvedCurrentValue,
        cost_basis: costBasis,
        today_gain_loss: todayGainLoss,
        sector: parseString(pickValue(row, sectorAliases)),
        amc: stockSheet ? null : parseString(pickValue(row, amcAliases)),
        region,
        purchase_date: purchaseDate,
        owner,
        folio_number: stockSheet ? null : folioNumber,
        amfi_scheme_code: stockSheet ? null : amfiSchemeCode,
        sip_amount: stockSheet ? null : sipAmount,
        sip_date: stockSheet ? null : sipDate,
        investment_mode: stockSheet ? null : investmentMode,
        option_type: stockSheet ? null : optionType,
        broker_platform: stockSheet ? null : parseString(pickValue(row, brokerPlatformAliases)),
        nominee: stockSheet ? null : parseString(pickValue(row, nomineeAliases)),
        notes: parseString(pickValue(row, notesAliases)),
        documents_placeholder: parseString(pickValue(row, documentsAliases)),
        broker: stockSheet ? stockBroker : null,
        exchange: stockSheet ? stockExchange : null,
        isin: stockSheet ? stockIsin : null,
        average_purchase_price: stockSheet ? averagePurchasePrice : null,
      };

      if (category === "Mutual Funds") {
        const inBatchKey = mutualFundKey({
          owner,
          folio: folioNumber,
          amfiSchemeCode,
        });

        if (inBatchMutualFundKeys.has(inBatchKey)) {
          issues.push(
            issue({
              severity: "warning",
              sheetName,
              rowNumber,
              field: "amfi_scheme_code",
              message: "Duplicate Mutual Fund row in this file (Owner + Folio + AMFI Code). Row will be skipped.",
            }),
          );
          return;
        }

        inBatchMutualFundKeys.add(inBatchKey);
      }

      const duplicateMutualFundId =
        category === "Mutual Funds"
          ? existingMutualFundsByKey.get(
              mutualFundKey({
                owner,
                folio: folioNumber,
                amfiSchemeCode,
              }),
            )
          : undefined;

      if (!id && duplicateMutualFundId) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "amfi_scheme_code",
            message: "Matching Mutual Fund (Owner + Folio + AMFI Code) already exists. Row will update existing holding.",
          }),
        );
      }

      const monthEndDateRaw = parseString(pickValue(row, monthEndDateAliases));
      const monthEndDate = monthEndDateRaw ? parseDate(monthEndDateRaw) : null;
      const monthEndValueRaw = parseNumber(pickValue(row, monthEndValueAliases));
      const monthEndValue = monthEndValueRaw ?? resolvedCurrentValue;

      if (monthEndDateRaw && !monthEndDate) {
        issues.push(issue({ sheetName, rowNumber, field: "month_end_date", message: "Month-end date is invalid." }));
      }

      records.push({
        rowNumber,
        action: (id && existingIds.has(id)) || Boolean(!id && duplicateMutualFundId) ? "update" : "create",
        payload: {
          id: id && existingIds.has(id) ? id : duplicateMutualFundId,
          values,
          monthEndDate,
          monthEndValue,
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
          const updatedInvestment = await updateInvestment({ id: record.payload.id, ...record.payload.values });

          if (record.payload.values.category === "Mutual Funds") {
            await upsertMutualFundSchemeMaster({
              schemeName: record.payload.values.investment_name,
              amc: record.payload.values.amc ?? record.payload.values.institution ?? null,
              amfiSchemeCode: record.payload.values.amfi_scheme_code ?? null,
              investmentMode: record.payload.values.investment_mode ?? null,
              optionType: record.payload.values.option_type ?? null,
              category: record.payload.values.category,
            });
          }

          if (record.payload.values.category === "Mutual Funds" && record.payload.monthEndValue !== null && record.payload.monthEndValue !== undefined) {
            try {
              await createInvestmentMonthlyHistory({
                investment_id: updatedInvestment.id,
                month_end_date: endOfMonthIso(record.payload.monthEndDate ?? updatedInvestment.purchase_date ?? null),
                closing_value: Number(record.payload.monthEndValue),
                notes: "Imported from workbook",
              });
            } catch (historyError) {
              const message = historyError instanceof Error ? historyError.message : "Unable to create month-end value history.";
              if (!message.toLowerCase().includes("duplicate") && !message.toLowerCase().includes("unique")) {
                throw historyError;
              }
            }
          }

          updated += 1;
        } else {
          const createdInvestment = await createInvestment(record.payload.values);

          if (record.payload.values.category === "Mutual Funds") {
            await upsertMutualFundSchemeMaster({
              schemeName: record.payload.values.investment_name,
              amc: record.payload.values.amc ?? record.payload.values.institution ?? null,
              amfiSchemeCode: record.payload.values.amfi_scheme_code ?? null,
              investmentMode: record.payload.values.investment_mode ?? null,
              optionType: record.payload.values.option_type ?? null,
              category: record.payload.values.category,
            });
          }

          if (record.payload.values.category === "Mutual Funds" && record.payload.monthEndValue !== null && record.payload.monthEndValue !== undefined) {
            try {
              await createInvestmentMonthlyHistory({
                investment_id: createdInvestment.id,
                month_end_date: endOfMonthIso(record.payload.monthEndDate ?? createdInvestment.purchase_date ?? null),
                closing_value: Number(record.payload.monthEndValue),
                notes: "Imported from workbook",
              });
            } catch (historyError) {
              const message = historyError instanceof Error ? historyError.message : "Unable to create month-end value history.";
              if (!message.toLowerCase().includes("duplicate") && !message.toLowerCase().includes("unique")) {
                throw historyError;
              }
            }
          }

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
