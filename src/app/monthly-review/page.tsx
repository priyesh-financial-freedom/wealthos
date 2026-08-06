"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Compass,
  Landmark,
  PiggyBank,
  Scale,
  Sparkles,
  Wallet,
} from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import { getAssets, updateAsset } from "@/services/assets";
import { getBankAccounts, updateBankAccount } from "@/services/bankAccounts";
import { cashFlowManagementService } from "@/services/cashFlowManagement";
import { compensationService, type CompensationSummary } from "@/services/compensation";
import { getInvestments, updateInvestment } from "@/services/investments";
import { getLiabilities, updateLiability } from "@/services/liabilities";
import { closeMonthEndClose, getLatestClosedMonthEndCloseItems, getMonthEndCloseWorkspace, reopenMonth, saveMonthEndCloseDraft } from "@/services/monthEndClose";
import { calculateMonthEndCloseVarianceSummary } from "@/services/monthEndClose/MonthEndCloseService";
import { buildInvestmentValueMap } from "./investmentValueMap";
import { monthlyReviewComparisonService, projectionInputService, type ProjectionComparisonRow } from "@/services/projection";
import { getRetirementAccounts, updateRetirementAccount } from "@/services/retirement";
import { createGoldHolding, getGoldHoldings, updateGoldHolding } from "@/services/goldHoldings";
import { createSilverHolding, getSilverHoldings, updateSilverHolding } from "@/services/silverHoldings";
import { getRealEstateProperties, updateRealEstateProperty } from "@/services/realEstateProperties";
import { closeCurrentMonthSnapshot } from "@/services/monthlySnapshots";
import type { Asset } from "@/types/asset";
import type { BankAccount } from "@/types/bankAccount";
import type { GoldHolding } from "@/types/goldHolding";
import type { Investment } from "@/types/investment";
import type { Liability } from "@/types/liability";
import { MONTH_END_CLOSE_ITEM_DEFINITIONS, type MonthEndCloseEditorItem, type MonthEndCloseItem, type MonthEndCloseItemKey, type MonthEndClosePersistInput, type MonthEndCloseWorkspace } from "@/types/monthEndClose";
import type { ProjectionScenario } from "@/types/projection";
import type { RealEstateProperty } from "@/types/realEstateProperty";
import type { RetirementAccount } from "@/types/retirementAccount";
import type { SilverHolding } from "@/types/silverHolding";
import { formatCurrency, formatPercent } from "@/lib/formatters";

type WorkflowStepKey =
  | "compensation"
  | "financialAssets"
  | "retirement"
  | "nonFinancial"
  | "liabilities"
  | "expenses"
  | "summary"
  | "close";

interface WorkflowStep {
  key: WorkflowStepKey;
  title: string;
  description: string;
}

interface HealthScoreModel {
  score: number;
  savingsRate: number;
  debtToAssetRatio: number;
  projectionVarianceRatio: number;
}

interface ProjectionComparisonViewModel {
  reviewMonth: string;
  rows: ProjectionComparisonRow[];
  fixedPlanAvailable: boolean;
  rollingPlanAvailable: boolean;
  actualAvailable: boolean;
}

interface NetWorthBreakdownRow {
  label: string;
  amount: number;
  source: string;
  canonicalSourceApplied: boolean;
  duplicateSourcesIgnored: boolean;
  note?: string;
}

const RETIREMENT_INVESTMENT_CATEGORIES = new Set(["EPF", "PPF", "NPS"]);
const GOLD_INVESTMENT_CATEGORIES = new Set(["Gold", "Sovereign Gold Bonds"]);
const SILVER_INVESTMENT_CATEGORIES = new Set(["Silver"]);

function isCanonicalExcludedInvestment(params: {
  category: Investment["category"];
  hasDedicatedRetirementAccounts: boolean;
  hasDedicatedGoldHoldings: boolean;
  hasDedicatedSilverHoldings: boolean;
}) {
  if (params.hasDedicatedRetirementAccounts && RETIREMENT_INVESTMENT_CATEGORIES.has(params.category)) {
    return true;
  }

  if (params.hasDedicatedGoldHoldings && GOLD_INVESTMENT_CATEGORIES.has(params.category)) {
    return true;
  }

  if (params.hasDedicatedSilverHoldings && SILVER_INVESTMENT_CATEGORIES.has(params.category)) {
    return true;
  }

  return false;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    key: "compensation",
    title: "Compensation Review",
    description: "Confirm salary and deduction assumptions that feed monthly cash flow.",
  },
  {
    key: "financialAssets",
    title: "Financial Asset Updates",
    description: "Update bank account balances and portfolio values for investible financial assets.",
  },
  {
    key: "retirement",
    title: "Retirement Account Updates",
    description: "Capture latest balances for EPF, PPF, and NPS accounts.",
  },
  {
    key: "nonFinancial",
    title: "Non-Financial Asset Updates",
    description: "Refresh physical and tangible asset values including real estate, gold, silver, and other assets.",
  },
  {
    key: "liabilities",
    title: "Liability Updates",
    description: "Update outstanding principal balances across all liabilities.",
  },
  {
    key: "expenses",
    title: "Living Expenses (OPTIONAL)",
    description: "Optionally refresh this month’s living expense run-rate used by cash flow and projections.",
  },
  {
    key: "summary",
    title: "Financial Summary",
    description: "Review variance, health score, and auto-generated monthly insights before closing.",
  },
  {
    key: "close",
    title: "Month Close Confirmation",
    description: "Validate completion, close the month, create snapshot artifacts, and trigger downstream refresh.",
  },
];

function toNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toRoundedCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function sumValueMapByCategory(rows: Investment[], valuesById: Record<string, string>, category: Investment["category"]) {
  return rows
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + toNumber(valuesById[item.id] ?? String(item.current_value ?? 0)), 0);
}

function allocateCategoryTotal(items: Investment[], total: number) {
  if (items.length === 0) {
    return [] as Array<{ id: string; nextValue: number }>;
  }

  const currentValues = items.map((item) => Math.max(0, Number(item.current_value ?? 0)));
  const weightSum = currentValues.reduce((sum, value) => sum + value, 0);

  if (weightSum > 0) {
    let running = 0;
    return items.map((item, index) => {
      if (index === items.length - 1) {
        return { id: item.id, nextValue: toRoundedCurrency(total - running) };
      }

      const allocated = toRoundedCurrency((total * currentValues[index]) / weightSum);
      running += allocated;
      return { id: item.id, nextValue: allocated };
    });
  }

  const evenShare = toRoundedCurrency(total / items.length);
  let running = 0;
  return items.map((item, index) => {
    if (index === items.length - 1) {
      return { id: item.id, nextValue: toRoundedCurrency(total - running) };
    }

    running += evenShare;
    return { id: item.id, nextValue: evenShare };
  });
}

function buildMonthEndInvestmentActuals(params: {
  investments: Investment[];
  investmentValues: Record<string, string>;
  investmentSummaryValues: { mutualFundsTotal: string; stocksTotal: string };
}) {
  const mutualFundInvestments = params.investments.filter((item) => item.category === "Mutual Funds");
  const stockInvestments = params.investments.filter((item) => item.category === "Stocks");
  const granularInvestments = params.investments.filter((item) => item.category !== "Mutual Funds" && item.category !== "Stocks");

  const overrides = new Map<string, number>();

  const mutualFundAllocations = allocateCategoryTotal(mutualFundInvestments, toNumber(params.investmentSummaryValues.mutualFundsTotal));
  for (const allocation of mutualFundAllocations) {
    overrides.set(allocation.id, allocation.nextValue);
  }

  const stockAllocations = allocateCategoryTotal(stockInvestments, toNumber(params.investmentSummaryValues.stocksTotal));
  for (const allocation of stockAllocations) {
    overrides.set(allocation.id, allocation.nextValue);
  }

  for (const item of granularInvestments) {
    overrides.set(item.id, toNumber(params.investmentValues[item.id] ?? String(item.current_value ?? 0)));
  }

  return overrides;
}

function tone(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-700";
}

function nullableTone(value: number | null) {
  if (value == null) {
    return "text-slate-500";
  }

  return tone(value);
}

function scoreTone(score: number) {
  if (score >= 80) {
    return "text-emerald-700";
  }

  if (score >= 60) {
    return "text-amber-700";
  }

  return "text-rose-700";
}

function formatMonthKeyFromClose(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatCloseMonthLabel(close: { close_month: number; close_year: number } | null | undefined) {
  if (!close) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(close.close_year, close.close_month - 1, 1));
}

function formatValueOrDataRequired(value: number | null) {
  if (value == null) {
    return "Data required";
  }

  return formatCurrency(value, { maximumFractionDigits: 0 });
}

function formatValueOrNotAvailable(value: number | null) {
  if (value == null) {
    return "N/A";
  }

  return formatCurrency(value, { maximumFractionDigits: 0 });
}

function isImmediatePreviousMonth(prior: { year: number; month: number } | null, pending: { year: number; month: number }) {
  if (!prior) {
    return false;
  }

  if (pending.month === 1) {
    return prior.year === pending.year - 1 && prior.month === 12;
  }

  return prior.year === pending.year && prior.month === pending.month - 1;
}

type MonthlyReviewAuditAction =
  | "save-financial-assets"
  | "save-retirement"
  | "save-non-financial"
  | "save-liabilities"
  | "save-living-expenses";

function logMonthlyReviewSaveAudit(params: {
  action: MonthlyReviewAuditAction;
  workspace: MonthEndCloseWorkspace | null;
  saveTarget: {
    path: string;
    closeId: string | null;
    status: string;
    closeYear: number | null;
    closeMonth: number | null;
    meta?: Record<string, unknown>;
  };
}) {
  const workspaceClose = params.workspace?.close ?? null;
  const latestClosed = params.workspace?.latestClose ?? null;

  console.groupCollapsed(`[MonthlyReviewAudit] ${params.action}`);
  console.table({
    workspace_id: workspaceClose?.id ?? null,
    workspace_status: params.workspace?.status ?? null,
    workspace_close_year: params.workspace?.month.year ?? null,
    workspace_close_month: params.workspace?.month.month ?? null,
    save_close_id: params.saveTarget.closeId,
    save_status: params.saveTarget.status,
    save_close_year: params.saveTarget.closeYear,
    save_close_month: params.saveTarget.closeMonth,
    latest_closed_close_id: latestClosed?.id ?? null,
    latest_closed_status: latestClosed?.status ?? null,
    latest_closed_close_year: latestClosed?.close_year ?? null,
    latest_closed_close_month: latestClosed?.close_month ?? null,
    latest_closed_version: latestClosed?.version_number ?? null,
  });

  if (params.saveTarget.meta) {
    console.info("[MonthlyReviewAudit] save_target_meta", params.saveTarget.meta);
  }

  console.info("[MonthlyReviewAudit] save_target_path", params.saveTarget.path);
  console.groupEnd();
}

function buildHealthScoreModel(params: {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  projectionVariance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}): HealthScoreModel {
  const savingsRate = params.monthlyIncome > 0
    ? (params.monthlyIncome - params.monthlyExpenses) / params.monthlyIncome
    : 0;
  const debtToAssetRatio = params.totalAssets > 0 ? params.totalLiabilities / params.totalAssets : 0;
  const projectionVarianceRatio = params.netWorth !== 0 ? Math.abs(params.projectionVariance) / Math.abs(params.netWorth) : 0;

  const savingsSubScore = Math.max(0, Math.min(1, (savingsRate + 0.2) / 0.5));
  const leverageSubScore = Math.max(0, Math.min(1, 1 - debtToAssetRatio));
  const predictabilitySubScore = Math.max(0, Math.min(1, 1 - projectionVarianceRatio));

  const score = Math.round((savingsSubScore * 0.4 + leverageSubScore * 0.35 + predictabilitySubScore * 0.25) * 100);

  return {
    score,
    savingsRate,
    debtToAssetRatio,
    projectionVarianceRatio,
  };
}

function buildMonthlyInsights(params: {
  health: HealthScoreModel;
  projectionVariance: number;
  monthOverMonthChange: number | null;
  totalAssets: number;
  totalLiabilities: number;
}) {
  const insights: Array<{ title: string; detail: string; tone: "positive" | "warning" | "neutral" }> = [];

  if (params.health.savingsRate >= 0.25) {
    insights.push({
      title: "Strong Savings Buffer",
      detail: `Savings rate is ${formatPercent(params.health.savingsRate, { digits: 1, multiply: true })}, which supports compounding and emergency resilience.`,
      tone: "positive",
    });
  } else if (params.health.savingsRate < 0.1) {
    insights.push({
      title: "Savings Rate Needs Attention",
      detail: `Savings rate is ${formatPercent(params.health.savingsRate, { digits: 1, multiply: true })}; consider reducing discretionary spends or raising contributions.`,
      tone: "warning",
    });
  } else {
    insights.push({
      title: "Savings Rate Stable",
      detail: `Savings rate is ${formatPercent(params.health.savingsRate, { digits: 1, multiply: true })}; maintain consistency and improve gradually.`,
      tone: "neutral",
    });
  }

  if (Math.abs(params.projectionVariance) > Math.max(25000, Math.abs(params.totalAssets) * 0.04)) {
    insights.push({
      title: "Variance Drift Detected",
      detail: `Net worth variance vs projection is ${formatCurrency(params.projectionVariance, { maximumFractionDigits: 0 })}. Update assumptions to keep forecasts realistic.`,
      tone: "warning",
    });
  } else {
    insights.push({
      title: "Projection Alignment Healthy",
      detail: `Actuals are broadly aligned with projected trajectory for the month.`,
      tone: "positive",
    });
  }

  if (params.monthOverMonthChange == null) {
    insights.push({
      title: "Month-over-Month Baseline Missing",
      detail: "No prior closed month is available before the current review month, so month-over-month trend is unavailable.",
      tone: "neutral",
    });
  } else if (params.monthOverMonthChange >= 0) {
    insights.push({
      title: "Net Worth Momentum Positive",
      detail: `Month-over-month net worth moved ${formatCurrency(params.monthOverMonthChange, { maximumFractionDigits: 0 })}.`,
      tone: "positive",
    });
  } else {
    insights.push({
      title: "Net Worth Momentum Negative",
      detail: `Month-over-month net worth moved ${formatCurrency(params.monthOverMonthChange, { maximumFractionDigits: 0 })}; review liabilities and discretionary expenses.`,
      tone: "warning",
    });
  }

  const leverage = params.totalAssets > 0 ? params.totalLiabilities / params.totalAssets : 0;
  if (leverage > 0.6) {
    insights.push({
      title: "Leverage Elevated",
      detail: `Liabilities are ${formatPercent(leverage, { digits: 1, multiply: true })} of assets. Prioritize principal reduction where possible.`,
      tone: "warning",
    });
  } else {
    insights.push({
      title: "Leverage Within Range",
      detail: `Liabilities are ${formatPercent(leverage, { digits: 1, multiply: true })} of assets.`,
      tone: "neutral",
    });
  }

  return insights;
}

function sumWorkspaceBucket(items: MonthEndCloseWorkspace["items"], key: MonthEndCloseItemKey) {
  return items
    .filter((item) => item.key === key)
    .reduce((sum, item) => sum + Number(item.actualValue ?? 0), 0);
}

function sumWorkspaceRowsByPredicate(items: MonthEndCloseWorkspace["items"], predicate: (item: MonthEndCloseWorkspace["items"][number]) => boolean) {
  return items
    .filter(predicate)
    .reduce((sum, item) => sum + Number(item.actualValue ?? 0), 0);
}

function sumWorkspaceOpeningRowsByPredicate(items: MonthEndCloseWorkspace["items"], predicate: (item: MonthEndCloseWorkspace["items"][number]) => boolean) {
  return items
    .filter(predicate)
    .reduce((sum, item) => sum + Number(item.openingValue ?? 0), 0);
}

function retirementItemKey(accountType: RetirementAccount["account_type"]): Extract<MonthEndCloseItemKey, "epf" | "ppf" | "nps"> {
  return accountType === "EPF" ? "epf" : accountType === "PPF" ? "ppf" : "nps";
}

function retirementEntityName(account: RetirementAccount) {
  return `${account.owner} • ${account.institution}`;
}

function getDefinitionSortOrder(key: MonthEndCloseItemKey) {
  return MONTH_END_CLOSE_ITEM_DEFINITIONS.find((definition) => definition.key === key)?.sortOrder ?? 0;
}

function sumPersistedItemsByKey(items: MonthEndCloseItem[], key: MonthEndCloseItemKey) {
  return items
    .filter((item) => item.item_key === key)
    .reduce((sum, item) => sum + Number(item.actual_value ?? 0), 0);
}

function buildRetirementExpectedState(accounts: RetirementAccount[], values: Record<string, string>) {
  const byEntityId = new Map<string, { key: Extract<MonthEndCloseItemKey, "epf" | "ppf" | "nps">; actualValue: number }>();
  const totalsByKey = { epf: 0, ppf: 0, nps: 0 };

  for (const account of accounts) {
    const key = retirementItemKey(account.account_type);
    const actualValue = toNumber(values[account.id] ?? String(account.current_balance ?? 0));
    byEntityId.set(account.id, { key, actualValue });
    totalsByKey[key] += actualValue;
  }

  return { byEntityId, totalsByKey };
}

function collectRetirementActuals(items: MonthEndCloseEditorItem[]) {
  const byEntityId = new Map<string, { key: Extract<MonthEndCloseItemKey, "epf" | "ppf" | "nps">; actualValue: number }>();
  const totalsByKey = { epf: 0, ppf: 0, nps: 0 };

  for (const item of items) {
    if (item.entityType !== "retirement-account") {
      continue;
    }

    if (item.key !== "epf" && item.key !== "ppf" && item.key !== "nps") {
      continue;
    }

    const actualValue = Number(item.actualValue ?? 0);
    byEntityId.set(item.entityId, { key: item.key, actualValue });
    totalsByKey[item.key] += actualValue;
  }

  return { byEntityId, totalsByKey };
}

function buildRetirementDraftItems(params: {
  workspace: MonthEndCloseWorkspace;
  retirementAccounts: RetirementAccount[];
  retirementValues: Record<string, string>;
}): MonthEndClosePersistInput["items"] {
  const existingRetirementRows = new Map(
    params.workspace.items
      .filter((item) => item.entityType === "retirement-account")
      .map((item) => [item.entityId, item] as const),
  );

  const nonRetirementRows = params.workspace.items
    .filter((item) => item.entityType !== "retirement-account")
    .map((item) => ({
      entityId: item.entityId,
      entityType: item.entityType,
      entityName: item.entityName,
      key: item.key,
      label: item.label,
      itemType: item.itemType,
      sortOrder: item.sortOrder,
      openingValue: item.openingValue,
      projectedValue: item.projectedValue,
      actualValue: item.actualValue,
    }));

  const retirementRows = params.retirementAccounts.map((account, index) => {
    const existingRow = existingRetirementRows.get(account.id);
    const key = retirementItemKey(account.account_type);
    const entityName = retirementEntityName(account);
    const actualValue = toNumber(params.retirementValues[account.id] ?? String(account.current_balance ?? 0));

    if (existingRow) {
      return {
        entityId: existingRow.entityId,
        entityType: existingRow.entityType,
        entityName,
        key,
        label: entityName,
        itemType: existingRow.itemType,
        sortOrder: existingRow.sortOrder,
        openingValue: existingRow.openingValue,
        projectedValue: existingRow.projectedValue,
        actualValue,
      };
    }

    return {
      entityId: account.id,
      entityType: "retirement-account",
      entityName,
      key,
      label: entityName,
      itemType: "asset",
      sortOrder: getDefinitionSortOrder(key) * 1000 + index,
      openingValue: 0,
      projectedValue: 0,
      actualValue,
    };
  });

  return [...nonRetirementRows, ...retirementRows];
}

function verifyRetirementWorkspaceSync(params: {
  expected: ReturnType<typeof buildRetirementExpectedState>;
  items: MonthEndCloseWorkspace["items"];
}) {
  const actual = collectRetirementActuals(params.items);

  for (const [entityId, expectedRow] of params.expected.byEntityId.entries()) {
    const actualRow = actual.byEntityId.get(entityId);
    if (!actualRow || actualRow.key !== expectedRow.key || Math.abs(actualRow.actualValue - expectedRow.actualValue) >= 0.01) {
      return false;
    }
  }

  return Math.abs(actual.totalsByKey.epf - params.expected.totalsByKey.epf) < 0.01
    && Math.abs(actual.totalsByKey.ppf - params.expected.totalsByKey.ppf) < 0.01
    && Math.abs(actual.totalsByKey.nps - params.expected.totalsByKey.nps) < 0.01;
}

export default function MonthlyReviewPage() {
  const [workspace, setWorkspace] = useState<MonthEndCloseWorkspace | null>(null);
  const [compensationSummary, setCompensationSummary] = useState<CompensationSummary | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [retirementAccounts, setRetirementAccounts] = useState<RetirementAccount[]>([]);
  const [goldHoldings, setGoldHoldings] = useState<GoldHolding[]>([]);
  const [silverHoldings, setSilverHoldings] = useState<SilverHolding[]>([]);
  const [latestClosedItems, setLatestClosedItems] = useState<MonthEndCloseItem[]>([]);
  const [realEstateProperties, setRealEstateProperties] = useState<RealEstateProperty[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [livingExpenseAmount, setLivingExpenseAmount] = useState<string>("0");
  const [livingExpenseNotes, setLivingExpenseNotes] = useState<string>("");

  const [bankAccountValues, setBankAccountValues] = useState<Record<string, string>>({});
  const [investmentValues, setInvestmentValues] = useState<Record<string, string>>({});
  const [investmentSummaryValues, setInvestmentSummaryValues] = useState<{
    mutualFundsTotal: string;
    stocksTotal: string;
  }>({
    mutualFundsTotal: "0",
    stocksTotal: "0",
  });
  const [retirementValues, setRetirementValues] = useState<Record<string, string>>({});
  const [assetValues, setAssetValues] = useState<Record<string, string>>({});
  const [goldValues, setGoldValues] = useState<Record<string, string>>({});
  const [silverValues, setSilverValues] = useState<Record<string, string>>({});
  const [propertyValues, setPropertyValues] = useState<Record<string, string>>({});
  const [liabilityValues, setLiabilityValues] = useState<Record<string, string>>({});
  const [showAddGoldForm, setShowAddGoldForm] = useState(false);
  const [showAddSilverForm, setShowAddSilverForm] = useState(false);
  const [newGoldHoldingName, setNewGoldHoldingName] = useState("Gold at home");
  const [newGoldHoldingOwner, setNewGoldHoldingOwner] = useState("Household");
  const [newGoldHoldingValue, setNewGoldHoldingValue] = useState("0");
  const [newSilverHoldingName, setNewSilverHoldingName] = useState("Silver holding");
  const [newSilverHoldingOwner, setNewSilverHoldingOwner] = useState("Household");
  const [newSilverHoldingValue, setNewSilverHoldingValue] = useState("0");

  const [completedSteps, setCompletedSteps] = useState<Record<WorkflowStepKey, boolean>>({
    compensation: false,
    financialAssets: false,
    retirement: false,
    nonFinancial: false,
    liabilities: false,
    expenses: false,
    summary: false,
    close: false,
  });
  const [closeConfirmed, setCloseConfirmed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState<WorkflowStepKey | null>(null);
  const [closingMonth, setClosingMonth] = useState(false);
  const [mappingWarning, setMappingWarning] = useState<string | null>(null);
  const [projectionComparison, setProjectionComparison] = useState<ProjectionComparisonViewModel | null>(null);

  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopeningMonth, setReopeningMonth] = useState(false);

  function applyLoadedWorkspaceData(params: {
    monthWorkspace: MonthEndCloseWorkspace;
    summary: CompensationSummary | null;
    bankAccountRows: BankAccount[];
    investmentRows: Investment[];
    retirementRows: RetirementAccount[];
    goldRows: GoldHolding[];
    silverRows: SilverHolding[];
    latestClosedItems: MonthEndCloseItem[];
    propertyRows: RealEstateProperty[];
    assetRows: Asset[];
    liabilityRows: Liability[];
    cashSnapshot: Awaited<ReturnType<typeof cashFlowManagementService.getCashFlowSnapshot>> | null;
  }) {
    setWorkspace(params.monthWorkspace);
    setCompensationSummary(params.summary);
    setBankAccounts(params.bankAccountRows);
    setInvestments(params.investmentRows);
    setRetirementAccounts(params.retirementRows);
    setGoldHoldings(params.goldRows);
    setSilverHoldings(params.silverRows);
    setLatestClosedItems(params.latestClosedItems);
    setRealEstateProperties(params.propertyRows);
    setAssets(params.assetRows);
    setLiabilities(params.liabilityRows);
    setLivingExpenseAmount(String(params.cashSnapshot?.livingExpense.monthlyAmount ?? 0));
    setLivingExpenseNotes(params.cashSnapshot?.livingExpense.notes ?? "");

    setBankAccountValues(params.bankAccountRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(item.current_balance ?? 0);
      return acc;
    }, {}));

    const investmentValueMap = buildInvestmentValueMap(params.monthWorkspace, params.investmentRows, {
      hasDedicatedRetirementAccounts: params.retirementRows.length > 0,
      hasDedicatedGoldHoldings: params.goldRows.length > 0,
      hasDedicatedSilverHoldings: params.silverRows.length > 0,
    });
    setInvestmentValues(investmentValueMap.valuesById);
    setMappingWarning(investmentValueMap.warningMessage);
    setInvestmentSummaryValues({
      mutualFundsTotal: String(sumValueMapByCategory(params.investmentRows, investmentValueMap.valuesById, "Mutual Funds")),
      stocksTotal: String(sumValueMapByCategory(params.investmentRows, investmentValueMap.valuesById, "Stocks")),
    });
    setRetirementValues(params.retirementRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(item.current_balance ?? 0);
      return acc;
    }, {}));
    setAssetValues(params.assetRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(item.current_value ?? 0);
      return acc;
    }, {}));
    setGoldValues(params.goldRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(item.current_value ?? 0);
      return acc;
    }, {}));
    setSilverValues(params.silverRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(item.current_value ?? 0);
      return acc;
    }, {}));
    setPropertyValues(params.propertyRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(item.current_market_value ?? 0);
      return acc;
    }, {}));
    setLiabilityValues(params.liabilityRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(item.outstanding_amount ?? 0);
      return acc;
    }, {}));

    if (params.goldRows.length > 0) {
      setShowAddGoldForm(false);
    }

    if (params.silverRows.length > 0) {
      setShowAddSilverForm(false);
    }
  }

  async function loadProjectionComparisonForWorkspace(monthWorkspace: MonthEndCloseWorkspace) {
    const close = monthWorkspace.latestClose ?? monthWorkspace.close;
    if (!close || close.status !== "closed") {
      setProjectionComparison(null);
      return;
    }

    const reviewMonth = formatMonthKeyFromClose(close.close_year, close.close_month);
    const result = await monthlyReviewComparisonService.getMonthlyReviewComparison({
      user_id: close.user_id,
      review_month: reviewMonth,
      close_id: close.id,
    });

    setProjectionComparison({
      reviewMonth,
      rows: result.rows,
      fixedPlanAvailable: result.fixed_plan_version_id != null,
      rollingPlanAvailable: result.rolling_plan_version_id != null,
      actualAvailable: result.actual_close_id != null,
    });
  }

  async function loadWorkspaceData() {
    try {
      setLoading(true);
      setError(null);

      const [monthWorkspace, summary, bankAccountRows, investmentRows, retirementRows, goldRows, silverRows, latestClosedRows, propertyRows, assetRows, liabilityRows, cashSnapshot] = await Promise.all([
        getMonthEndCloseWorkspace(),
        compensationService.getSummary().catch(() => null),
        getBankAccounts(),
        getInvestments(),
        getRetirementAccounts(),
        getGoldHoldings(),
        getSilverHoldings(),
        getLatestClosedMonthEndCloseItems(),
        getRealEstateProperties(),
        getAssets(),
        getLiabilities(),
        cashFlowManagementService.getCashFlowSnapshot().catch(() => null),
      ]);

      applyLoadedWorkspaceData({
        monthWorkspace,
        summary,
        bankAccountRows,
        investmentRows,
        retirementRows,
        goldRows,
        silverRows,
        latestClosedItems: latestClosedRows,
        propertyRows,
        assetRows,
        liabilityRows,
        cashSnapshot,
      });

      await loadProjectionComparisonForWorkspace(monthWorkspace).catch(() => {
        setProjectionComparison(null);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load monthly review workspace");
      setWorkspace(null);
      setProjectionComparison(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        setLoading(true);
        setError(null);

        const [monthWorkspace, summary, bankAccountRows, investmentRows, retirementRows, goldRows, silverRows, latestClosedRows, propertyRows, assetRows, liabilityRows, cashSnapshot] = await Promise.all([
          getMonthEndCloseWorkspace(),
          compensationService.getSummary().catch(() => null),
          getBankAccounts(),
          getInvestments(),
          getRetirementAccounts(),
          getGoldHoldings(),
          getSilverHoldings(),
          getLatestClosedMonthEndCloseItems(),
          getRealEstateProperties(),
          getAssets(),
          getLiabilities(),
          cashFlowManagementService.getCashFlowSnapshot().catch(() => null),
        ]);

        if (!isMounted) {
          return;
        }

        applyLoadedWorkspaceData({
          monthWorkspace,
          summary,
          bankAccountRows,
          investmentRows,
          retirementRows,
          goldRows,
          silverRows,
          latestClosedItems: latestClosedRows,
          propertyRows,
          assetRows,
          liabilityRows,
          cashSnapshot,
        });

        await loadProjectionComparisonForWorkspace(monthWorkspace).catch(() => {
          setProjectionComparison(null);
        });
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load monthly review workspace");
        setWorkspace(null);
        setProjectionComparison(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    if (!workspace) {
      return null;
    }

    return calculateMonthEndCloseVarianceSummary(workspace.items);
  }, [workspace]);

  const monthlyCash = useMemo(() => {
    const amount = toNumber(livingExpenseAmount);
    return {
      monthlyIncome: compensationSummary ? compensationSummary.netMonthlySalary + compensationSummary.monthlyBonusEquivalent : 0,
      monthlyExpenses: Math.max(0, amount),
    };
  }, [compensationSummary, livingExpenseAmount]);

  const latestClosedMonthLabel = useMemo(() => formatCloseMonthLabel(workspace?.latestClose), [workspace?.latestClose]);

  const healthModel = useMemo(() => {
    if (!workspace || !summary) {
      return null;
    }

    return buildHealthScoreModel({
      netWorth: summary.actualKpis.netWorth,
      totalAssets: summary.actualKpis.totalAssets,
      totalLiabilities: summary.actualKpis.totalLiabilities,
      projectionVariance: summary.projectionVariance,
      monthlyIncome: monthlyCash.monthlyIncome,
      monthlyExpenses: monthlyCash.monthlyExpenses,
    });
  }, [monthlyCash, summary, workspace]);

  const monthlyInsights = useMemo(() => {
    if (!workspace || !summary || !healthModel) {
      return [];
    }

    return buildMonthlyInsights({
      health: healthModel,
      projectionVariance: summary.projectionVariance,
      monthOverMonthChange: workspace.dashboard.monthOverMonthChange,
      totalAssets: summary.actualKpis.totalAssets,
      totalLiabilities: summary.actualKpis.totalLiabilities,
    });
  }, [healthModel, summary, workspace]);

  const financialSummaryAudit = useMemo(() => {
    if (!workspace || !summary || !healthModel) {
      return null;
    }

    const netWorthExpected = summary.actualKpis.totalAssets - summary.actualKpis.totalLiabilities;
    const savingsRateExpected = monthlyCash.monthlyIncome > 0
      ? (monthlyCash.monthlyIncome - monthlyCash.monthlyExpenses) / monthlyCash.monthlyIncome
      : 0;
    const debtToAssetExpected = summary.actualKpis.totalAssets > 0
      ? summary.actualKpis.totalLiabilities / summary.actualKpis.totalAssets
      : 0;
    const varianceRatioExpected = netWorthExpected !== 0
      ? Math.abs(summary.projectionVariance) / Math.abs(netWorthExpected)
      : 0;

    const epfInvestmentTotal = investments
      .filter((item) => item.category === "EPF")
      .reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
    const ppfInvestmentTotal = investments
      .filter((item) => item.category === "PPF")
      .reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
    const npsInvestmentTotal = investments
      .filter((item) => item.category === "NPS")
      .reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);

    const epfRetirementTotal = retirementAccounts
      .filter((item) => item.account_type === "EPF")
      .reduce((sum, item) => sum + Number(item.current_balance ?? 0), 0);
    const ppfRetirementTotal = retirementAccounts
      .filter((item) => item.account_type === "PPF")
      .reduce((sum, item) => sum + Number(item.current_balance ?? 0), 0);
    const npsRetirementTotal = retirementAccounts
      .filter((item) => item.account_type === "NPS")
      .reduce((sum, item) => sum + Number(item.current_balance ?? 0), 0);

    const goldInvestmentTotal = investments
      .filter((item) => item.category === "Gold")
      .reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
    const silverInvestmentTotal = investments
      .filter((item) => item.category === "Silver")
      .reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
    const sgbInvestmentTotal = investments
      .filter((item) => item.category === "Sovereign Gold Bonds")
      .reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);

    const dedicatedGoldTotal = goldHoldings.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
    const dedicatedSilverTotal = silverHoldings.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);

    const assetsRealEstateTotal = assets
      .filter((item) => item.asset_type === "real_estate")
      .reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
    const dedicatedRealEstateTotal = realEstateProperties.reduce((sum, item) => sum + Number(item.current_market_value ?? 0), 0);

    const hasDedicatedRetirement = retirementAccounts.length > 0;
    const hasDedicatedGold = goldHoldings.length > 0;
    const hasDedicatedSilver = silverHoldings.length > 0;
    const hasDedicatedRealEstate = realEstateProperties.length > 0;
    const canonicalDedupeApplied = hasDedicatedRetirement || hasDedicatedGold || hasDedicatedSilver || hasDedicatedRealEstate;

    const totalsByKey = summary.actualKpis.totalsByKey;

    const priorClosedMonth = workspace.dashboard.currentClosedMonth;
    const isAdjacentPriorMonth = isImmediatePreviousMonth(
      priorClosedMonth ? { year: priorClosedMonth.year, month: priorClosedMonth.month } : null,
      { year: workspace.month.year, month: workspace.month.month },
    );
    const livingExpenseProvided = completedSteps.expenses || toNumber(livingExpenseAmount) > 0 || livingExpenseNotes.trim().length > 0;

    const assetTypeById = new Map(assets.map((item) => [item.id, item.asset_type] as const));
    const liabilityTypeById = new Map(liabilities.map((item) => [item.id, item.liability_type] as const));
    const vehicleAmountUsed = sumWorkspaceRowsByPredicate(
      workspace.items,
      (item) => item.key === "other_assets" && item.entityType === "asset" && assetTypeById.get(item.entityId) === "vehicle",
    );
    const creditCardAmountUsed = sumWorkspaceRowsByPredicate(
      workspace.items,
      (item) => item.key === "other_liabilities" && item.entityType === "liability" && liabilityTypeById.get(item.entityId) === "Credit Card",
    );
    const overdraftAmountUsed = sumWorkspaceRowsByPredicate(
      workspace.items,
      (item) =>
        item.key === "other_liabilities" &&
        item.entityType === "liability" &&
        (liabilityTypeById.get(item.entityId) === "Bank Overdraft" || liabilityTypeById.get(item.entityId) === "Overdraft / Line of Credit"),
    );
    const otherAssetsAmountUsed = totalsByKey.other_assets - vehicleAmountUsed;
    const otherLiabilitiesAmountUsed = totalsByKey.other_liabilities - creditCardAmountUsed - overdraftAmountUsed;

    const ignoredDuplicateWarnings: string[] = [];
    if (hasDedicatedRetirement && epfInvestmentTotal > 0) {
      ignoredDuplicateWarnings.push("EPF also exists in investment holdings but was ignored because retirement accounts are canonical.");
    }
    if (hasDedicatedRetirement && ppfInvestmentTotal > 0) {
      ignoredDuplicateWarnings.push("PPF also exists in investment holdings but was ignored because retirement accounts are canonical.");
    }
    if (hasDedicatedRetirement && npsInvestmentTotal > 0) {
      ignoredDuplicateWarnings.push("NPS also exists in investment holdings but was ignored because retirement accounts are canonical.");
    }
    if (hasDedicatedGold && (goldInvestmentTotal > 0 || sgbInvestmentTotal > 0)) {
      ignoredDuplicateWarnings.push("Gold also exists in investment holdings but was ignored because gold holdings are canonical.");
    }
    if (hasDedicatedSilver && silverInvestmentTotal > 0) {
      ignoredDuplicateWarnings.push("Silver also exists in investment holdings but was ignored because silver holdings are canonical.");
    }
    if (hasDedicatedRealEstate && assetsRealEstateTotal > 0) {
      ignoredDuplicateWarnings.push("Property also exists in generic assets but was ignored because real estate properties are canonical.");
    }

    const netWorthBreakdownRows: NetWorthBreakdownRow[] = [
      {
        label: "Cash / Bank",
        amount: totalsByKey.bank_accounts,
        source: "month_end_close_items canonical bucket: bank_accounts",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Mutual Funds",
        amount: totalsByKey.mutual_funds,
        source: "month_end_close_items canonical bucket: mutual_funds",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Stocks",
        amount: totalsByKey.stocks,
        source: "month_end_close_items canonical bucket: stocks",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "EPF",
        amount: totalsByKey.epf,
        source: "month_end_close_items canonical bucket: epf",
        canonicalSourceApplied: hasDedicatedRetirement,
        duplicateSourcesIgnored: hasDedicatedRetirement && epfInvestmentTotal > 0,
        note: hasDedicatedRetirement && epfInvestmentTotal > 0
          ? "Investment EPF values were ignored as duplicate source."
          : undefined,
      },
      {
        label: "PPF",
        amount: totalsByKey.ppf,
        source: "month_end_close_items canonical bucket: ppf",
        canonicalSourceApplied: hasDedicatedRetirement,
        duplicateSourcesIgnored: hasDedicatedRetirement && ppfInvestmentTotal > 0,
        note: hasDedicatedRetirement && ppfInvestmentTotal > 0
          ? "Investment PPF values were ignored as duplicate source."
          : undefined,
      },
      {
        label: "NPS",
        amount: totalsByKey.nps,
        source: "month_end_close_items canonical bucket: nps",
        canonicalSourceApplied: hasDedicatedRetirement,
        duplicateSourcesIgnored: hasDedicatedRetirement && npsInvestmentTotal > 0,
        note: hasDedicatedRetirement && npsInvestmentTotal > 0
          ? "Investment NPS values were ignored as duplicate source."
          : undefined,
      },
      {
        label: "Fixed Deposits / Bonds",
        amount: totalsByKey.fixed_deposits,
        source: "month_end_close_items canonical bucket: fixed_deposits",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Property",
        amount: totalsByKey.real_estate,
        source: "month_end_close_items canonical bucket: real_estate",
        canonicalSourceApplied: hasDedicatedRealEstate,
        duplicateSourcesIgnored: hasDedicatedRealEstate && assetsRealEstateTotal > 0,
        note: hasDedicatedRealEstate && assetsRealEstateTotal > 0
          ? "Legacy real_estate asset rows were ignored as duplicate source."
          : undefined,
      },
      {
        label: "Gold",
        amount: totalsByKey.gold,
        source: "month_end_close_items canonical bucket: gold",
        canonicalSourceApplied: hasDedicatedGold,
        duplicateSourcesIgnored: hasDedicatedGold && (goldInvestmentTotal > 0 || sgbInvestmentTotal > 0),
        note: hasDedicatedGold && (goldInvestmentTotal > 0 || sgbInvestmentTotal > 0)
          ? "Investment gold and SGB values were ignored as duplicate source."
          : undefined,
      },
      {
        label: "Silver",
        amount: totalsByKey.silver,
        source: "month_end_close_items canonical bucket: silver",
        canonicalSourceApplied: hasDedicatedSilver,
        duplicateSourcesIgnored: hasDedicatedSilver && silverInvestmentTotal > 0,
        note: hasDedicatedSilver && silverInvestmentTotal > 0
          ? "Investment silver values were ignored as duplicate source."
          : undefined,
      },
      {
        label: "Vehicle",
        amount: vehicleAmountUsed,
        source: "month_end_close_items canonical bucket: other_assets (vehicle rows)",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Other Assets",
        amount: otherAssetsAmountUsed,
        source: "month_end_close_items canonical bucket: other_assets",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Total Assets",
        amount: summary.actualKpis.totalAssets,
        source: "sum(canonical asset buckets in month_end_close_items)",
        canonicalSourceApplied: canonicalDedupeApplied,
        duplicateSourcesIgnored: ignoredDuplicateWarnings.length > 0,
      },
      {
        label: "Home Loans",
        amount: totalsByKey.home_loans,
        source: "month_end_close_items canonical bucket: home_loans",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Car Loans",
        amount: totalsByKey.car_loans,
        source: "month_end_close_items canonical bucket: car_loans",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Credit Cards",
        amount: creditCardAmountUsed,
        source: "month_end_close_items canonical bucket: other_liabilities (credit card rows)",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Overdraft",
        amount: overdraftAmountUsed,
        source: "month_end_close_items canonical bucket: other_liabilities (overdraft rows)",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Other Liabilities",
        amount: otherLiabilitiesAmountUsed,
        source: "month_end_close_items canonical bucket: other_liabilities",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Total Liabilities",
        amount: summary.actualKpis.totalLiabilities,
        source: "sum(liability buckets in month_end_close_items)",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: false,
      },
      {
        label: "Net Worth",
        amount: summary.actualKpis.netWorth,
        source: "Total Assets - Total Liabilities",
        canonicalSourceApplied: true,
        duplicateSourcesIgnored: ignoredDuplicateWarnings.length > 0,
      },
    ];

    const renderedAssetTotal = netWorthBreakdownRows
      .filter((row) => [
        "Cash / Bank",
        "Mutual Funds",
        "Stocks",
        "EPF",
        "PPF",
        "NPS",
        "Fixed Deposits / Bonds",
        "Property",
        "Gold",
        "Silver",
        "Vehicle",
        "Other Assets",
      ].includes(row.label))
      .reduce((sum, row) => sum + row.amount, 0);
    const renderedLiabilityTotal = netWorthBreakdownRows
      .filter((row) => ["Home Loans", "Car Loans", "Credit Cards", "Overdraft", "Other Liabilities"].includes(row.label))
      .reduce((sum, row) => sum + row.amount, 0);

    return {
      rows: [
        {
          metric: "Net Worth",
          formula: "Total Assets - Total Liabilities",
          sources: "month_end_close_items via MonthEndCloseService summary",
          sourceRecords: `items=${workspace.items.length}, canonicalDedupeApplied=${canonicalDedupeApplied ? "yes" : "no"}`,
          substituted: `${formatCurrency(summary.actualKpis.totalAssets, { maximumFractionDigits: 0 })} - ${formatCurrency(summary.actualKpis.totalLiabilities, { maximumFractionDigits: 0 })}`,
          expected: formatCurrency(netWorthExpected, { maximumFractionDigits: 0 }),
          displayed: formatCurrency(summary.actualKpis.netWorth, { maximumFractionDigits: 0 }),
        },
        {
          metric: "Projection Variance",
          formula: "Actual Net Worth - Projected Net Worth",
          sources: "month_end_close_items actual/projected aggregates",
          sourceRecords: `items=${workspace.items.length}`,
          substituted: `${formatCurrency(summary.actualKpis.netWorth, { maximumFractionDigits: 0 })} - ${formatCurrency(summary.projectedKpis.netWorth, { maximumFractionDigits: 0 })}`,
          expected: formatCurrency(summary.actualKpis.netWorth - summary.projectedKpis.netWorth, { maximumFractionDigits: 0 }),
          displayed: formatCurrency(summary.projectionVariance, { maximumFractionDigits: 0 }),
        },
        {
          metric: "Month-over-Month Change",
          formula: "Current month net worth - prior closed month net worth",
          sources: "month_end_close dashboard KPI",
          sourceRecords: `reviewMonth=${workspace.month.monthKey}, priorClosed=${priorClosedMonth?.monthKey ?? "none"}, adjacency=${priorClosedMonth ? (isAdjacentPriorMonth ? "adjacent" : "non-adjacent") : "none"}`,
          substituted: workspace.dashboard.monthOverMonthChange == null
            ? "No prior closed month available"
            : `${formatCurrency(workspace.dashboard.netWorth, { maximumFractionDigits: 0 })} - ${formatValueOrNotAvailable(priorClosedMonth ? workspace.dashboard.netWorth - workspace.dashboard.monthOverMonthChange : null)}`,
          expected: formatValueOrNotAvailable(workspace.dashboard.monthOverMonthChange),
          displayed: formatValueOrNotAvailable(workspace.dashboard.monthOverMonthChange),
        },
        {
          metric: "Savings Rate",
          formula: "(Monthly Income - Monthly Expenses) / Monthly Income",
          sources: "compensationService + cashFlowManagementService",
          sourceRecords: `incomeSources=compensation, expenseSources=living_expense, provided=${livingExpenseProvided ? "yes" : "no"}`,
          substituted: livingExpenseProvided
            ? `(${formatCurrency(monthlyCash.monthlyIncome, { maximumFractionDigits: 0 })} - ${formatCurrency(monthlyCash.monthlyExpenses, { maximumFractionDigits: 0 })}) / ${formatCurrency(monthlyCash.monthlyIncome, { maximumFractionDigits: 0 })}`
            : "Not provided",
          expected: formatPercent(savingsRateExpected, { digits: 1, multiply: true }),
          displayed: formatPercent(healthModel.savingsRate, { digits: 1, multiply: true }),
        },
        {
          metric: "Debt-to-Asset Ratio",
          formula: "Total Liabilities / Total Assets",
          sources: "month_end_close_items liabilities/assets buckets",
          sourceRecords: `liabilityItems=${workspace.items.filter((item) => item.itemType === "liability").length}`,
          substituted: `${formatCurrency(summary.actualKpis.totalLiabilities, { maximumFractionDigits: 0 })} / ${formatCurrency(summary.actualKpis.totalAssets, { maximumFractionDigits: 0 })}`,
          expected: formatPercent(debtToAssetExpected, { digits: 1, multiply: true }),
          displayed: formatPercent(healthModel.debtToAssetRatio, { digits: 1, multiply: true }),
        },
        {
          metric: "Variance Ratio",
          formula: "|Projection Variance| / |Net Worth|",
          sources: "MonthEndClose variance summary",
          sourceRecords: `netWorth=${formatCurrency(netWorthExpected, { maximumFractionDigits: 0 })}`,
          substituted: `|${formatCurrency(summary.projectionVariance, { maximumFractionDigits: 0 })}| / |${formatCurrency(netWorthExpected, { maximumFractionDigits: 0 })}|`,
          expected: formatPercent(varianceRatioExpected, { digits: 1, multiply: true }),
          displayed: formatPercent(healthModel.projectionVarianceRatio, { digits: 1, multiply: true }),
        },
      ],
      overlapChecks: [
        {
          label: "EPF duplicate exposure",
          moduleA: "investment_holdings (EPF)",
          moduleB: "epf_accounts",
          moduleAValue: epfInvestmentTotal,
          moduleBValue: epfRetirementTotal,
          recommendedSource: "epf_accounts",
          note: epfInvestmentTotal > 0 && epfRetirementTotal > 0
            ? "Potential duplicate exposure detected. Canonical source in month-end is dedicated retirement accounts."
            : "No duplicate exposure detected.",
        },
        {
          label: "PPF duplicate exposure",
          moduleA: "investment_holdings (PPF)",
          moduleB: "ppf_accounts",
          moduleAValue: ppfInvestmentTotal,
          moduleBValue: ppfRetirementTotal,
          recommendedSource: "ppf_accounts",
          note: ppfInvestmentTotal > 0 && ppfRetirementTotal > 0
            ? "Potential duplicate exposure detected. Canonical source in month-end is dedicated retirement accounts."
            : "No duplicate exposure detected.",
        },
        {
          label: "NPS duplicate exposure",
          moduleA: "investment_holdings (NPS)",
          moduleB: "nps_accounts",
          moduleAValue: npsInvestmentTotal,
          moduleBValue: npsRetirementTotal,
          recommendedSource: "nps_accounts",
          note: npsInvestmentTotal > 0 && npsRetirementTotal > 0
            ? "Potential duplicate exposure detected. Canonical source in month-end is dedicated retirement accounts."
            : "No duplicate exposure detected.",
        },
        {
          label: "Gold duplicate exposure",
          moduleA: "investment_holdings (Gold)",
          moduleB: "gold_holdings",
          moduleAValue: goldInvestmentTotal,
          moduleBValue: dedicatedGoldTotal,
          recommendedSource: "gold_holdings",
          note: goldInvestmentTotal > 0 && dedicatedGoldTotal > 0
            ? "Potential duplicate exposure detected. Canonical source in month-end is dedicated gold holdings."
            : "No overlap detected from current module values.",
        },
        {
          label: "Silver duplicate exposure",
          moduleA: "investment_holdings (Silver)",
          moduleB: "silver_holdings",
          moduleAValue: silverInvestmentTotal,
          moduleBValue: dedicatedSilverTotal,
          recommendedSource: "silver_holdings",
          note: silverInvestmentTotal > 0 && dedicatedSilverTotal > 0
            ? "Potential duplicate exposure detected. Canonical source in month-end is dedicated silver holdings."
            : "No overlap detected from current module values.",
        },
        {
          label: "Sovereign Gold Bond overlap check",
          moduleA: "investment_holdings (Sovereign Gold Bonds)",
          moduleB: "gold_holdings",
          moduleAValue: sgbInvestmentTotal,
          moduleBValue: dedicatedGoldTotal,
          recommendedSource: "review manually",
          note: sgbInvestmentTotal > 0 && dedicatedGoldTotal > 0
            ? "SGB is instrument-level and may be intentionally separate from physical gold. Review to confirm no duplicate economic exposure."
            : "No overlap detected from current module values.",
        },
        {
          label: "Real estate duplicate exposure",
          moduleA: "assets (asset_type=real_estate)",
          moduleB: "real_estate_properties",
          moduleAValue: assetsRealEstateTotal,
          moduleBValue: dedicatedRealEstateTotal,
          recommendedSource: "real_estate_properties",
          note: assetsRealEstateTotal > 0 && dedicatedRealEstateTotal > 0
            ? "Legacy real_estate assets are excluded when dedicated real-estate properties exist."
            : "No overlap detected from current module values.",
        },
        {
          label: "Monthly review vs live values overlap check",
          moduleA: "month_end_close_items (workspace)",
          moduleB: "live module tables",
          moduleAValue: summary.actualKpis.netWorth,
          moduleBValue: summary.actualKpis.netWorth,
          recommendedSource: "month_end_close_items for Monthly Review metrics",
          note: "Monthly Review cards use workspace month_end_close_items values; live table updates feed these rows and are not added separately in KPI math.",
        },
      ],
      priorBaseline: {
        monthKey: priorClosedMonth?.monthKey ?? null,
        isAdjacent: priorClosedMonth ? isAdjacentPriorMonth : false,
      },
      netWorthBreakdown: {
        rows: netWorthBreakdownRows,
        renderedAssetTotal,
        renderedLiabilityTotal,
      },
      ignoredDuplicateWarnings,
    };
  }, [
    assets,
    completedSteps.expenses,
    goldHoldings,
    healthModel,
    investments,
    livingExpenseAmount,
    livingExpenseNotes,
    monthlyCash,
    realEstateProperties,
    retirementAccounts,
    silverHoldings,
    summary,
    liabilities,
    workspace,
  ]);

  const completedCount = useMemo(() => {
    return WORKFLOW_STEPS.reduce((count, step) => count + (completedSteps[step.key] ? 1 : 0), 0);
  }, [completedSteps]);

  const completionPercent = Math.round((completedCount / WORKFLOW_STEPS.length) * 100);

  const hasDedicatedRetirementAccounts = retirementAccounts.length > 0;
  const hasDedicatedGoldHoldings = goldHoldings.length > 0;
  const hasDedicatedSilverHoldings = silverHoldings.length > 0;

  const preferredOwner = useMemo(() => {
    const candidate = [
      ...retirementAccounts.map((item) => item.owner),
      ...goldHoldings.map((item) => item.owner),
      ...silverHoldings.map((item) => item.owner),
      ...bankAccounts.map((item) => item.owner),
    ].find((owner) => typeof owner === "string" && owner.trim().length > 0);

    return candidate?.trim() || "Household";
  }, [bankAccounts, goldHoldings, retirementAccounts, silverHoldings]);

  useEffect(() => {
    setNewGoldHoldingOwner(preferredOwner);
    setNewSilverHoldingOwner(preferredOwner);
  }, [preferredOwner]);

  const priorClosedGoldValue = useMemo(() => {
    return sumPersistedItemsByKey(latestClosedItems, "gold");
  }, [latestClosedItems]);

  const priorClosedSilverValue = useMemo(() => {
    return sumPersistedItemsByKey(latestClosedItems, "silver");
  }, [latestClosedItems]);

  const financialAssetInvestments = useMemo(() => {
    return investments.filter((item) => !isCanonicalExcludedInvestment({
      category: item.category,
      hasDedicatedRetirementAccounts,
      hasDedicatedGoldHoldings,
      hasDedicatedSilverHoldings,
    }));
  }, [hasDedicatedGoldHoldings, hasDedicatedRetirementAccounts, hasDedicatedSilverHoldings, investments]);

  const mutualFundInvestments = useMemo(() => {
    return financialAssetInvestments.filter((item) => item.category === "Mutual Funds");
  }, [financialAssetInvestments]);

  const stockInvestments = useMemo(() => {
    return financialAssetInvestments.filter((item) => item.category === "Stocks");
  }, [financialAssetInvestments]);

  const granularInvestments = useMemo(() => {
    return financialAssetInvestments.filter((item) => item.category !== "Mutual Funds" && item.category !== "Stocks");
  }, [financialAssetInvestments]);

  function markStepComplete(step: WorkflowStepKey) {
    setCompletedSteps((current) => ({ ...current, [step]: true }));
  }

  async function handleSaveFinancialAssets() {
    try {
      setSavingStep("financialAssets");
      setError(null);

      if (!workspace) {
        throw new Error("Monthly review workspace is unavailable.");
      }

      const investmentOverrides = buildMonthEndInvestmentActuals({
        investments: financialAssetInvestments,
        investmentValues,
        investmentSummaryValues,
      });

      const bankOverrideMap = new Map<string, number>(
        bankAccounts.map((item) => [item.id, toNumber(bankAccountValues[item.id] ?? String(item.current_balance ?? 0))]),
      );

      const overrides = new Map<string, number>();
      for (const [id, value] of investmentOverrides.entries()) {
        overrides.set(id, value);
      }
      for (const [id, value] of bankOverrideMap.entries()) {
        overrides.set(id, value);
      }

      const updatedItems = workspace.items.map((item) => {
        if (item.entityType !== "investment" && item.entityType !== "bank-account") {
          return item;
        }

        if (!overrides.has(item.entityId)) {
          return item;
        }

        const actualValue = overrides.get(item.entityId) ?? item.actualValue;
        const absoluteVariance = actualValue - item.projectedValue;
        const percentageVariance = item.projectedValue === 0 ? (actualValue === 0 ? 0 : null) : ((actualValue - item.projectedValue) / Math.abs(item.projectedValue)) * 100;

        return {
          ...item,
          actualValue,
          absoluteVariance,
          percentageVariance,
        };
      });

      logMonthlyReviewSaveAudit({
        action: "save-financial-assets",
        workspace,
        saveTarget: {
          path: "monthEndCloseService.saveDraft",
          closeId: workspace.close?.id ?? null,
          status: "draft",
          closeYear: workspace.month.year,
          closeMonth: workspace.month.month,
          meta: {
            itemCount: updatedItems.length,
            investmentItemCount: updatedItems.filter((item) => item.entityType === "investment").length,
            bankAccountItemCount: updatedItems.filter((item) => item.entityType === "bank-account").length,
          },
        },
      });

      const investmentUpdates = financialAssetInvestments
        .map((item) => ({
          id: item.id,
          nextValue: overrides.get(item.id) ?? Number(item.current_value ?? 0),
          changed: Math.abs((overrides.get(item.id) ?? Number(item.current_value ?? 0)) - Number(item.current_value ?? 0)) >= 0.01,
        }))
        .filter((item) => item.changed);

      const bankUpdates = bankAccounts
        .map((item) => ({
          id: item.id,
          nextValue: overrides.get(item.id) ?? Number(item.current_balance ?? 0),
          changed: Math.abs((overrides.get(item.id) ?? Number(item.current_balance ?? 0)) - Number(item.current_balance ?? 0)) >= 0.01,
        }))
        .filter((item) => item.changed);

      await Promise.all([
        ...investmentUpdates.map((item) => updateInvestment({ id: item.id, current_value: item.nextValue })),
        ...bankUpdates.map((item) => updateBankAccount({ id: item.id, current_balance: item.nextValue })),
      ]);

      await saveMonthEndCloseDraft({
        closeId: workspace.close?.id ?? null,
        closeMonth: workspace.month.month,
        closeYear: workspace.month.year,
        items: updatedItems.map((item) => ({
          entityId: item.entityId,
          entityType: item.entityType,
          entityName: item.entityName,
          key: item.key,
          label: item.label,
          itemType: item.itemType,
          sortOrder: item.sortOrder,
          openingValue: item.openingValue,
          projectedValue: item.projectedValue,
          actualValue: item.actualValue,
        })),
      });

      markStepComplete("financialAssets");
      setNotice("Financial asset balances captured for month-end reconciliation.");
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save financial asset values");
    } finally {
      setSavingStep(null);
    }
  }

  async function handleSaveRetirement() {
    try {
      setSavingStep("retirement");
      setError(null);
      setNotice(null);

      if (!workspace) {
        throw new Error("Monthly review workspace is unavailable.");
      }

      const allRetirementRows = retirementAccounts
        .map((item) => {
          const nextValue = toNumber(retirementValues[item.id] ?? String(item.current_balance ?? 0));
          return {
            id: item.id,
            accountType: item.account_type,
            nextValue,
            changed: Math.abs(nextValue - Number(item.current_balance ?? 0)) >= 0.01,
          };
        });
      const updates = allRetirementRows.filter((item) => item.changed);
      const retirementDraftItems = buildRetirementDraftItems({
        workspace,
        retirementAccounts,
        retirementValues,
      });
      const expectedRetirementState = buildRetirementExpectedState(retirementAccounts, retirementValues);

      logMonthlyReviewSaveAudit({
        action: "save-retirement",
        workspace,
        saveTarget: {
          path: "retirement.updateRetirementAccount",
          closeId: null,
          status: "n/a",
          closeYear: null,
          closeMonth: null,
          meta: {
            updateCount: updates.length,
            retirementAccountIds: updates.map((item) => item.id),
          },
        },
      });

      console.groupCollapsed("[MonthlyReviewAudit] retirement_draft_payload");
      console.table(
        retirementDraftItems
          .filter((item) => item.entityType === "retirement-account")
          .map((item) => ({
            entity_id: item.entityId,
            item_key: item.key,
            opening_value: item.openingValue,
            projected_value: item.projectedValue,
            actual_value: item.actualValue,
          })),
      );
      console.groupEnd();

      await Promise.all(updates.map((item) => updateRetirementAccount({ id: item.id, account_type: item.accountType, current_balance: item.nextValue })));

      await saveMonthEndCloseDraft({
        closeId: workspace.close?.id ?? null,
        closeMonth: workspace.month.month,
        closeYear: workspace.month.year,
        items: retirementDraftItems,
      });

      const reloadedWorkspace = await getMonthEndCloseWorkspace();
      const reloadedRetirementActuals = collectRetirementActuals(reloadedWorkspace.items);

      console.groupCollapsed("[MonthlyReviewAudit] retirement_reload_verification");
      console.table(
        Array.from(reloadedRetirementActuals.byEntityId.entries()).map(([entityId, row]) => ({
          entity_id: entityId,
          item_key: row.key,
          actual_value: row.actualValue,
        })),
      );
      console.info("[MonthlyReviewAudit] retirement_reload_totals", reloadedRetirementActuals.totalsByKey);
      console.groupEnd();

      if (!verifyRetirementWorkspaceSync({ expected: expectedRetirementState, items: reloadedWorkspace.items })) {
        throw new Error("Retirement balances could not be synced to month-end review.");
      }

      markStepComplete("retirement");
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
      setNotice("Retirement balances synced to month-end review.");
    } catch (saveError) {
      console.error("[MonthlyReviewAudit] retirement_sync_failed", saveError);
      setError("Retirement balances could not be synced to month-end review.");
    } finally {
      setSavingStep(null);
    }
  }

  async function handleSaveNonFinancialAssets() {
    try {
      setSavingStep("nonFinancial");
      setError(null);

      if (!workspace) {
        throw new Error("Monthly review workspace is unavailable.");
      }

      const assetUpdates = assets
        .map((item) => {
          const nextValue = toNumber(assetValues[item.id] ?? String(item.current_value ?? 0));
          return {
            id: item.id,
            nextValue,
            changed: Math.abs(nextValue - Number(item.current_value ?? 0)) >= 0.01,
          };
        })
        .filter((item) => item.changed);

      const goldUpdates = goldHoldings
        .map((item) => {
          const nextValue = toNumber(goldValues[item.id] ?? String(item.current_value ?? 0));
          return {
            id: item.id,
            nextValue,
            changed: Math.abs(nextValue - Number(item.current_value ?? 0)) >= 0.01,
          };
        })
        .filter((item) => item.changed);

      const silverUpdates = silverHoldings
        .map((item) => {
          const nextValue = toNumber(silverValues[item.id] ?? String(item.current_value ?? 0));
          return {
            id: item.id,
            nextValue,
            changed: Math.abs(nextValue - Number(item.current_value ?? 0)) >= 0.01,
          };
        })
        .filter((item) => item.changed);

      const propertyUpdates = realEstateProperties
        .map((item) => {
          const nextValue = toNumber(propertyValues[item.id] ?? String(item.current_market_value ?? 0));
          return {
            id: item.id,
            nextValue,
            changed: Math.abs(nextValue - Number(item.current_market_value ?? 0)) >= 0.01,
          };
        })
        .filter((item) => item.changed);

      const shouldCreateGoldHolding = showAddGoldForm && goldHoldings.length === 0;
      const shouldCreateSilverHolding = showAddSilverForm && silverHoldings.length === 0;

      logMonthlyReviewSaveAudit({
        action: "save-non-financial",
        workspace,
        saveTarget: {
          path: "assets/updateAsset + gold/silver/real-estate updates",
          closeId: null,
          status: "n/a",
          closeYear: null,
          closeMonth: null,
          meta: {
            assetUpdateCount: assetUpdates.length,
            goldUpdateCount: goldUpdates.length,
            silverUpdateCount: silverUpdates.length,
            propertyUpdateCount: propertyUpdates.length,
          },
        },
      });

      let createdGoldHolding: GoldHolding | null = null;
      let createdSilverHolding: SilverHolding | null = null;

      await Promise.all([
        ...assetUpdates.map((item) => updateAsset({ id: item.id, current_value: item.nextValue })),
        ...goldUpdates.map((item) => updateGoldHolding({ id: item.id, current_value: item.nextValue })),
        ...silverUpdates.map((item) => updateSilverHolding({ id: item.id, current_value: item.nextValue })),
        ...propertyUpdates.map((item) => updateRealEstateProperty({ id: item.id, current_market_value: item.nextValue })),
      ]);

      if (shouldCreateGoldHolding) {
        const value = toNumber(newGoldHoldingValue);
        createdGoldHolding = await createGoldHolding({
          holding_type: "Physical Gold",
          description: newGoldHoldingName.trim() || "Gold at home",
          quantity: 1,
          unit: "grams",
          cost_basis: value,
          current_value: value,
          owner: newGoldHoldingOwner.trim() || "Household",
        });
      }

      if (shouldCreateSilverHolding) {
        const value = toNumber(newSilverHoldingValue);
        createdSilverHolding = await createSilverHolding({
          holding_type: "Physical Silver",
          description: newSilverHoldingName.trim() || "Silver holding",
          quantity: 1,
          unit: "grams",
          cost_basis: value,
          current_value: value,
          owner: newSilverHoldingOwner.trim() || "Household",
        });
      }

      const assetOverrideMap = new Map<string, number>(assetUpdates.map((item) => [item.id, item.nextValue]));
      const goldOverrideMap = new Map<string, number>(goldUpdates.map((item) => [item.id, item.nextValue]));
      const silverOverrideMap = new Map<string, number>(silverUpdates.map((item) => [item.id, item.nextValue]));
      const propertyOverrideMap = new Map<string, number>(propertyUpdates.map((item) => [item.id, item.nextValue]));

      if (createdGoldHolding) {
        goldOverrideMap.set(createdGoldHolding.id, Number(createdGoldHolding.current_value ?? 0));
      }

      if (createdSilverHolding) {
        silverOverrideMap.set(createdSilverHolding.id, Number(createdSilverHolding.current_value ?? 0));
      }

      const workspaceForSave = (createdGoldHolding || createdSilverHolding) ? await getMonthEndCloseWorkspace() : workspace;

      const updatedItems = workspaceForSave.items.map((item) => {
        let override: number | null = null;

        if (item.entityType === "asset") {
          override = assetOverrideMap.get(item.entityId) ?? null;
        } else if (item.entityType === "gold-holding") {
          override = goldOverrideMap.get(item.entityId) ?? null;
        } else if (item.entityType === "silver-holding") {
          override = silverOverrideMap.get(item.entityId) ?? null;
        } else if (item.entityType === "real-estate-property") {
          override = propertyOverrideMap.get(item.entityId) ?? null;
        }

        if (override == null) {
          return item;
        }

        return {
          ...item,
          actualValue: override,
          absoluteVariance: override - item.projectedValue,
          percentageVariance: item.projectedValue === 0 ? (override === 0 ? 0 : null) : ((override - item.projectedValue) / Math.abs(item.projectedValue)) * 100,
        };
      });

      await saveMonthEndCloseDraft({
        closeId: workspaceForSave.close?.id ?? null,
        closeMonth: workspaceForSave.month.month,
        closeYear: workspaceForSave.month.year,
        items: updatedItems.map((item) => ({
          entityId: item.entityId,
          entityType: item.entityType,
          entityName: item.entityName,
          key: item.key,
          label: item.label,
          itemType: item.itemType,
          sortOrder: item.sortOrder,
          openingValue: item.openingValue,
          projectedValue: item.projectedValue,
          actualValue: item.actualValue,
        })),
      });

      markStepComplete("nonFinancial");
      setNotice("Non-financial asset values updated successfully.");
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save non-financial asset values");
    } finally {
      setSavingStep(null);
    }
  }

  async function handleSaveLiabilities() {
    try {
      setSavingStep("liabilities");
      setError(null);

      const updates = liabilities
        .map((item) => {
          const nextValue = toNumber(liabilityValues[item.id] ?? String(item.outstanding_amount ?? 0));
          return {
            id: item.id,
            nextValue,
            changed: Math.abs(nextValue - Number(item.outstanding_amount ?? 0)) >= 0.01,
          };
        })
        .filter((item) => item.changed);

      logMonthlyReviewSaveAudit({
        action: "save-liabilities",
        workspace,
        saveTarget: {
          path: "liabilities.updateLiability",
          closeId: null,
          status: "n/a",
          closeYear: null,
          closeMonth: null,
          meta: {
            updateCount: updates.length,
            liabilityIds: updates.map((item) => item.id),
          },
        },
      });

      await Promise.all(updates.map((item) => updateLiability({ id: item.id, outstanding_amount: item.nextValue })));

      markStepComplete("liabilities");
      setNotice(`Liability balances ${updates.length > 0 ? "updated" : "reviewed"} successfully.`);
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save liabilities");
    } finally {
      setSavingStep(null);
    }
  }

  async function handleSaveExpenses() {
    try {
      setSavingStep("expenses");
      setError(null);

      logMonthlyReviewSaveAudit({
        action: "save-living-expenses",
        workspace,
        saveTarget: {
          path: "cashFlowManagementService.upsertLivingExpense",
          closeId: null,
          status: "n/a",
          closeYear: null,
          closeMonth: null,
          meta: {
            monthlyAmount: Math.max(0, toNumber(livingExpenseAmount)),
          },
        },
      });

      await cashFlowManagementService.upsertLivingExpense({
        monthlyAmount: Math.max(0, toNumber(livingExpenseAmount)),
        notes: livingExpenseNotes.trim() || null,
        status: "Active",
      });

      markStepComplete("expenses");
      setNotice("Living expenses updated successfully.");
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save living expenses");
    } finally {
      setSavingStep(null);
    }
  }

  async function handleReopenMonth() {
    if (!workspace?.latestClose?.id) {
      return;
    }

    const trimmedReason = reopenReason.trim();
    if (!trimmedReason) {
      setError("A reason is required to reopen the month.");
      return;
    }

    try {
      setReopeningMonth(true);
      setError(null);
      await reopenMonth({ closeId: workspace.latestClose.id, reason: trimmedReason });
      setReopenDialogOpen(false);
      setReopenReason("");
      setNotice(`${latestClosedMonthLabel ?? "Latest closed month"} has been reopened for corrections.`);
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
    } catch (reopenError) {
      setError(reopenError instanceof Error ? reopenError.message : "Unable to reopen month");
    } finally {
      setReopeningMonth(false);
    }
  }

  async function handleCloseMonth() {
    if (!workspace) {
      return;
    }

    const requiredSteps: WorkflowStepKey[] = ["compensation", "financialAssets", "retirement", "nonFinancial", "liabilities", "summary"];
    const incompleteStep = requiredSteps.find((step) => !completedSteps[step]);

    if (incompleteStep) {
      const pendingLabel = WORKFLOW_STEPS.find((step) => step.key === incompleteStep)?.title ?? incompleteStep;
      setError(`Complete required workflow steps before closing. Pending required step: ${pendingLabel}.`);
      return;
    }

    if (!closeConfirmed) {
      setError("Confirm month close readiness before closing the month.");
      return;
    }

    try {
      setClosingMonth(true);
      setError(null);

      const latestWorkspace = await getMonthEndCloseWorkspace();
      const closedLabel = latestWorkspace.month.label;

      await closeMonthEndClose({
        closeId: latestWorkspace.close?.id ?? null,
        closeMonth: latestWorkspace.month.month,
        closeYear: latestWorkspace.month.year,
        items: latestWorkspace.items.map((item) => ({
          entityId: item.entityId,
          entityType: item.entityType,
          entityName: item.entityName,
          key: item.key,
          label: item.label,
          itemType: item.itemType,
          sortOrder: item.sortOrder,
          openingValue: item.openingValue,
          projectedValue: item.projectedValue,
          actualValue: item.actualValue,
        })),
      });

      await closeCurrentMonthSnapshot().catch(() => null);

      const projectionRefreshScenario: ProjectionScenario = {
        id: DEFAULT_SCENARIO_KEY,
        name: "Monthly Review Refresh",
        description: "Refresh projection inputs after month close.",
        startMonth: latestWorkspace.month.monthKey,
        planningHorizonYear: latestWorkspace.month.year,
        assumptions: [],
        events: [],
        isDefault: true,
      };

      await Promise.all([
        cashFlowManagementService.getCashFlowSnapshot().catch(() => null),
        getRetirementAccounts().catch(() => []),
        projectionInputService.buildContext({
          scenario: projectionRefreshScenario,
          startSource: { kind: "latest-closed-month-end" },
        }).catch(() => null),
      ]);

      markStepComplete("close");
      setCloseConfirmed(false);
      setNotice(`Month closed for ${closedLabel}. Dashboard, Cash Flow, Retirement, and Projection inputs refreshed.`);
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Unable to close month");
    } finally {
      setClosingMonth(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Monthly Review Workspace"
            description="Complete monthly balance sheet review workflow for compensation, assets, liabilities, summary, and month close."
            summary={workspace ? `Pending close period: ${workspace.month.label}` : undefined}
          />
          <DashboardCard className="w-full max-w-sm p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span className="font-medium">Completion Progress</span>
              <span>{completedCount}/{WORKFLOW_STEPS.length}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-slate-900 transition-all" style={{ width: `${completionPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{completionPercent}% complete</p>
          </DashboardCard>
        </div>

        {!loading && workspace?.latestClose?.id && latestClosedMonthLabel ? (
          <DashboardCard className="border-amber-200 bg-amber-50/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-amber-900">Latest closed month: {latestClosedMonthLabel}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReopenReason("");
                  setReopenDialogOpen(true);
                }}
                disabled={reopeningMonth}
              >
                Reopen {latestClosedMonthLabel}
              </Button>
            </div>
          </DashboardCard>
        ) : null}

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {mappingWarning ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{mappingWarning}</div> : null}
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        {loading ? <LoadingSpinner label="Preparing monthly review workspace..." /> : null}

        {!loading && !workspace ? (
          <DashboardCard>
            <p className="text-sm text-slate-600">Monthly review workspace is not available.</p>
          </DashboardCard>
        ) : null}

        {!loading && workspace ? (
          <div className="space-y-6">
            <DashboardCard>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {WORKFLOW_STEPS.map((step, index) => (
                  <div key={step.key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center gap-2">
                      {completedSteps[step.key] ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-400" />
                      )}
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Step {index + 1}</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{step.description}</p>
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Wallet className="h-4 w-4" />
                    <h3 className="text-base font-semibold text-slate-900">1. Compensation Review</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Review the monthly compensation feed that powers cash flow and projection assumptions.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => markStepComplete("compensation")}>Mark Reviewed</Button>
              </div>
              {compensationSummary ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Employer</p>
                    <p className="text-sm font-medium text-slate-900">{compensationSummary.profile.employer || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Net Monthly Salary</p>
                    <p className="text-sm font-medium text-slate-900">{formatCurrency(compensationSummary.netMonthlySalary, { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Monthly Bonus Equivalent</p>
                    <p className="text-sm font-medium text-slate-900">{formatCurrency(compensationSummary.monthlyBonusEquivalent, { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Effective Month</p>
                    <p className="text-sm font-medium text-slate-900">{compensationSummary.profile.effectiveMonth}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No compensation profile found yet.</p>
              )}
              <Link href="/compensation" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
                Open full compensation workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Projection Comparison</h3>
                {projectionComparison ? <p className="text-xs text-slate-500">Review Month: {projectionComparison.reviewMonth}</p> : null}
              </div>

              {!projectionComparison || !projectionComparison.actualAvailable ? (
                <p className="mt-3 text-sm text-slate-500">Data required. Close a month to compare Fixed Plan, Rolling Forecast, and Actual values.</p>
              ) : (
                <>
                  {(!projectionComparison.fixedPlanAvailable || !projectionComparison.rollingPlanAvailable) ? (
                    <p className="mt-3 text-sm text-amber-700">
                      Data required: {!projectionComparison.fixedPlanAvailable ? "Fixed Plan" : ""}
                      {!projectionComparison.fixedPlanAvailable && !projectionComparison.rollingPlanAvailable ? " and " : ""}
                      {!projectionComparison.rollingPlanAvailable ? "Rolling Forecast" : ""}.
                    </p>
                  ) : null}

                  <div className="mt-4 hidden overflow-x-auto md:block">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Fixed Plan</th>
                          <th className="px-3 py-2">Rolling Forecast</th>
                          <th className="px-3 py-2">Actual</th>
                          <th className="px-3 py-2">Var vs Fixed</th>
                          <th className="px-3 py-2">Var vs Rolling</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectionComparison.rows.map((row) => (
                          <tr key={row.line_key} className="border-b border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                            <td className="px-3 py-2 text-slate-700">{formatValueOrDataRequired(row.fixed_value)}</td>
                            <td className="px-3 py-2 text-slate-700">{formatValueOrDataRequired(row.rolling_value)}</td>
                            <td className="px-3 py-2 text-slate-900">{formatValueOrDataRequired(row.actual_value)}</td>
                            <td className={`px-3 py-2 ${row.variance_vs_fixed == null ? "text-slate-500" : tone(row.variance_vs_fixed)}`}>
                              {formatValueOrDataRequired(row.variance_vs_fixed)}
                            </td>
                            <td className={`px-3 py-2 ${row.variance_vs_rolling == null ? "text-slate-500" : tone(row.variance_vs_rolling)}`}>
                              {formatValueOrDataRequired(row.variance_vs_rolling)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 space-y-3 md:hidden">
                    {projectionComparison.rows.map((row) => (
                      <div key={row.line_key} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <span className="text-slate-500">Fixed Plan</span>
                          <span className="text-right text-slate-700">{formatValueOrDataRequired(row.fixed_value)}</span>
                          <span className="text-slate-500">Rolling Forecast</span>
                          <span className="text-right text-slate-700">{formatValueOrDataRequired(row.rolling_value)}</span>
                          <span className="text-slate-500">Actual</span>
                          <span className="text-right text-slate-900">{formatValueOrDataRequired(row.actual_value)}</span>
                          <span className="text-slate-500">Var vs Fixed</span>
                          <span className={`text-right ${row.variance_vs_fixed == null ? "text-slate-500" : tone(row.variance_vs_fixed)}`}>
                            {formatValueOrDataRequired(row.variance_vs_fixed)}
                          </span>
                          <span className="text-slate-500">Var vs Rolling</span>
                          <span className={`text-right ${row.variance_vs_rolling == null ? "text-slate-500" : tone(row.variance_vs_rolling)}`}>
                            {formatValueOrDataRequired(row.variance_vs_rolling)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <PiggyBank className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-slate-900">2. Financial Asset Updates</h3>
                </div>
                <Button type="button" onClick={() => void handleSaveFinancialAssets()} disabled={savingStep === "financialAssets"}>
                  {savingStep === "financialAssets" ? "Saving..." : "Save Financial Asset Updates"}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {bankAccounts.length === 0 && financialAssetInvestments.length === 0 ? <p className="text-sm text-slate-500">No financial assets available.</p> : null}

                {bankAccounts.length > 0 ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bank Accounts</p>
                    {bankAccounts.map((item) => (
                      <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.account_name}</p>
                          <p className="text-xs text-slate-500">{item.bank}</p>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          aria-label={`Bank balance ${item.account_name}`}
                          value={bankAccountValues[item.id] ?? "0"}
                          onChange={(event) => setBankAccountValues((current) => ({ ...current, [item.id]: event.target.value }))}
                        />
                      </div>
                    ))}
                  </>
                ) : null}

                {financialAssetInvestments.length > 0 ? <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investments</p> : null}

                {mutualFundInvestments.length > 0 ? (
                  <div className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Total Mutual Fund Value</p>
                      <p className="text-xs text-slate-500">Aggregated across {mutualFundInvestments.length} mutual fund entr{mutualFundInvestments.length === 1 ? "y" : "ies"}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      aria-label="Mutual Funds Total"
                      value={investmentSummaryValues.mutualFundsTotal}
                      onChange={(event) => setInvestmentSummaryValues((current) => ({ ...current, mutualFundsTotal: event.target.value }))}
                    />
                  </div>
                ) : null}

                {stockInvestments.length > 0 ? (
                  <div className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Total Stock Portfolio Value</p>
                      <p className="text-xs text-slate-500">Aggregated across {stockInvestments.length} stock entr{stockInvestments.length === 1 ? "y" : "ies"}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      aria-label="Stocks Total"
                      value={investmentSummaryValues.stocksTotal}
                      onChange={(event) => setInvestmentSummaryValues((current) => ({ ...current, stocksTotal: event.target.value }))}
                    />
                  </div>
                ) : null}

                {granularInvestments.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.investment_name}</p>
                      <p className="text-xs text-slate-500">{item.category}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      aria-label={`Investment value ${item.investment_name}`}
                      value={investmentValues[item.id] ?? "0"}
                      onChange={(event) => setInvestmentValues((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Landmark className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-slate-900">3. Retirement Account Updates</h3>
                </div>
                <Button type="button" onClick={() => void handleSaveRetirement()} disabled={savingStep === "retirement"}>
                  {savingStep === "retirement" ? "Saving..." : "Save Retirement Updates"}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {retirementAccounts.length === 0 ? <p className="text-sm text-slate-500">No retirement accounts available.</p> : null}
                {retirementAccounts.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.account_type} - {item.institution}</p>
                      <p className="text-xs text-slate-500">Owner: {item.owner}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      aria-label={`Retirement balance ${item.account_type} ${item.institution}`}
                      value={retirementValues[item.id] ?? "0"}
                      onChange={(event) => setRetirementValues((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Scale className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-slate-900">4. Non-Financial Asset Updates</h3>
                </div>
                <Button type="button" onClick={() => void handleSaveNonFinancialAssets()} disabled={savingStep === "nonFinancial"}>
                  {savingStep === "nonFinancial" ? "Saving..." : "Save Non-Financial Asset Updates"}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {realEstateProperties.length === 0 && goldHoldings.length === 0 && silverHoldings.length === 0 && assets.length === 0 ? (
                  <p className="text-sm text-slate-500">No non-financial assets available.</p>
                ) : null}

                {realEstateProperties.length > 0 ? <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Real Estate</p> : null}
                {realEstateProperties.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.property_name}</p>
                      <p className="text-xs text-slate-500">{item.city}, {item.state}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      aria-label={`Property value ${item.property_name}`}
                      value={propertyValues[item.id] ?? "0"}
                      onChange={(event) => setPropertyValues((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                ))}

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gold</p>
                {goldHoldings.length === 0 ? (
                  <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-slate-600">No gold holdings available.</p>
                    {priorClosedGoldValue > 0 ? (
                      <p className="text-xs text-amber-700">
                        Prior closed month includes {formatCurrency(priorClosedGoldValue, { maximumFractionDigits: 0 })} for gold. Create a holding from prior close to keep canonical month-end values in sync.
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => setShowAddGoldForm((current) => !current)}>
                        {showAddGoldForm ? "Cancel" : "Add Gold Holding"}
                      </Button>
                      {priorClosedGoldValue > 0 ? (
                        <Button
                          type="button"
                          onClick={() => {
                            setShowAddGoldForm(true);
                            setNewGoldHoldingName("Gold at home");
                            setNewGoldHoldingOwner(preferredOwner);
                            setNewGoldHoldingValue(String(priorClosedGoldValue));
                          }}
                        >
                          Create holding from prior close
                        </Button>
                      ) : null}
                    </div>
                    {showAddGoldForm ? (
                      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-3">
                        <Input
                          aria-label="New gold holding name"
                          value={newGoldHoldingName}
                          onChange={(event) => setNewGoldHoldingName(event.target.value)}
                          placeholder="Gold at home"
                        />
                        <Input
                          aria-label="New gold holding owner"
                          value={newGoldHoldingOwner}
                          onChange={(event) => setNewGoldHoldingOwner(event.target.value)}
                          placeholder="Owner"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          aria-label="New gold holding value"
                          value={newGoldHoldingValue}
                          onChange={(event) => setNewGoldHoldingValue(event.target.value)}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {goldHoldings.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.description}</p>
                      <p className="text-xs text-slate-500">{item.holding_type}</p>
                      <p className="text-xs text-slate-500">Owner: {item.owner ?? "Not set"}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      aria-label={`Gold value ${item.description}`}
                      value={goldValues[item.id] ?? "0"}
                      onChange={(event) => setGoldValues((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                ))}

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Silver</p>
                {silverHoldings.length === 0 ? (
                  <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-slate-600">No silver holdings available.</p>
                    {priorClosedSilverValue > 0 ? (
                      <p className="text-xs text-amber-700">
                        Prior closed month includes {formatCurrency(priorClosedSilverValue, { maximumFractionDigits: 0 })} for silver. Create a holding from prior close to keep canonical month-end values in sync.
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => setShowAddSilverForm((current) => !current)}>
                        {showAddSilverForm ? "Cancel" : "Add Silver Holding"}
                      </Button>
                      {priorClosedSilverValue > 0 ? (
                        <Button
                          type="button"
                          onClick={() => {
                            setShowAddSilverForm(true);
                            setNewSilverHoldingName("Silver holding");
                            setNewSilverHoldingOwner(preferredOwner);
                            setNewSilverHoldingValue(String(priorClosedSilverValue));
                          }}
                        >
                          Create holding from prior close
                        </Button>
                      ) : null}
                    </div>
                    {showAddSilverForm ? (
                      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-3">
                        <Input
                          aria-label="New silver holding name"
                          value={newSilverHoldingName}
                          onChange={(event) => setNewSilverHoldingName(event.target.value)}
                          placeholder="Silver holding"
                        />
                        <Input
                          aria-label="New silver holding owner"
                          value={newSilverHoldingOwner}
                          onChange={(event) => setNewSilverHoldingOwner(event.target.value)}
                          placeholder="Owner"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          aria-label="New silver holding value"
                          value={newSilverHoldingValue}
                          onChange={(event) => setNewSilverHoldingValue(event.target.value)}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {silverHoldings.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.description}</p>
                      <p className="text-xs text-slate-500">{item.holding_type}</p>
                      <p className="text-xs text-slate-500">Owner: {item.owner ?? "Not set"}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      aria-label={`Silver value ${item.description}`}
                      value={silverValues[item.id] ?? "0"}
                      onChange={(event) => setSilverValues((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                ))}

                {assets.length > 0 ? <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Other Assets</p> : null}
                {assets.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.asset_name}</p>
                      <p className="text-xs text-slate-500">{item.asset_type}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      aria-label={`Asset value ${item.asset_name}`}
                      value={assetValues[item.id] ?? "0"}
                      onChange={(event) => setAssetValues((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Scale className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-slate-900">5. Liability Updates</h3>
                </div>
                <Button type="button" onClick={() => void handleSaveLiabilities()} disabled={savingStep === "liabilities"}>
                  {savingStep === "liabilities" ? "Saving..." : "Save Liability Updates"}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {liabilities.length === 0 ? <p className="text-sm text-slate-500">No liabilities available.</p> : null}
                {liabilities.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.account_name}</p>
                      <p className="text-xs text-slate-500">{item.liability_type}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      aria-label={`Liability value ${item.account_name}`}
                      value={liabilityValues[item.id] ?? "0"}
                      onChange={(event) => setLiabilityValues((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <ClipboardCheck className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-slate-900">6. Living Expenses (OPTIONAL)</h3>
                </div>
                <Button type="button" onClick={() => void handleSaveExpenses()} disabled={savingStep === "expenses"}>
                  {savingStep === "expenses" ? "Saving..." : "Save Living Expenses"}
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Monthly Living Expense</label>
                  <Input type="number" step="0.01" value={livingExpenseAmount} onChange={(event) => setLivingExpenseAmount(event.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Notes</label>
                  <Input value={livingExpenseNotes} onChange={(event) => setLivingExpenseNotes(event.target.value)} placeholder="Optional context" />
                </div>
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Sparkles className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-slate-900">7. Financial Summary</h3>
                </div>
                <Button type="button" variant="outline" onClick={() => markStepComplete("summary")}>Mark Summary Reviewed</Button>
              </div>

              {summary && healthModel ? (
                <div className="mt-4 space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Net Worth</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(summary.actualKpis.netWorth, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Projection Variance</p>
                      <p className={`mt-1 text-lg font-semibold ${tone(summary.projectionVariance)}`}>{formatCurrency(summary.projectionVariance, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Month-over-Month Change</p>
                      <p className={`mt-1 text-lg font-semibold ${nullableTone(workspace.dashboard.monthOverMonthChange)}`}>{formatValueOrNotAvailable(workspace.dashboard.monthOverMonthChange)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Financial Health Score</p>
                      <p className={`mt-1 text-lg font-semibold ${scoreTone(healthModel.score)}`}>{healthModel.score}/100</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Savings Rate</p>
                      <p className={`mt-1 text-sm font-semibold ${tone(healthModel.savingsRate)}`}>{formatPercent(healthModel.savingsRate, { digits: 1, multiply: true })}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Debt to Asset Ratio</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatPercent(healthModel.debtToAssetRatio, { digits: 1, multiply: true })}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Variance Ratio</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatPercent(healthModel.projectionVarianceRatio, { digits: 1, multiply: true })}</p>
                    </div>
                  </div>

                  {financialSummaryAudit ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-sm font-semibold text-slate-900">Net Worth Breakdown (Canonical Sources)</p>
                      <p className="mt-1 text-xs text-slate-600">Exact formula: Net Worth = Total Assets - Total Liabilities (from month_end_close_items canonical buckets).</p>
                      <div className="mt-3 hidden overflow-x-auto md:block">
                        <table className="min-w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                              <th className="px-2 py-2">Bucket</th>
                              <th className="px-2 py-2">Amount Used</th>
                              <th className="px-2 py-2">Source Module/Table</th>
                              <th className="px-2 py-2">Canonical Applied</th>
                              <th className="px-2 py-2">Duplicate Ignored</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financialSummaryAudit.netWorthBreakdown.rows.map((row) => (
                              <tr key={row.label} className="border-b border-slate-100 align-top">
                                <td className="px-2 py-2 font-medium text-slate-900">{row.label}</td>
                                <td className="px-2 py-2 text-slate-900">{formatCurrency(row.amount, { maximumFractionDigits: 0 })}</td>
                                <td className="px-2 py-2 text-slate-700">{row.source}</td>
                                <td className="px-2 py-2 text-slate-700">{row.canonicalSourceApplied ? "Yes" : "No"}</td>
                                <td className="px-2 py-2 text-slate-700">{row.duplicateSourcesIgnored ? "Yes" : "No"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 space-y-2 md:hidden">
                        {financialSummaryAudit.netWorthBreakdown.rows.map((row) => (
                          <div key={row.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <p className="text-sm font-medium text-slate-900">{row.label}</p>
                            <p className="text-xs text-slate-700">Amount used: {formatCurrency(row.amount, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs text-slate-600">Source: {row.source}</p>
                            <p className="text-xs text-slate-600">Canonical applied: {row.canonicalSourceApplied ? "Yes" : "No"}</p>
                            <p className="text-xs text-slate-600">Duplicate ignored: {row.duplicateSourcesIgnored ? "Yes" : "No"}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                        <p>Rendered asset bucket sum: {formatCurrency(financialSummaryAudit.netWorthBreakdown.renderedAssetTotal, { maximumFractionDigits: 0 })}</p>
                        <p>Rendered liability bucket sum: {formatCurrency(financialSummaryAudit.netWorthBreakdown.renderedLiabilityTotal, { maximumFractionDigits: 0 })}</p>
                        <p>Net Worth check: {formatCurrency(summary.actualKpis.totalAssets, { maximumFractionDigits: 0 })} - {formatCurrency(summary.actualKpis.totalLiabilities, { maximumFractionDigits: 0 })} = {formatCurrency(summary.actualKpis.netWorth, { maximumFractionDigits: 0 })}</p>
                      </div>
                      {financialSummaryAudit.ignoredDuplicateWarnings.length > 0 ? (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-sm font-medium text-amber-800">Ignored Duplicate Sources</p>
                          <div className="mt-1 space-y-1">
                            {financialSummaryAudit.ignoredDuplicateWarnings.map((warning) => (
                              <p key={warning} className="text-xs text-amber-800">{warning}</p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-3 flex items-center gap-2 text-slate-700">
                      <Compass className="h-4 w-4" />
                      <p className="text-sm font-semibold">Auto-Generated Monthly Insights</p>
                    </div>
                    <div className="space-y-2">
                      {monthlyInsights.map((item) => (
                        <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className={`mt-1 text-sm ${item.tone === "positive" ? "text-emerald-700" : item.tone === "warning" ? "text-amber-700" : "text-slate-600"}`}>{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {financialSummaryAudit ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-sm font-semibold text-slate-900">Financial Summary Audit</p>
                      <div className="mt-3 hidden overflow-x-auto md:block">
                        <table className="min-w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                              <th className="px-2 py-2">Metric</th>
                              <th className="px-2 py-2">Formula</th>
                              <th className="px-2 py-2">Sources</th>
                              <th className="px-2 py-2">Source Records</th>
                              <th className="px-2 py-2">Substituted Values</th>
                              <th className="px-2 py-2">Expected</th>
                              <th className="px-2 py-2">Displayed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financialSummaryAudit.rows.map((row) => (
                              <tr key={row.metric} className="border-b border-slate-100 align-top">
                                <td className="px-2 py-2 font-medium text-slate-900">{row.metric}</td>
                                <td className="px-2 py-2 text-slate-700">{row.formula}</td>
                                <td className="px-2 py-2 text-slate-700">{row.sources}</td>
                                <td className="px-2 py-2 text-slate-700">{row.sourceRecords}</td>
                                <td className="px-2 py-2 text-slate-700">{row.substituted}</td>
                                <td className="px-2 py-2 text-slate-900">{row.expected}</td>
                                <td className="px-2 py-2 text-slate-900">{row.displayed}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-semibold text-slate-900">Potential Duplicate Exposure</p>
                        {financialSummaryAudit.priorBaseline.monthKey ? (
                          <p className={`text-xs ${financialSummaryAudit.priorBaseline.isAdjacent ? "text-slate-600" : "text-amber-700"}`}>
                            Prior closed month used for MoM: {financialSummaryAudit.priorBaseline.monthKey}
                            {financialSummaryAudit.priorBaseline.isAdjacent ? "" : " (non-adjacent baseline)"}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-700">No prior closed month available for MoM baseline.</p>
                        )}
                        {financialSummaryAudit.overlapChecks.map((check) => (
                          <div key={check.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <p className="text-sm font-medium text-slate-900">{check.label}</p>
                            <p className="text-xs text-slate-600">
                              {check.moduleA}: {formatCurrency(check.moduleAValue, { maximumFractionDigits: 0 })}
                            </p>
                            <p className="text-xs text-slate-600">
                              {check.moduleB}: {formatCurrency(check.moduleBValue, { maximumFractionDigits: 0 })}
                            </p>
                            <p className="text-xs text-slate-600">Recommended canonical source: {check.recommendedSource}</p>
                            <p className="text-xs text-slate-700">{check.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Financial summary will appear once the workspace is loaded.</p>
              )}
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-slate-900">8. Month Close Confirmation</h3>
                </div>
                <div className="flex items-center gap-2">
                  {workspace.latestClose?.id && latestClosedMonthLabel ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setReopenReason(""); setReopenDialogOpen(true); }}
                      disabled={reopeningMonth}
                    >
                      Reopen {latestClosedMonthLabel}
                    </Button>
                  ) : null}
                  <Button type="button" onClick={() => void handleCloseMonth()} disabled={closingMonth || workspace.status === "closed"}>
                    {closingMonth ? "Closing Month..." : workspace.status === "closed" ? "Month Closed" : "Close Month"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                {WORKFLOW_STEPS.filter((step) => step.key !== "close").map((step) => (
                  <div key={step.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <span className="text-slate-700">{step.title}</span>
                    <span className={completedSteps[step.key] ? "text-emerald-700" : "text-amber-700"}>
                      {completedSteps[step.key] ? "Complete" : step.key === "expenses" ? "Optional" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  checked={closeConfirmed}
                  onChange={(event) => setCloseConfirmed(event.target.checked)}
                  disabled={workspace.status === "closed"}
                />
                <span>
                  I confirm this month is ready to close. Closing will validate completion, create the month snapshot, and refresh Dashboard, Cash Flow, Retirement, and Projection inputs.
                </span>
              </label>
            </DashboardCard>
          </div>
        ) : null}
      </PageContainer>

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen {latestClosedMonthLabel ?? "Latest Closed Month"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Reason for reopening</label>
              <Input
                value={reopenReason}
                onChange={(event) => setReopenReason(event.target.value)}
                placeholder="Enter reason"
                disabled={reopeningMonth}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReopenDialogOpen(false)} disabled={reopeningMonth}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleReopenMonth()} disabled={reopeningMonth || !reopenReason.trim()}>
                {reopeningMonth ? "Reopening..." : "Reopen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
