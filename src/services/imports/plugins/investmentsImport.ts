import { createInvestment, createInvestmentMonthlyHistory, getInvestments, updateInvestment } from "@/services/investments";
import { computeFixedDepositValues } from "@/services/investments/fixedDeposits";
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
const fdCompoundingFrequencies = ["monthly", "quarterly", "half-yearly", "yearly"] as const;
const fdPayoutTypes = ["cumulative", "monthly-payout", "quarterly-payout", "annual-payout"] as const;

const investmentNameAliases = [
  "investment_name",
  "investment name",
  "company_name",
  "company name",
  "company",
  "stock_name",
  "stock name",
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
const unitsAliases = ["units", "unit", "quantity", "qty", "total_units", "total units", "units_held", "units held"];
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
  "average_buy_price",
  "average buy price",
  "avg buy price",
  "avg_purchase_price",
  "avg purchase price",
  "average price",
  "purchase price",
];
const stockBrokerAliases = ["broker", ...brokerPlatformAliases];
const stockExchangeAliases = ["exchange"];
const stockIsinAliases = ["isin", "i_s_i_n"];
const stockSymbolAliases = ["symbol", "ticker", "stock_symbol", "stock symbol", "trading_symbol", "trading symbol"];
const stockDematProviderAliases = [
  "demat_account_provider",
  "demat account provider",
  "demat_provider",
  "demat provider",
  "dp_name",
  "dp name",
];
const stockDematAccountAliases = [
  "demat_account_number",
  "demat account number",
  "demat_account",
  "demat account",
  "dp_id",
  "dp id",
  "beneficiary_id",
  "beneficiary id",
  "bo_id",
  "bo id",
];

const fdBankAliases = ["institution", "bank", "bank_name", "bank name", "issuer", "issuer name"];
const fdNumberAliases = ["fd_number", "fd number", "fd_no", "fd no", "deposit_number", "deposit number", "receipt_number", "receipt number"];
const fdPrincipalAliases = ["principal", "principal_amount", "principal amount", "deposit_amount", "deposit amount", ...costBasisAliases];
const fdInterestRateAliases = ["interest_rate", "interest rate", "rate", "roi", "rate_of_interest", "rate of interest"];
const fdCompoundingFrequencyAliases = ["compounding_frequency", "compounding frequency", "compounding", "compound frequency"];
const fdPayoutTypeAliases = ["payout_type", "payout type", "interest_payout", "interest payout", "fd_type", "fd type"];
const fdStartDateAliases = ["start_date", "start date", "booking_date", "booking date", ...purchaseDateAliases];
const fdMaturityDateAliases = ["maturity_date", "maturity date", "end_date", "end date"];
const fdMaturityValueAliases = ["maturity_value", "maturity value", "maturity_amount", "maturity amount"];

const bondIssuerAliases = ["issuer", "issuer_name", "issuer name", ...fdBankAliases];
const bondNameAliases = ["bond_name", "bond name", ...investmentNameAliases];
const bondTypeAliases = ["bond_type", "bond type", "security_type", "security type"];
const bondFaceValueAliases = ["face_value", "face value", "par_value", "par value"];
const bondCouponRateAliases = ["coupon_rate", "coupon rate", "coupon", "coupon %"];
const bondCouponFrequencyAliases = ["coupon_frequency", "coupon frequency", "interest_frequency", "interest frequency"];
const bondPurchasePriceAliases = ["purchase_price", "purchase price", ...stockAveragePurchasePriceAliases];
const bondCurrentMarketPriceAliases = ["current_market_price", "current market price", ...stockCurrentPriceAliases];
const bondQuantityAliases = ["quantity", "qty", ...unitsAliases];
const bondBrokerAliases = ["broker", ...stockBrokerAliases];

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
  { field: "symbol", required: false, aliases: stockSymbolAliases },
  { field: "demat_account_provider", required: false, aliases: stockDematProviderAliases },
  { field: "demat_account_number", required: false, aliases: stockDematAccountAliases },
  { field: "institution", required: false, aliases: fdBankAliases },
  { field: "fd_number", required: false, aliases: fdNumberAliases },
  { field: "principal", required: false, aliases: fdPrincipalAliases },
  { field: "interest_rate", required: false, aliases: fdInterestRateAliases },
  { field: "compounding_frequency", required: false, aliases: fdCompoundingFrequencyAliases },
  { field: "payout_type", required: false, aliases: fdPayoutTypeAliases },
  { field: "start_date", required: false, aliases: fdStartDateAliases },
  { field: "maturity_date", required: false, aliases: fdMaturityDateAliases },
  { field: "maturity_value", required: false, aliases: fdMaturityValueAliases },
  { field: "issuer", required: false, aliases: bondIssuerAliases },
  { field: "bond_name", required: false, aliases: bondNameAliases },
  { field: "bond_type", required: false, aliases: bondTypeAliases },
  { field: "face_value", required: false, aliases: bondFaceValueAliases },
  { field: "coupon_rate", required: false, aliases: bondCouponRateAliases },
  { field: "coupon_frequency", required: false, aliases: bondCouponFrequencyAliases },
  { field: "purchase_price", required: false, aliases: bondPurchasePriceAliases },
  { field: "current_market_price", required: false, aliases: bondCurrentMarketPriceAliases },
  { field: "broker", required: false, aliases: bondBrokerAliases },
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

function stockDuplicateKey(params: {
  owner: string | null;
  dematAccountNumber: string | null;
  isin: string | null;
  companyName: string | null;
  symbol: string | null;
}) {
  const owner = (params.owner ?? "").trim().toLowerCase();
  if (!owner) {
    return null;
  }

  const isin = (params.isin ?? "").trim().toUpperCase();
  const demat = (params.dematAccountNumber ?? "").trim().toLowerCase();

  if (isin) {
    if (demat) {
      return `isin-demat::${owner}::${demat}::${isin}`;
    }

    return `isin-owner::${owner}::${isin}`;
  }

  const symbol = (params.symbol ?? "").trim().toLowerCase();
  if (symbol) {
    return `owner-symbol::${owner}::${symbol}`;
  }

  const companyName = (params.companyName ?? "").trim().toLowerCase();
  if (companyName) {
    return `owner-company::${owner}::${companyName}`;
  }

  return null;
}

function fixedDepositDuplicateKey(params: { owner: string | null; institution: string | null; fdNumber: string | null }) {
  const owner = (params.owner ?? "").trim().toLowerCase();
  const institution = (params.institution ?? "").trim().toLowerCase();
  const fdNumber = (params.fdNumber ?? "").trim().toLowerCase();

  if (!owner || !institution || !fdNumber) {
    return null;
  }

  return `${owner}::${institution}::${fdNumber}`;
}

function bondDuplicateKey(params: {
  owner: string | null;
  isin: string | null;
  issuer: string | null;
  bondName: string | null;
}) {
  const owner = (params.owner ?? "").trim().toLowerCase();
  if (!owner) {
    return null;
  }

  const isin = (params.isin ?? "").trim().toUpperCase();
  if (isin) {
    return `owner-isin::${owner}::${isin}`;
  }

  const issuer = (params.issuer ?? "").trim().toLowerCase();
  const bondName = (params.bondName ?? "").trim().toLowerCase();
  if (issuer && bondName) {
    return `owner-issuer-name::${owner}::${issuer}::${bondName}`;
  }

  return null;
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

function isFixedDepositSheet(sheetName: string) {
  return sheetName.trim().toLowerCase() === "fd holdings";
}

function isBondSheet(sheetName: string) {
  return sheetName.trim().toLowerCase() === "bond holdings";
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
  supportedSheets: ["Investments", "Stock Holdings", "FD Holdings", "Bond Holdings"],
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
    const existingStocksByBusinessKey = existing
      .filter((item) => item.investment_type === "Stocks")
      .reduce<Map<string, string>>((acc, item) => {
        const keys = [
          stockDuplicateKey({
            owner: item.owner,
            dematAccountNumber: item.demat_account_number,
            isin: item.isin,
            companyName: item.investment_name,
            symbol: item.investment_name,
          }),
          (item.owner && item.isin)
            ? `isin-owner::${item.owner.trim().toLowerCase()}::${item.isin.trim().toUpperCase()}`
            : null,
          (item.owner && item.investment_name)
            ? `owner-company::${item.owner.trim().toLowerCase()}::${item.investment_name.trim().toLowerCase()}`
            : null,
        ];

        for (const key of keys) {
          if (key && !acc.has(key)) {
            acc.set(key, item.id);
          }
        }

        return acc;
      }, new Map());
    const existingFixedDepositsByBusinessKey = existing
      .filter((item) => item.investment_type === "Fixed Deposits")
      .reduce<Map<string, string>>((acc, item) => {
        const key = fixedDepositDuplicateKey({ owner: item.owner, institution: item.institution, fdNumber: item.fd_number });
        if (key && !acc.has(key)) {
          acc.set(key, item.id);
        }

        return acc;
      }, new Map());
    const existingBondsByBusinessKey = existing
      .filter((item) => item.investment_type === "Bonds")
      .reduce<Map<string, string>>((acc, item) => {
        const keys = [
          bondDuplicateKey({
            owner: item.owner,
            isin: item.isin,
            issuer: item.issuer ?? item.institution,
            bondName: item.bond_name ?? item.investment_name,
          }),
          (item.owner && item.isin)
            ? `owner-isin::${item.owner.trim().toLowerCase()}::${item.isin.trim().toUpperCase()}`
            : null,
          (item.owner && (item.issuer ?? item.institution) && (item.bond_name ?? item.investment_name))
            ? `owner-issuer-name::${item.owner.trim().toLowerCase()}::${(item.issuer ?? item.institution ?? "").trim().toLowerCase()}::${(item.bond_name ?? item.investment_name ?? "").trim().toLowerCase()}`
            : null,
        ];

        for (const key of keys) {
          if (key && !acc.has(key)) {
            acc.set(key, item.id);
          }
        }

        return acc;
      }, new Map());
    const stockSheet = isStockSheet(sheetName);
    const fdSheet = isFixedDepositSheet(sheetName);
    const bondSheet = isBondSheet(sheetName);
    const inBatchMutualFundKeys = new Set<string>();
    const inBatchStockKeys = new Set<string>();
    const inBatchFixedDepositKeys = new Set<string>();
    const inBatchBondKeys = new Set<string>();

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const investmentName = parseString(pickValue(row, investmentNameAliases));
      const parsedCategory = parseCategory(parseString(pickValue(row, categoryAliases)));
      const category = stockSheet
        ? parsedCategory ?? "Stocks"
        : fdSheet
          ? parsedCategory ?? "Fixed Deposits"
          : bondSheet
            ? parsedCategory ?? "Bonds"
          : parsedCategory ?? "Mutual Funds";

      const units = parseNumber(pickValue(row, unitsAliases));
      const bondQuantity = parseNumber(pickValue(row, bondQuantityAliases));
      const stockCurrentPriceRaw = pickValue(row, stockCurrentPriceAliases);
      const bondCurrentPriceRaw = pickValue(row, bondCurrentMarketPriceAliases);
      const navPrice = stockSheet
        ? (stockCurrentPriceRaw === undefined ? null : parseNumber(stockCurrentPriceRaw))
        : bondSheet
          ? (bondCurrentPriceRaw === undefined ? null : parseNumber(bondCurrentPriceRaw))
        : parseNumber(pickValue(row, navPriceAliases));
      const explicitCurrentMarketValueRaw = pickValue(row, currentMarketValueAliases);
      const explicitCurrentMarketValue =
        explicitCurrentMarketValueRaw === undefined ? null : parseNumber(explicitCurrentMarketValueRaw);
      const fdBank = parseString(pickValue(row, fdBankAliases));
      const fdNumber = parseString(pickValue(row, fdNumberAliases));
      const fdPrincipal = parseNumber(pickValue(row, fdPrincipalAliases));
      const fdInterestRate = parseNumber(pickValue(row, fdInterestRateAliases));
      const fdCompoundingFrequency = parseString(pickValue(row, fdCompoundingFrequencyAliases));
      const fdPayoutType = parseString(pickValue(row, fdPayoutTypeAliases));
      const fdStartDateRaw = pickValue(row, fdStartDateAliases);
      const fdStartDate = fdStartDateRaw === undefined ? null : parseDate(fdStartDateRaw);
      const fdMaturityDateRaw = pickValue(row, fdMaturityDateAliases);
      const fdMaturityDate = fdMaturityDateRaw === undefined ? null : parseDate(fdMaturityDateRaw);
      const fdMaturityValueFromRow = parseNumber(pickValue(row, fdMaturityValueAliases));
      const bondIssuer = parseString(pickValue(row, bondIssuerAliases));
      const bondName = parseString(pickValue(row, bondNameAliases)) ?? investmentName;
      const bondType = parseString(pickValue(row, bondTypeAliases));
      const bondFaceValue = parseNumber(pickValue(row, bondFaceValueAliases));
      const bondCouponRate = parseNumber(pickValue(row, bondCouponRateAliases));
      const bondCouponFrequency = parseString(pickValue(row, bondCouponFrequencyAliases));
      const bondPurchasePrice = parseNumber(pickValue(row, bondPurchasePriceAliases));
      const bondBroker = parseString(pickValue(row, bondBrokerAliases));
      const bondIsin = parseString(pickValue(row, stockIsinAliases));

      const costBasisRaw = pickValue(row, costBasisAliases);
      const costBasisFromWorkbook = costBasisRaw === undefined ? null : parseNumber(costBasisRaw);
      const averagePurchasePrice = parseNumber(pickValue(row, stockAveragePurchasePriceAliases));
      const derivedCostBasisFromAverage =
        units !== null && averagePurchasePrice !== null ? Number((units * averagePurchasePrice).toFixed(2)) : null;
      const derivedBondCostBasis =
        bondQuantity !== null && bondPurchasePrice !== null ? Number((bondQuantity * bondPurchasePrice).toFixed(2)) : null;
      const costBasis = fdSheet
        ? fdPrincipal
        : bondSheet
          ? (costBasisFromWorkbook ?? derivedBondCostBasis)
        : stockSheet
          ? (costBasisFromWorkbook ?? derivedCostBasisFromAverage)
          : costBasisFromWorkbook;

      const fdComputedValues =
        fdSheet
        && fdPrincipal !== null
        && fdInterestRate !== null
        && fdStartDate
        && fdMaturityDate
        && fdCompoundingFrequency
        && fdPayoutType
        && fdCompoundingFrequencies.includes(fdCompoundingFrequency as (typeof fdCompoundingFrequencies)[number])
        && fdPayoutTypes.includes(fdPayoutType as (typeof fdPayoutTypes)[number])
          ? computeFixedDepositValues({
              principal: fdPrincipal,
              annualInterestRatePercent: fdInterestRate,
              compoundingFrequency: fdCompoundingFrequency as "monthly" | "quarterly" | "half-yearly" | "yearly",
              payoutType: (fdPayoutType as "cumulative" | "monthly-payout" | "quarterly-payout" | "annual-payout") ?? "cumulative",
              startDate: fdStartDate,
              maturityDate: fdMaturityDate,
            })
          : null;

      const computedCurrentValue =
        fdSheet
          ? fdComputedValues?.currentValue ?? null
          : bondSheet
            ? (bondQuantity !== null && navPrice !== null ? Number((bondQuantity * navPrice).toFixed(2)) : null)
          : units !== null && navPrice !== null
            ? Number((units * navPrice).toFixed(2))
            : null;
      const resolvedCurrentValue = fdSheet
        ? (fdComputedValues?.currentValue ?? explicitCurrentMarketValue)
        : (computedCurrentValue ?? explicitCurrentMarketValue);

      const region = parseRegion(parseString(pickValue(row, regionAliases)));
      const purchaseDateRaw = pickValue(row, purchaseDateAliases);
      const purchaseDate = purchaseDateRaw === undefined ? null : parseDate(purchaseDateRaw);
      const owner = parseString(pickValue(row, ownerAliases));
      const stockBroker = parseString(pickValue(row, stockBrokerAliases));
      const stockExchange = parseString(pickValue(row, stockExchangeAliases));
      const stockIsin = parseString(pickValue(row, stockIsinAliases));
      const stockSymbol = parseString(pickValue(row, stockSymbolAliases));
      const stockDematProvider = parseString(pickValue(row, stockDematProviderAliases));
      const stockDematAccountNumber = parseString(pickValue(row, stockDematAccountAliases));
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

      if (!fdSheet && !bondSheet && !investmentName) {
        issues.push(issue({ sheetName, rowNumber, field: "investment_name", message: "Investment name is required." }));
      }

      if (!category) {
        issues.push(issue({ sheetName, rowNumber, field: "category", message: "Invalid category." }));
      }

      if (stockSheet && category && category !== "Stocks") {
        issues.push(issue({ sheetName, rowNumber, field: "category", message: "Category must be Stocks for this sheet." }));
      }

      if (fdSheet && category && category !== "Fixed Deposits") {
        issues.push(issue({ sheetName, rowNumber, field: "category", message: "Category must be Fixed Deposits for this sheet." }));
      }

      if (bondSheet && category && category !== "Bonds") {
        issues.push(issue({ sheetName, rowNumber, field: "category", message: "Category must be Bonds for this sheet." }));
      }

      if (!fdSheet && !bondSheet && units === null) {
        issues.push(issue({ sheetName, rowNumber, field: "units", message: "Units must be a valid number." }));
      }

      if (bondSheet && bondQuantity === null) {
        issues.push(issue({ sheetName, rowNumber, field: "quantity", message: "Quantity must be a valid number for bond imports." }));
      }

      if (!stockSheet && !fdSheet && !bondSheet && navPrice === null) {
        issues.push(
          issue({
            sheetName,
            rowNumber,
            field: "nav_price",
            message: "NAV price must be a valid number.",
          }),
        );
      }

      if (stockSheet && stockCurrentPriceRaw !== undefined && navPrice === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_price", message: "Current price must be a valid number when provided." }));
      }

      if (bondSheet && bondCurrentPriceRaw !== undefined && navPrice === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_market_price", message: "Current market price must be a valid number when provided." }));
      }

      if (fdSheet && !fdBank) {
        issues.push(issue({ sheetName, rowNumber, field: "institution", message: "Bank is required for fixed deposit imports." }));
      }

      if (fdSheet && !fdNumber) {
        issues.push(issue({ sheetName, rowNumber, field: "fd_number", message: "FD number is required for fixed deposit imports." }));
      }

      if (fdSheet && !owner) {
        issues.push(issue({ sheetName, rowNumber, field: "owner", message: "Owner is required for fixed deposit imports." }));
      }

      if (fdSheet && fdPrincipal === null) {
        issues.push(issue({ sheetName, rowNumber, field: "principal", message: "Principal must be a valid number." }));
      }

      if (fdSheet && fdInterestRate === null) {
        issues.push(issue({ sheetName, rowNumber, field: "interest_rate", message: "Interest rate must be a valid number." }));
      }

      if (fdSheet && !fdCompoundingFrequency) {
        issues.push(issue({ sheetName, rowNumber, field: "compounding_frequency", message: "Compounding frequency is required." }));
      } else if (fdSheet && fdCompoundingFrequency && !fdCompoundingFrequencies.includes(fdCompoundingFrequency as (typeof fdCompoundingFrequencies)[number])) {
        issues.push(issue({ sheetName, rowNumber, field: "compounding_frequency", message: "Compounding frequency must be monthly, quarterly, half-yearly, or yearly." }));
      }

      if (fdSheet && !fdPayoutType) {
        issues.push(issue({ sheetName, rowNumber, field: "payout_type", message: "Payout type is required." }));
      } else if (fdSheet && fdPayoutType && !fdPayoutTypes.includes(fdPayoutType as (typeof fdPayoutTypes)[number])) {
        issues.push(issue({ sheetName, rowNumber, field: "payout_type", message: "Payout type must be cumulative, monthly-payout, quarterly-payout, or annual-payout." }));
      }

      if (fdSheet && fdStartDateRaw !== undefined && !fdStartDate) {
        issues.push(issue({ sheetName, rowNumber, field: "start_date", message: "Start date is invalid." }));
      }

      if (fdSheet && !fdStartDate) {
        issues.push(issue({ sheetName, rowNumber, field: "start_date", message: "Start date is required for fixed deposit imports." }));
      }

      if (fdSheet && fdMaturityDateRaw !== undefined && !fdMaturityDate) {
        issues.push(issue({ sheetName, rowNumber, field: "maturity_date", message: "Maturity date is invalid." }));
      }

      if (fdSheet && !fdMaturityDate) {
        issues.push(issue({ sheetName, rowNumber, field: "maturity_date", message: "Maturity date is required for fixed deposit imports." }));
      }

      if (fdSheet && fdStartDate && fdMaturityDate && new Date(fdMaturityDate).getTime() < new Date(fdStartDate).getTime()) {
        issues.push(issue({ sheetName, rowNumber, field: "maturity_date", message: "Maturity date must be on or after start date." }));
      }

      if (bondSheet && !bondIssuer) {
        issues.push(issue({ sheetName, rowNumber, field: "issuer", message: "Issuer is required for bond imports." }));
      }

      if (bondSheet && !bondName) {
        issues.push(issue({ sheetName, rowNumber, field: "bond_name", message: "Bond name is required for bond imports." }));
      }

      if (bondSheet && !owner) {
        issues.push(issue({ sheetName, rowNumber, field: "owner", message: "Owner is required for bond imports." }));
      }

      if (bondSheet && bondPurchasePrice === null) {
        issues.push(issue({ sheetName, rowNumber, field: "purchase_price", message: "Purchase price must be a valid number for bond imports." }));
      }

      if (bondSheet && purchaseDateRaw !== undefined && !purchaseDate) {
        issues.push(issue({ sheetName, rowNumber, field: "purchase_date", message: "Purchase date is invalid." }));
      }

      if (bondSheet && !purchaseDate) {
        issues.push(issue({ sheetName, rowNumber, field: "purchase_date", message: "Purchase date is required for bond imports." }));
      }

      if (bondSheet && fdMaturityDateRaw !== undefined && !fdMaturityDate) {
        issues.push(issue({ sheetName, rowNumber, field: "maturity_date", message: "Maturity date is invalid." }));
      }

      if (bondSheet && !fdMaturityDate) {
        issues.push(issue({ sheetName, rowNumber, field: "maturity_date", message: "Maturity date is required for bond imports." }));
      }

      if (bondSheet && purchaseDate && fdMaturityDate && new Date(fdMaturityDate).getTime() < new Date(purchaseDate).getTime()) {
        issues.push(issue({ sheetName, rowNumber, field: "maturity_date", message: "Maturity date must be on or after purchase date." }));
      }

      if (bondSheet && !bondIsin) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "isin",
            message: "ISIN is missing. Duplicate detection will fall back to Owner + Issuer + Bond Name.",
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

      if (stockSheet && averagePurchasePrice === null) {
        issues.push(issue({ sheetName, rowNumber, field: "average_purchase_price", message: "Average buy price is required for stock imports." }));
      }

      if (stockSheet && !stockDematAccountNumber) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "demat_account_number",
            message: "Demat Account Number is missing. Duplicate detection will use Owner + ISIN or Owner + Company/Symbol.",
          }),
        );
      }

      if (stockSheet && !stockIsin) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "isin",
            message: "ISIN is missing. Duplicate detection will fall back to Owner + Company Name or Owner + Symbol.",
          }),
        );
      }

      if (stockSheet && stockCurrentPriceRaw === undefined) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "current_price",
            message: "Current Price is missing. Current value will default to purchase value for this row.",
          }),
        );
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

      if (bondSheet && bondQuantity !== null && bondQuantity < 0) {
        issues.push(issue({ sheetName, rowNumber, field: "quantity", message: "Quantity must be zero or greater." }));
      }

      if (fdSheet && fdPrincipal !== null && fdPrincipal < 0) {
        issues.push(issue({ sheetName, rowNumber, field: "principal", message: "Principal must be zero or greater." }));
      }

      if (fdSheet && fdInterestRate !== null && fdInterestRate < 0) {
        issues.push(issue({ sheetName, rowNumber, field: "interest_rate", message: "Interest rate must be zero or greater." }));
      }

      if (navPrice !== null && navPrice < 0) {
        issues.push(
          issue({
            sheetName,
            rowNumber,
            field: stockSheet ? "current_price" : bondSheet ? "current_market_price" : "nav_price",
            message: stockSheet ? "Current price must be zero or greater." : bondSheet ? "Current market price must be zero or greater." : "NAV price must be zero or greater.",
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
      if (
        hasErrors
        || !category
        || (!fdSheet && !bondSheet && !investmentName)
        || (!fdSheet && !bondSheet && units === null)
        || (bondSheet && bondQuantity === null)
        || costBasis === null
        || !region
        || (!stockSheet && !fdSheet && !bondSheet && navPrice === null)
      ) {
        return;
      }

      const effectiveCurrentValue = resolvedCurrentValue ?? costBasis;

      if (effectiveCurrentValue === null) {
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

      const todayGainLoss = Number((effectiveCurrentValue - costBasis).toFixed(2));
      const resolvedFdName = investmentName ?? (fdBank && fdNumber ? `${fdBank} FD ${fdNumber}` : "Fixed Deposit");
      const resolvedBondName = bondName ?? (bondIssuer ? `${bondIssuer} Bond` : "Bond");
      const resolvedInvestmentName = fdSheet ? resolvedFdName : bondSheet ? resolvedBondName : (investmentName ?? "Investment");
      const bondUnits = bondQuantity ?? units ?? 0;
      const resolvedBondNav = navPrice ?? (bondUnits > 0 ? Number((effectiveCurrentValue / bondUnits).toFixed(4)) : 0);

      const values: InvestmentInsert = {
        investment_name: resolvedInvestmentName,
        category,
        units: fdSheet ? 1 : bondSheet ? bondUnits : (units ?? 0),
        nav_price: fdSheet ? effectiveCurrentValue : bondSheet ? resolvedBondNav : navPrice ?? 0,
        current_value: effectiveCurrentValue,
        cost_basis: costBasis,
        today_gain_loss: todayGainLoss,
        sector: parseString(pickValue(row, sectorAliases)),
        amc: stockSheet || bondSheet ? null : parseString(pickValue(row, amcAliases)),
        region,
        purchase_date: purchaseDate,
        owner,
        folio_number: stockSheet || bondSheet ? null : folioNumber,
        amfi_scheme_code: stockSheet || bondSheet ? null : amfiSchemeCode,
        sip_amount: stockSheet || bondSheet ? null : sipAmount,
        sip_date: stockSheet || bondSheet ? null : sipDate,
        investment_mode: stockSheet || bondSheet ? null : investmentMode,
        option_type: stockSheet || bondSheet ? null : optionType,
        broker_platform: stockSheet || bondSheet ? null : parseString(pickValue(row, brokerPlatformAliases)),
        nominee: stockSheet || bondSheet ? null : parseString(pickValue(row, nomineeAliases)),
        notes: parseString(pickValue(row, notesAliases)),
        documents_placeholder: parseString(pickValue(row, documentsAliases)),
        broker: stockSheet ? stockBroker : bondSheet ? bondBroker : null,
        exchange: stockSheet ? stockExchange : null,
        isin: stockSheet ? stockIsin?.toUpperCase() ?? null : bondSheet ? bondIsin?.toUpperCase() ?? null : null,
        demat_account_provider: stockSheet ? stockDematProvider : null,
        demat_account_number: stockSheet ? stockDematAccountNumber : null,
        average_purchase_price: stockSheet ? averagePurchasePrice : bondSheet ? bondPurchasePrice : null,
        institution: fdSheet ? fdBank : bondSheet ? bondIssuer : null,
        fd_number: fdSheet ? fdNumber : null,
        interest_rate: fdSheet ? fdInterestRate : null,
        compounding_frequency: fdSheet ? fdCompoundingFrequency : null,
        payout_type: fdSheet ? fdPayoutType : null,
        maturity_date: fdSheet || bondSheet ? fdMaturityDate : null,
        maturity_value: fdSheet ? (fdMaturityValueFromRow ?? fdComputedValues?.maturityValue ?? null) : null,
        issuer: bondSheet ? bondIssuer : null,
        bond_name: bondSheet ? resolvedBondName : null,
        bond_type: bondSheet ? bondType : null,
        face_value: bondSheet ? bondFaceValue : null,
        coupon_rate: bondSheet ? bondCouponRate : null,
        coupon_frequency: bondSheet ? bondCouponFrequency : null,
        purchase_price: bondSheet ? bondPurchasePrice : null,
        current_market_price: bondSheet ? (navPrice ?? null) : null,
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

      if (category === "Stocks") {
        const inBatchKey = stockDuplicateKey({
          owner,
          dematAccountNumber: stockDematAccountNumber,
          isin: stockIsin,
          companyName: investmentName,
          symbol: stockSymbol,
        });

        if (inBatchKey && inBatchStockKeys.has(inBatchKey)) {
          issues.push(
            issue({
              severity: "warning",
              sheetName,
              rowNumber,
              field: "isin",
              message: "Duplicate Stock row in this file based on duplicate key resolution. Row will be skipped.",
            }),
          );
          return;
        }

        if (inBatchKey) {
          inBatchStockKeys.add(inBatchKey);
        }
      }

      if (category === "Fixed Deposits") {
        const inBatchKey = fixedDepositDuplicateKey({ owner, institution: fdBank, fdNumber });

        if (inBatchKey && inBatchFixedDepositKeys.has(inBatchKey)) {
          issues.push(
            issue({
              severity: "warning",
              sheetName,
              rowNumber,
              field: "fd_number",
              message: "Duplicate Fixed Deposit row in this file (Owner + Bank + FD Number). Row will be skipped.",
            }),
          );
          return;
        }

        if (inBatchKey) {
          inBatchFixedDepositKeys.add(inBatchKey);
        }
      }

      if (category === "Bonds") {
        const inBatchKey = bondDuplicateKey({ owner, isin: bondIsin, issuer: bondIssuer, bondName: resolvedBondName });

        if (inBatchKey && inBatchBondKeys.has(inBatchKey)) {
          issues.push(
            issue({
              severity: "warning",
              sheetName,
              rowNumber,
              field: "isin",
              message: "Duplicate Bond row in this file based on duplicate key resolution. Row will be skipped.",
            }),
          );
          return;
        }

        if (inBatchKey) {
          inBatchBondKeys.add(inBatchKey);
        }
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
      const duplicateStockId =
        category === "Stocks"
          ? existingStocksByBusinessKey.get(
              stockDuplicateKey({
                owner,
                dematAccountNumber: stockDematAccountNumber,
                isin: stockIsin,
                companyName: investmentName,
                symbol: stockSymbol,
              }) ?? "",
            )
          : undefined;
      const duplicateFixedDepositId =
        category === "Fixed Deposits"
          ? existingFixedDepositsByBusinessKey.get(
              fixedDepositDuplicateKey({ owner, institution: fdBank, fdNumber }) ?? "",
            )
          : undefined;
      const duplicateBondId =
        category === "Bonds"
          ? existingBondsByBusinessKey.get(
              bondDuplicateKey({ owner, isin: bondIsin, issuer: bondIssuer, bondName: resolvedBondName }) ?? "",
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

      if (!id && duplicateStockId) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "isin",
            message: "Matching Stock already exists based on duplicate key resolution. Row will update existing holding.",
          }),
        );
      }

      if (!id && duplicateFixedDepositId) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "fd_number",
            message: "Matching Fixed Deposit (Owner + Bank + FD Number) already exists. Row will update existing holding.",
          }),
        );
      }

      if (!id && duplicateBondId) {
        issues.push(
          issue({
            severity: "warning",
            sheetName,
            rowNumber,
            field: "isin",
            message: "Matching Bond already exists based on duplicate key resolution. Row will update existing holding.",
          }),
        );
      }

      const monthEndDateRaw = parseString(pickValue(row, monthEndDateAliases));
      const monthEndDate = monthEndDateRaw ? parseDate(monthEndDateRaw) : null;
      const monthEndValueRaw = parseNumber(pickValue(row, monthEndValueAliases));
      const monthEndValue = monthEndValueRaw ?? effectiveCurrentValue;

      if (monthEndDateRaw && !monthEndDate) {
        issues.push(issue({ sheetName, rowNumber, field: "month_end_date", message: "Month-end date is invalid." }));
      }

      records.push({
        rowNumber,
        action: (id && existingIds.has(id)) || Boolean(!id && duplicateMutualFundId) || Boolean(!id && duplicateStockId) || Boolean(!id && duplicateFixedDepositId) || Boolean(!id && duplicateBondId) ? "update" : "create",
        payload: {
          id: id && existingIds.has(id) ? id : duplicateMutualFundId ?? duplicateStockId ?? duplicateFixedDepositId ?? duplicateBondId,
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
