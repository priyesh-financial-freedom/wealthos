import { DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import { getBalanceSheetData, type BalanceSheetData } from "@/services/balanceSheet";
import {
  assertValidFinancialNumber,
  assertValidNullableFinancialNumber,
  MAX_PERCENTAGE_ABS_VALUE_24_4,
} from "@/lib/financialNumberValidation";
import { projectionEngine } from "@/services/projection/ProjectionEngine";
import { projectionInputService } from "@/services/projection/ProjectionInputService";
import type { Asset } from "@/types/asset";
import type { BankAccount } from "@/types/bankAccount";
import type { FixedDeposit } from "@/types/fixedDeposit";
import type { GoldHolding } from "@/types/goldHolding";
import type { Investment, InvestmentCategory } from "@/types/investment";
import type { Liability } from "@/types/liability";
import {
  MONTH_END_CLOSE_ITEM_DEFINITIONS,
  type MonthEndClose,
  type MonthEndCloseDashboard,
  type MonthEndCloseEditorItem,
  type MonthEndCloseEntityType,
  type MonthEndCloseItem,
  type MonthEndCloseItemKey,
  type MonthEndCloseItemType,
  type MonthEndCloseKpiSummary,
  type MonthEndClosePersistInput,
  type MonthEndCloseWorkspace,
  type MonthReference,
} from "@/types/monthEndClose";
import type { ProjectionScenario } from "@/types/projection";
import type { RealEstateProperty } from "@/types/realEstateProperty";
import type { RetirementAccount } from "@/types/retirementAccount";
import type { SilverHolding } from "@/types/silverHolding";

import { MonthEndCloseRepository } from "./MonthEndCloseRepository";

type ValueMap = Record<MonthEndCloseItemKey, number>;

interface EntitySeed {
  rowKey: string;
  entityId: string;
  entityType: MonthEndCloseEntityType | string;
  entityTypeLabel: string;
  entityName: string;
  key: MonthEndCloseItemKey;
  itemType: MonthEndCloseItemType;
  actualValue: number;
}

interface PersistedItemSnapshot {
  rowKey: string;
  entityId: string;
  entityType: MonthEndCloseEntityType | string;
  entityTypeLabel: string;
  entityName: string;
  key: MonthEndCloseItemKey;
  itemType: MonthEndCloseItemType;
  openingValue: number;
  projectedValue: number;
  actualValue: number;
  sortOrder: number;
}

interface MonthEndCloseServiceDependencies {
  repository: MonthEndCloseRepository;
  balanceSheetLoader?: () => Promise<BalanceSheetData>;
}

const ITEM_DEFINITION_MAP = new Map(MONTH_END_CLOSE_ITEM_DEFINITIONS.map((item) => [item.key, item]));
const MUTUAL_FUND_CATEGORIES = new Set<InvestmentCategory>(["Mutual Funds"]);
const STOCK_CATEGORIES = new Set<InvestmentCategory>(["Stocks", "ETFs", "Crypto", "Cash Equivalents"]);
const GOLD_CATEGORIES = new Set<InvestmentCategory>(["Gold", "Sovereign Gold Bonds"]);
const SILVER_CATEGORIES = new Set<InvestmentCategory>(["Silver"]);
const FIXED_DEPOSIT_CATEGORIES = new Set<InvestmentCategory>(["Fixed Deposits", "Bonds"]);
const EPF_CATEGORIES = new Set<InvestmentCategory>(["EPF"]);
const PPF_CATEGORIES = new Set<InvestmentCategory>(["PPF"]);
const NPS_CATEGORIES = new Set<InvestmentCategory>(["NPS"]);
const OTHER_INVESTMENT_CATEGORIES = new Set<InvestmentCategory>(["ESOPs", "Startup Investments", "Other Investments"]);

function emptyValueMap(): ValueMap {
  return MONTH_END_CLOSE_ITEM_DEFINITIONS.reduce((acc, item) => {
    acc[item.key] = 0;
    return acc;
  }, {} as ValueMap);
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function createMonthReference(year: number, month: number): MonthReference {
  return {
    month,
    year,
    monthKey: monthKey(year, month),
    label: monthLabel(year, month),
  };
}

function nextMonth(month: number, year: number): MonthReference {
  if (month === 12) {
    return createMonthReference(year + 1, 1);
  }

  return createMonthReference(year, month + 1);
}

function definitionForKey(key: MonthEndCloseItemKey) {
  const definition = ITEM_DEFINITION_MAP.get(key);
  if (!definition) {
    throw new Error(`Missing month-end close item definition for ${key}`);
  }

  return definition;
}

function entityRowKey(entityType: string, entityId: string) {
  return `${entityType}:${entityId}`;
}

function itemTypeLabel(entityType: string, fallbackKey: MonthEndCloseItemKey) {
  switch (entityType) {
    case "bank-account":
      return "Bank Account";
    case "investment":
      return definitionForKey(fallbackKey).label.slice(0, -1);
    case "gold-holding":
      return "Gold Holding";
    case "silver-holding":
      return "Silver Holding";
    case "fixed-deposit":
      return "Fixed Deposit";
    case "retirement-account":
      return definitionForKey(fallbackKey).label;
    case "real-estate-property":
      return "Real Estate Property";
    case "liability":
      return definitionForKey(fallbackKey).label.slice(0, -1);
    case "asset":
      return "Asset";
    case "legacy-bucket":
      return "Legacy Snapshot";
    default:
      return definitionForKey(fallbackKey).label;
  }
}

function liabilityBucket(type: Liability["liability_type"]): MonthEndCloseItemKey {
  switch (type) {
    case "Home Loan":
    case "Loan Against Property":
      return "home_loans";
    case "Car Loan":
      return "car_loans";
    case "Personal Loan":
    case "Education Loan":
    case "Credit Card":
    case "Bank Overdraft":
    case "Overdraft / Line of Credit":
    case "Other Liability":
    default:
      return "other_liabilities";
  }
}

function investmentBucket(category: InvestmentCategory): MonthEndCloseItemKey | null {
  if (MUTUAL_FUND_CATEGORIES.has(category)) {
    return "mutual_funds";
  }
  if (STOCK_CATEGORIES.has(category)) {
    return "stocks";
  }
  if (GOLD_CATEGORIES.has(category)) {
    return "gold";
  }
  if (SILVER_CATEGORIES.has(category)) {
    return "silver";
  }
  if (FIXED_DEPOSIT_CATEGORIES.has(category)) {
    return "fixed_deposits";
  }
  if (EPF_CATEGORIES.has(category)) {
    return "epf";
  }
  if (PPF_CATEGORIES.has(category)) {
    return "ppf";
  }
  if (NPS_CATEGORIES.has(category)) {
    return "nps";
  }
  if (OTHER_INVESTMENT_CATEGORIES.has(category)) {
    return "other_assets";
  }

  return null;
}

function createSeed(params: {
  entityId: string;
  entityType: MonthEndCloseEntityType | string;
  entityName: string;
  key: MonthEndCloseItemKey;
  actualValue: number;
  entityTypeLabel?: string;
}): EntitySeed {
  const definition = definitionForKey(params.key);

  return {
    rowKey: entityRowKey(params.entityType, params.entityId),
    entityId: params.entityId,
    entityType: params.entityType,
    entityTypeLabel: params.entityTypeLabel ?? itemTypeLabel(params.entityType, params.key),
    entityName: params.entityName,
    key: params.key,
    itemType: definition.itemType,
    actualValue: Number(params.actualValue ?? 0),
  };
}

function buildAssetSeeds(assets: Asset[], hasDedicatedRealEstateModule: boolean): EntitySeed[] {
  return assets.flatMap((asset) => {
    if (asset.asset_type === "real_estate") {
      if (hasDedicatedRealEstateModule) {
        return [];
      }

      return [
        createSeed({
          entityId: asset.id,
          entityType: "asset",
          entityName: asset.asset_name,
          key: "real_estate",
          actualValue: Number(asset.current_value ?? 0),
          entityTypeLabel: "Legacy Real Estate Asset",
        }),
      ];
    }

    if (asset.asset_type === "vehicle" || asset.asset_type === "business" || asset.asset_type === "other") {
      return [
        createSeed({
          entityId: asset.id,
          entityType: "asset",
          entityName: asset.asset_name,
          key: "other_assets",
          actualValue: Number(asset.current_value ?? 0),
        }),
      ];
    }

    return [];
  });
}

function buildBankAccountSeeds(bankAccounts: BankAccount[]): EntitySeed[] {
  return bankAccounts.map((account) =>
    createSeed({
      entityId: account.id,
      entityType: "bank-account",
      entityName: `${account.account_name} • ${account.bank}`,
      key: "bank_accounts",
      actualValue: Number(account.current_balance ?? 0),
      entityTypeLabel: account.account_type,
    }),
  );
}

function buildInvestmentSeeds(
  investments: Investment[],
  options: {
    hasDedicatedRetirementAccounts: boolean;
    hasDedicatedGoldHoldings: boolean;
    hasDedicatedSilverHoldings: boolean;
  },
): EntitySeed[] {
  return investments.flatMap((investment) => {
    if (investment.status !== "active") {
      return [];
    }

    if (options.hasDedicatedRetirementAccounts && (EPF_CATEGORIES.has(investment.category) || PPF_CATEGORIES.has(investment.category) || NPS_CATEGORIES.has(investment.category))) {
      return [];
    }

    if (options.hasDedicatedGoldHoldings && GOLD_CATEGORIES.has(investment.category)) {
      return [];
    }

    if (options.hasDedicatedSilverHoldings && investment.category === "Silver") {
      return [];
    }

    const key = investmentBucket(investment.category) ?? "other_assets";

    return [
      createSeed({
        entityId: investment.id,
        entityType: "investment",
        entityName: investment.investment_name,
        key,
        actualValue: Number(investment.current_value ?? 0),
        entityTypeLabel: investment.category,
      }),
    ];
  });
}

function buildGoldSeeds(goldHoldings: GoldHolding[]): EntitySeed[] {
  return goldHoldings.map((holding) =>
    createSeed({
      entityId: holding.id,
      entityType: "gold-holding",
      entityName: holding.description,
      key: "gold",
      actualValue: Number(holding.current_value ?? 0),
      entityTypeLabel: holding.holding_type,
    }),
  );
}

function buildSilverSeeds(silverHoldings: SilverHolding[]): EntitySeed[] {
  return silverHoldings.map((holding) =>
    createSeed({
      entityId: holding.id,
      entityType: "silver-holding",
      entityName: holding.description,
      key: "silver",
      actualValue: Number(holding.current_value ?? 0),
      entityTypeLabel: holding.holding_type,
    }),
  );
}

function buildFixedDepositSeeds(fixedDeposits: FixedDeposit[]): EntitySeed[] {
  return fixedDeposits.map((deposit) =>
    createSeed({
      entityId: deposit.id,
      entityType: "fixed-deposit",
      entityName: `${deposit.institution} • ${deposit.account_number}`,
      key: "fixed_deposits",
      actualValue: Number(deposit.current_value ?? 0),
      entityTypeLabel: deposit.deposit_type,
    }),
  );
}

function buildRetirementSeeds(retirementAccounts: RetirementAccount[]): EntitySeed[] {
  return retirementAccounts.map((account) =>
    createSeed({
      entityId: account.id,
      entityType: "retirement-account",
      entityName: `${account.owner} • ${account.institution}`,
      key: account.account_type === "EPF" ? "epf" : account.account_type === "PPF" ? "ppf" : "nps",
      actualValue: Number(account.current_balance ?? 0),
      entityTypeLabel: account.account_type,
    }),
  );
}

function buildRealEstateSeeds(realEstateProperties: RealEstateProperty[]): EntitySeed[] {
  return realEstateProperties.map((property) =>
    createSeed({
      entityId: property.id,
      entityType: "real-estate-property",
      entityName: property.property_name,
      key: "real_estate",
      actualValue: Number(property.current_market_value ?? 0),
      entityTypeLabel: property.property_type,
    }),
  );
}

function buildLiabilitySeeds(liabilities: Liability[]): EntitySeed[] {
  return liabilities.map((liability) =>
    createSeed({
      entityId: liability.id,
      entityType: "liability",
      entityName: liability.account_name,
      key: liabilityBucket(liability.liability_type),
      actualValue: Number(liability.outstanding_amount ?? 0),
      entityTypeLabel: liability.liability_type,
    }),
  );
}

function buildCurrentEntitySeeds(balanceSheetData: Awaited<ReturnType<typeof getBalanceSheetData>>): EntitySeed[] {
  const hasDedicatedRealEstateModule = balanceSheetData.realEstateProperties.length > 0;
  const hasDedicatedRetirementAccounts = balanceSheetData.retirementAccounts.length > 0;
  const hasDedicatedGoldHoldings = balanceSheetData.goldHoldings.length > 0;
  const hasDedicatedSilverHoldings = balanceSheetData.silverHoldings.length > 0;

  return [
    ...buildAssetSeeds(balanceSheetData.assets, hasDedicatedRealEstateModule),
    ...buildBankAccountSeeds(balanceSheetData.bankAccounts),
    ...buildInvestmentSeeds(balanceSheetData.investments, {
      hasDedicatedRetirementAccounts,
      hasDedicatedGoldHoldings,
      hasDedicatedSilverHoldings,
    }),
    ...buildGoldSeeds(balanceSheetData.goldHoldings),
    ...buildSilverSeeds(balanceSheetData.silverHoldings),
    ...buildFixedDepositSeeds(balanceSheetData.fixedDeposits),
    ...buildRetirementSeeds(balanceSheetData.retirementAccounts),
    ...buildRealEstateSeeds(balanceSheetData.realEstateProperties),
    ...buildLiabilitySeeds(balanceSheetData.liabilities),
  ];
}

function calculateAbsoluteVariance(actualValue: number, projectedValue: number) {
  return actualValue - projectedValue;
}

function calculatePercentageVariance(actualValue: number, projectedValue: number) {
  if (projectedValue === 0) {
    return actualValue === 0 ? 0 : null;
  }

  return ((actualValue - projectedValue) / Math.abs(projectedValue)) * 100;
}

function aggregateByItemKey<T extends { key: MonthEndCloseItemKey }>(items: T[], getValue: (item: T) => number): ValueMap {
  return items.reduce((acc, item) => {
    acc[item.key] += Number(getValue(item) ?? 0);
    return acc;
  }, emptyValueMap());
}

function buildKpiSummary(values: ValueMap): MonthEndCloseKpiSummary {
  const totalAssets =
    values.bank_accounts +
    values.mutual_funds +
    values.stocks +
    values.gold +
    values.silver +
    values.fixed_deposits +
    values.epf +
    values.ppf +
    values.nps +
    values.real_estate +
    values.other_assets;
  const totalLiabilities = values.home_loans + values.car_loans + values.other_liabilities;

  return {
    cash: values.bank_accounts,
    mutualFunds: values.mutual_funds,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    totalsByKey: values,
  };
}

function summarizeEditorItems(items: MonthEndCloseEditorItem[], field: "openingValue" | "projectedValue" | "actualValue"): MonthEndCloseKpiSummary {
  return buildKpiSummary(aggregateByItemKey(items, (item) => item[field]));
}

function summarizePersistedItems(items: MonthEndCloseItem[], field: "opening_value" | "projected_value" | "actual_value"): MonthEndCloseKpiSummary {
  const values = items.reduce((acc, item) => {
    acc[item.item_key] += Number(item[field] ?? 0);
    return acc;
  }, emptyValueMap());

  return buildKpiSummary(values);
}

function persistedItemToSnapshot(item: MonthEndCloseItem): PersistedItemSnapshot {
  return {
    rowKey: entityRowKey(item.entity_type, item.entity_id),
    entityId: item.entity_id,
    entityType: item.entity_type,
    entityTypeLabel: itemTypeLabel(item.entity_type, item.item_key),
    entityName: item.entity_name,
    key: item.item_key,
    itemType: item.item_type,
    openingValue: Number(item.opening_value ?? 0),
    projectedValue: Number(item.projected_value ?? 0),
    actualValue: Number(item.actual_value ?? 0),
    sortOrder: item.sort_order,
  };
}

function splitPersistedSnapshots(items: MonthEndCloseItem[]) {
  const exact = new Map<string, PersistedItemSnapshot>();
  const legacyBucketTotals = emptyValueMap();

  for (const item of items) {
    if (item.entity_type === "legacy-bucket") {
      legacyBucketTotals[item.item_key] += Number(item.actual_value ?? 0);
      continue;
    }

    const snapshot = persistedItemToSnapshot(item);
    exact.set(snapshot.rowKey, snapshot);
  }

  return {
    exact,
    legacyBucketTotals,
  };
}

function sortRowSeeds(seeds: PersistedItemSnapshot[]): PersistedItemSnapshot[] {
  return [...seeds]
    .sort((left, right) => {
      const definitionCompare = definitionForKey(left.key).sortOrder - definitionForKey(right.key).sortOrder;
      if (definitionCompare !== 0) {
        return definitionCompare;
      }

      return left.entityName.localeCompare(right.entityName, "en", { sensitivity: "base" });
    })
    .map((seed, index) => ({
      ...seed,
      sortOrder: definitionForKey(seed.key).sortOrder * 1000 + index,
    }));
}

function allocateAcrossRows(rows: PersistedItemSnapshot[], total: number, getBasis: (row: PersistedItemSnapshot) => number): Map<string, number> {
  const result = new Map<string, number>();
  if (rows.length === 0) {
    return result;
  }

  const basis = rows.map((row) => Math.max(0, Number(getBasis(row) ?? 0)));
  let basisTotal = basis.reduce((sum, value) => sum + value, 0);

  if (basisTotal <= 0) {
    const actualBasis = rows.map((row) => Math.max(0, Number(row.actualValue ?? 0)));
    const actualTotal = actualBasis.reduce((sum, value) => sum + value, 0);
    if (actualTotal > 0) {
      actualBasis.forEach((value, index) => {
        basis[index] = value;
      });
      basisTotal = actualTotal;
    }
  }

  let allocated = 0;
  rows.forEach((row, index) => {
    const value =
      index === rows.length - 1 ? total - allocated : basisTotal > 0 ? total * (basis[index] / basisTotal) : total / rows.length;
    allocated += value;
    result.set(row.rowKey, value);
  });

  return result;
}

function applyLegacyBucketFallback(rows: PersistedItemSnapshot[], legacyTotals: ValueMap, field: "openingValue" | "actualValue") {
  for (const definition of MONTH_END_CLOSE_ITEM_DEFINITIONS) {
    const total = legacyTotals[definition.key];
    if (total === 0) {
      continue;
    }

    const unresolvedRows = rows.filter((row) => row.key === definition.key && row[field] === 0);
    const allocations = allocateAcrossRows(unresolvedRows, total, (row) => row.actualValue);
    unresolvedRows.forEach((row) => {
      row[field] = allocations.get(row.rowKey) ?? row[field];
    });
  }
}

async function getProjectedBucketTotals(targetMonth: MonthReference): Promise<ValueMap> {
  const scenario: ProjectionScenario = {
    id: DEFAULT_SCENARIO_KEY,
    name: "Default projection",
    description: "Month-end close projection baseline.",
    startMonth: targetMonth.monthKey,
    planningHorizonYear: targetMonth.year,
    assumptions: [],
    events: [],
    isDefault: true,
  };

  const context = await projectionInputService.buildContext({
    scenario,
    startSource: { kind: "latest-closed-month-end" },
  });
  const result = await projectionEngine.run(context);
  const snapshot = result.snapshots.find((item) => item.month === targetMonth.monthKey) ?? result.snapshots[0] ?? null;

  return (snapshot?.projectedEntities ?? []).reduce((acc, entity) => {
    const amount = Number(entity.closingBalance ?? 0);
    switch (entity.kind) {
      case "bank-account":
        acc.bank_accounts += amount;
        break;
      case "mutual-fund":
        acc.mutual_funds += amount;
        break;
      case "stock":
        acc.stocks += amount;
        break;
      case "gold":
        acc.gold += amount;
        break;
      case "silver":
        acc.silver += amount;
        break;
      case "fixed-deposit":
        acc.fixed_deposits += amount;
        break;
      case "epf":
        acc.epf += amount;
        break;
      case "ppf":
        acc.ppf += amount;
        break;
      case "nps":
        acc.nps += amount;
        break;
      case "real-estate":
        acc.real_estate += amount;
        break;
      case "other-asset":
        acc.other_assets += amount;
        break;
      case "home-loan":
        acc.home_loans += amount;
        break;
      case "car-loan":
        acc.car_loans += amount;
        break;
      case "other-liability":
        acc.other_liabilities += amount;
        break;
      default:
        break;
    }

    return acc;
  }, emptyValueMap());
}

function buildProjectedAllocations(rows: PersistedItemSnapshot[], projectedBucketTotals: ValueMap): Map<string, number> {
  const allocations = new Map<string, number>();

  for (const definition of MONTH_END_CLOSE_ITEM_DEFINITIONS) {
    const bucketRows = rows.filter((row) => row.key === definition.key);
    const bucketAllocations = allocateAcrossRows(bucketRows, projectedBucketTotals[definition.key], (row) => row.openingValue);
    bucketRows.forEach((row) => {
      allocations.set(row.rowKey, bucketAllocations.get(row.rowKey) ?? 0);
    });
  }

  return allocations;
}

function buildWorkspaceItems(params: {
  currentSeeds: EntitySeed[];
  latestClosedItems: MonthEndCloseItem[];
  draftItems: MonthEndCloseItem[];
  projectedBucketTotals: ValueMap;
}): MonthEndCloseEditorItem[] {
  const latestClosedSnapshots = splitPersistedSnapshots(params.latestClosedItems);
  const draftSnapshots = splitPersistedSnapshots(params.draftItems);
  const rowMap = new Map<string, PersistedItemSnapshot>();

  for (const seed of params.currentSeeds) {
    rowMap.set(seed.rowKey, {
      rowKey: seed.rowKey,
      entityId: seed.entityId,
      entityType: seed.entityType,
      entityTypeLabel: seed.entityTypeLabel,
      entityName: seed.entityName,
      key: seed.key,
      itemType: seed.itemType,
      openingValue: 0,
      projectedValue: 0,
      actualValue: seed.actualValue,
      sortOrder: 0,
    });
  }

  // Reconciliation is driven by current canonical seed rows.
  // Draft rows that no longer map to active entities are removed by reconcileDraftOnWorkspaceLoad.

  const rows = sortRowSeeds([...rowMap.values()]);
  rows.forEach((row) => {
    const openingSnapshot = latestClosedSnapshots.exact.get(row.rowKey);
    const draftSnapshot = draftSnapshots.exact.get(row.rowKey);
    row.openingValue = openingSnapshot
      ? openingSnapshot.actualValue
      : draftSnapshot
        ? Number(draftSnapshot.openingValue ?? row.openingValue ?? 0)
        : 0;
    row.actualValue = draftSnapshot ? draftSnapshot.actualValue : row.actualValue;
  });

  applyLegacyBucketFallback(rows, latestClosedSnapshots.legacyBucketTotals, "openingValue");
  if (params.draftItems.length > 0) {
    applyLegacyBucketFallback(rows, draftSnapshots.legacyBucketTotals, "actualValue");
  }

  const projectedAllocations = buildProjectedAllocations(rows, params.projectedBucketTotals);

  return rows.map((row) => {
    const projectedValue = projectedAllocations.get(row.rowKey) ?? 0;
    const actualValue = Number(row.actualValue ?? 0);

    return {
      rowKey: row.rowKey,
      entityId: row.entityId,
      entityType: row.entityType,
      entityTypeLabel: row.entityTypeLabel,
      entityName: row.entityName,
      key: row.key,
      label: row.entityName,
      itemType: row.itemType,
      sortOrder: row.sortOrder,
      openingValue: Number(row.openingValue ?? 0),
      projectedValue,
      actualValue,
      absoluteVariance: calculateAbsoluteVariance(actualValue, projectedValue),
      percentageVariance: calculatePercentageVariance(actualValue, projectedValue),
    };
  });
}

function buildDashboard(params: {
  latestClosedMonth: MonthReference | null;
  pendingMonth: MonthReference;
  items: MonthEndCloseEditorItem[];
  previousNetWorth: number | null;
}): MonthEndCloseDashboard {
  const actualKpis = summarizeEditorItems(params.items, "actualValue");
  const projectedKpis = summarizeEditorItems(params.items, "projectedValue");
  const largestPositiveVariance =
    params.items.filter((item) => item.absoluteVariance > 0).sort((left, right) => right.absoluteVariance - left.absoluteVariance)[0] ?? null;
  const largestNegativeVariance =
    params.items.filter((item) => item.absoluteVariance < 0).sort((left, right) => left.absoluteVariance - right.absoluteVariance)[0] ?? null;

  return {
    currentClosedMonth: params.latestClosedMonth,
    pendingMonth: params.pendingMonth,
    totalAssets: actualKpis.totalAssets,
    totalLiabilities: actualKpis.totalLiabilities,
    netWorth: actualKpis.netWorth,
    monthOverMonthChange: params.previousNetWorth == null ? null : actualKpis.netWorth - params.previousNetWorth,
    projectionVariance: actualKpis.netWorth - projectedKpis.netWorth,
    largestPositiveVariance,
    largestNegativeVariance,
  };
}

function buildActualValueOverrideMap(items: MonthEndClosePersistInput["items"]): Map<string, number> {
  const overrides = new Map<string, number>();
  for (const item of items) {
    overrides.set(entityRowKey(item.entityType, item.entityId), Number(item.actualValue ?? 0));
  }

  return overrides;
}

function applyActualValueOverrides(items: MonthEndCloseEditorItem[], overrides: Map<string, number>): MonthEndCloseEditorItem[] {
  return items.map((item) => {
    const rowKey = entityRowKey(item.entityType, item.entityId);
    if (!overrides.has(rowKey)) {
      return item;
    }

    const actualValue = overrides.get(rowKey) ?? 0;

    return {
      ...item,
      actualValue,
      absoluteVariance: calculateAbsoluteVariance(actualValue, item.projectedValue),
      percentageVariance: calculatePercentageVariance(actualValue, item.projectedValue),
    };
  });
}

function toMonthEndCloseItemRows(params: { closeId: string; userId: string; items: MonthEndCloseEditorItem[] }) {
  return params.items.map((item) => {
    const openingValue = assertValidFinancialNumber(item.openingValue, `${item.entityName} openingValue`, { roundToScale: 2 });
    const projectedValue = assertValidFinancialNumber(item.projectedValue, `${item.entityName} projectedValue`, { roundToScale: 2 });
    const actualValue = assertValidFinancialNumber(item.actualValue, `${item.entityName} actualValue`, { roundToScale: 2 });
    const absoluteVariance = assertValidFinancialNumber(
      calculateAbsoluteVariance(actualValue, projectedValue),
      `${item.entityName} absoluteVariance`,
      { roundToScale: 2 },
    );
    const percentageVariance = assertValidNullableFinancialNumber(
      calculatePercentageVariance(actualValue, projectedValue),
      `${item.entityName} percentageVariance`,
      {
        roundToScale: 4,
        maxAbs: MAX_PERCENTAGE_ABS_VALUE_24_4,
      },
    );

    return {
      close_id: params.closeId,
      user_id: params.userId,
      entity_id: item.entityId,
      entity_type: item.entityType,
      entity_name: item.entityName,
      item_key: item.key,
      item_label: item.label,
      item_type: item.itemType,
      sort_order: item.sortOrder,
      opening_value: openingValue,
      projected_value: projectedValue,
      actual_value: actualValue,
      absolute_variance: absoluteVariance,
      percentage_variance: percentageVariance,
    };
  });
}

export class MonthEndCloseService {
  constructor(private readonly dependencies: MonthEndCloseServiceDependencies) {}

  private get repository() {
    return this.dependencies.repository;
  }

  private async loadBalanceSheetData() {
    if (this.dependencies.balanceSheetLoader) {
      return this.dependencies.balanceSheetLoader();
    }

    return getBalanceSheetData();
  }

  private async reconcileDraftOnWorkspaceLoad(params: {
    userId: string;
    draft: MonthEndClose | null;
    draftItems: MonthEndCloseItem[];
    reconciledItems: MonthEndCloseEditorItem[];
  }): Promise<void> {
    if (!params.draft) {
      return;
    }

    const incomingKeys = new Set(params.reconciledItems.map((item) => entityRowKey(item.entityType, item.entityId)));
    const rowsToDelete = params.draftItems.filter((item) => !incomingKeys.has(entityRowKey(item.entity_type, item.entity_id)));

    if (rowsToDelete.length > 0) {
      await this.repository.deleteCloseItemsByIds(rowsToDelete.map((row) => row.id));
    }

    // Re-upsert canonical draft rows so persisted draft stays synchronized with live entities immediately on load.
    await this.repository.upsertCloseItems(
      toMonthEndCloseItemRows({
        closeId: params.draft.id,
        userId: params.userId,
        items: params.reconciledItems,
      }),
    );
  }

  async getWorkspace(): Promise<MonthEndCloseWorkspace> {
    const userId = await this.repository.getAuthenticatedUserId();
    const [earliestOpen, latestClosed] = await Promise.all([
      this.repository.getEarliestOpenMonthEndClose(userId),
      this.repository.getLatestClosedMonthEndClose(userId),
    ]);
    const pendingMonthReference = earliestOpen
      ? createMonthReference(earliestOpen.close_year, earliestOpen.close_month)
      : latestClosed
        ? nextMonth(latestClosed.close_month, latestClosed.close_year)
        : createMonthReference(new Date().getFullYear(), new Date().getMonth() + 1);
    const priorClosedForPending = await this.repository.getNearestPriorClosedMonthEndClose(
      userId,
      pendingMonthReference.year,
      pendingMonthReference.month,
    );
    const previousMonthReference = priorClosedForPending
      ? createMonthReference(priorClosedForPending.close_year, priorClosedForPending.close_month)
      : null;
    const draft = earliestOpen ?? await this.repository.getDraftForMonth(userId, pendingMonthReference.year, pendingMonthReference.month);

    const [draftItems, priorClosedItems, balanceSheetData, projectedBucketTotals] = await Promise.all([
      draft ? this.repository.getCloseItems(draft.id) : Promise.resolve([]),
      priorClosedForPending ? this.repository.getCloseItems(priorClosedForPending.id) : Promise.resolve([]),
      this.loadBalanceSheetData(),
      getProjectedBucketTotals(pendingMonthReference),
    ]);

    const items = buildWorkspaceItems({
      currentSeeds: buildCurrentEntitySeeds(balanceSheetData),
      latestClosedItems: priorClosedItems,
      draftItems,
      projectedBucketTotals,
    });

    await this.reconcileDraftOnWorkspaceLoad({
      userId,
      draft,
      draftItems,
      reconciledItems: items,
    });

    const previousNetWorth = priorClosedItems.length > 0 ? summarizePersistedItems(priorClosedItems, "actual_value").netWorth : null;
    const dashboard = buildDashboard({
      latestClosedMonth: previousMonthReference,
      pendingMonth: pendingMonthReference,
      items,
      previousNetWorth,
    });

    return {
      close: draft,
      latestClose: latestClosed ?? null,
      month: pendingMonthReference,
      status: draft?.status ?? "draft",
      items,
      dashboard,
    };
  }

  async getLatestClosedItems(): Promise<MonthEndCloseItem[]> {
    const userId = await this.repository.getAuthenticatedUserId();
    const latestClosed = await this.repository.getLatestClosedMonthEndClose(userId);

    if (!latestClosed) {
      return [];
    }

    return this.repository.getCloseItems(latestClosed.id);
  }

  async saveDraft(input: MonthEndClosePersistInput): Promise<MonthEndCloseWorkspace> {
    return this.persist(input, "draft");
  }

  async closeMonth(input: MonthEndClosePersistInput): Promise<MonthEndCloseWorkspace> {
    return this.persist(input, "closed");
  }

  private async buildReconciledPersistItems(params: {
    userId: string;
    closeRecordId: string;
    closeYear: number;
    closeMonth: number;
    incomingItems: MonthEndClosePersistInput["items"];
  }): Promise<MonthEndCloseEditorItem[]> {
    const [latestClosed, existingRows, balanceSheetData] = await Promise.all([
      this.repository.getLatestClosedMonthEndClose(params.userId),
      this.repository.getCloseItems(params.closeRecordId),
      this.loadBalanceSheetData(),
    ]);

    const [latestClosedItems, projectedBucketTotals] = await Promise.all([
      latestClosed ? this.repository.getCloseItems(latestClosed.id) : Promise.resolve([]),
      getProjectedBucketTotals(createMonthReference(params.closeYear, params.closeMonth)),
    ]);

    const canonicalItems = buildWorkspaceItems({
      currentSeeds: buildCurrentEntitySeeds(balanceSheetData),
      latestClosedItems,
      draftItems: existingRows,
      projectedBucketTotals,
    });

    const incomingOverrides = buildActualValueOverrideMap(params.incomingItems);
    return applyActualValueOverrides(canonicalItems, incomingOverrides);
  }

  private async persist(input: MonthEndClosePersistInput, status: "draft" | "closed") {
    const userId = await this.repository.getAuthenticatedUserId();
    const existingDraft = input.closeId
      ? await this.repository.getCloseById(userId, input.closeId)
      : await this.repository.getDraftForMonth(userId, input.closeYear, input.closeMonth);
    const latestClosedForAudit = await this.repository.getLatestClosedMonthEndClose(userId);
    const latestVersionForMonth = await this.repository.getLatestVersionForMonth(userId, input.closeYear, input.closeMonth);

    console.groupCollapsed(`[MonthEndClosePersistAudit] status=${status}`);
    console.table({
      input_close_id: input.closeId ?? null,
      input_close_year: input.closeYear,
      input_close_month: input.closeMonth,
      input_status: status,
      existing_close_id: existingDraft?.id ?? null,
      existing_status: existingDraft?.status ?? null,
      existing_close_year: existingDraft?.close_year ?? null,
      existing_close_month: existingDraft?.close_month ?? null,
      existing_version: existingDraft?.version_number ?? null,
      latest_closed_close_id: latestClosedForAudit?.id ?? null,
      latest_closed_status: latestClosedForAudit?.status ?? null,
      latest_closed_close_year: latestClosedForAudit?.close_year ?? null,
      latest_closed_close_month: latestClosedForAudit?.close_month ?? null,
      latest_closed_version: latestClosedForAudit?.version_number ?? null,
      latest_month_version_close_id: latestVersionForMonth?.id ?? null,
      latest_month_version_status: latestVersionForMonth?.status ?? null,
      latest_month_version_close_year: latestVersionForMonth?.close_year ?? null,
      latest_month_version_close_month: latestVersionForMonth?.close_month ?? null,
      latest_month_version_version: latestVersionForMonth?.version_number ?? null,
    });

    if (existingDraft?.status === "closed") {
      console.groupEnd();
      throw new Error("Closed month-end closes are immutable. Create a new version instead.");
    }

    let closeRecord: MonthEndClose;

    if (!existingDraft) {
      const versionNumber = (latestVersionForMonth?.version_number ?? 0) + 1;
      const supersedesCloseId =
        latestVersionForMonth?.status === "closed" ? latestVersionForMonth.id : latestVersionForMonth?.supersedes_close_id ?? null;

      closeRecord = await this.repository.createMonthEndClose({
        userId,
        closeMonth: input.closeMonth,
        closeYear: input.closeYear,
        versionNumber,
        status,
        supersedesCloseId,
        closedAt: status === "closed" ? new Date().toISOString() : null,
      });
    } else {
      closeRecord = await this.repository.updateMonthEndCloseStatus({
        id: existingDraft.id,
        userId,
        status,
        closedAt: status === "closed" ? new Date().toISOString() : null,
      });
    }

    console.table({
      persisted_close_id: closeRecord.id,
      persisted_status: closeRecord.status,
      persisted_close_year: closeRecord.close_year,
      persisted_close_month: closeRecord.close_month,
      persisted_version: closeRecord.version_number,
    });
    console.groupEnd();

    const reconciledItems = await this.buildReconciledPersistItems({
      userId,
      closeRecordId: closeRecord.id,
      closeYear: input.closeYear,
      closeMonth: input.closeMonth,
      incomingItems: input.items,
    });

    const existingRows = await this.repository.getCloseItems(closeRecord.id);
    const incomingKeys = new Set(reconciledItems.map((item) => entityRowKey(item.entityType, item.entityId)));
    const rowsToDelete = existingRows.filter((item) => !incomingKeys.has(entityRowKey(item.entity_type, item.entity_id)));

    await this.repository.deleteCloseItemsByIds(rowsToDelete.map((row) => row.id));

    const itemRows = toMonthEndCloseItemRows({
      closeId: closeRecord.id,
      userId,
      items: reconciledItems,
    });

    await this.repository.upsertCloseItems(itemRows);

    return this.getWorkspace();
  }
}

export function calculateMonthEndCloseVarianceSummary(items: MonthEndCloseEditorItem[]) {
  const actualKpis = summarizeEditorItems(items, "actualValue");
  const projectedKpis = summarizeEditorItems(items, "projectedValue");

  return {
    actualKpis,
    projectedKpis,
    projectionVariance: actualKpis.netWorth - projectedKpis.netWorth,
  };
}
