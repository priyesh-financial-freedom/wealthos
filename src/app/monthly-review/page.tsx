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
import { cashFlowManagementService } from "@/services/cashFlowManagement";
import { compensationService, type CompensationSummary } from "@/services/compensation";
import { getInvestments } from "@/services/investments";
import { getLiabilities, updateLiability } from "@/services/liabilities";
import { closeMonthEndClose, getMonthEndCloseWorkspace, reopenMonth, saveMonthEndCloseDraft } from "@/services/monthEndClose";
import { calculateMonthEndCloseVarianceSummary } from "@/services/monthEndClose/MonthEndCloseService";
import { buildInvestmentValueMap } from "./investmentValueMap";
import { monthlyReviewComparisonService, projectionInputService, type ProjectionComparisonRow } from "@/services/projection";
import { getRetirementAccounts } from "@/services/retirement";
import { closeCurrentMonthSnapshot } from "@/services/monthlySnapshots";
import type { Asset } from "@/types/asset";
import type { Investment } from "@/types/investment";
import type { Liability } from "@/types/liability";
import type { MonthEndCloseWorkspace } from "@/types/monthEndClose";
import type { ProjectionScenario } from "@/types/projection";
import { formatCurrency, formatPercent } from "@/lib/formatters";

type WorkflowStepKey =
  | "compensation"
  | "investments"
  | "assets"
  | "loans"
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

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    key: "compensation",
    title: "Compensation Review",
    description: "Confirm salary and deduction assumptions that feed monthly cash flow.",
  },
  {
    key: "investments",
    title: "Investment Value Updates",
    description: "Update current values for mutual funds, stocks, FDs, ESOPs, and alternatives.",
  },
  {
    key: "assets",
    title: "Asset Value Updates",
    description: "Refresh non-investment assets such as real estate, cash-like assets, and other holdings.",
  },
  {
    key: "loans",
    title: "Loan Balance Updates",
    description: "Update outstanding principal balances across all liabilities.",
  },
  {
    key: "expenses",
    title: "Living Expenses",
    description: "Capture this month’s living expense run-rate used by cash flow and projections.",
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

function formatValueOrDataRequired(value: number | null) {
  if (value == null) {
    return "Data required";
  }

  return formatCurrency(value, { maximumFractionDigits: 0 });
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
  monthOverMonthChange: number;
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

  if (params.monthOverMonthChange >= 0) {
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

export default function MonthlyReviewPage() {
  const [workspace, setWorkspace] = useState<MonthEndCloseWorkspace | null>(null);
  const [compensationSummary, setCompensationSummary] = useState<CompensationSummary | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [livingExpenseAmount, setLivingExpenseAmount] = useState<string>("0");
  const [livingExpenseNotes, setLivingExpenseNotes] = useState<string>("");

  const [investmentValues, setInvestmentValues] = useState<Record<string, string>>({});
  const [investmentSummaryValues, setInvestmentSummaryValues] = useState<{
    mutualFundsTotal: string;
    stocksTotal: string;
  }>({
    mutualFundsTotal: "0",
    stocksTotal: "0",
  });
  const [assetValues, setAssetValues] = useState<Record<string, string>>({});
  const [loanValues, setLoanValues] = useState<Record<string, string>>({});

  const [completedSteps, setCompletedSteps] = useState<Record<WorkflowStepKey, boolean>>({
    compensation: false,
    investments: false,
    assets: false,
    loans: false,
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
    investmentRows: Investment[];
    assetRows: Asset[];
    liabilityRows: Liability[];
    cashSnapshot: Awaited<ReturnType<typeof cashFlowManagementService.getCashFlowSnapshot>> | null;
  }) {
    setWorkspace(params.monthWorkspace);
    setCompensationSummary(params.summary);
    setInvestments(params.investmentRows);
    setAssets(params.assetRows);
    setLiabilities(params.liabilityRows);
    setLivingExpenseAmount(String(params.cashSnapshot?.livingExpense.monthlyAmount ?? 0));
    setLivingExpenseNotes(params.cashSnapshot?.livingExpense.notes ?? "");

    const investmentValueMap = buildInvestmentValueMap(params.monthWorkspace, params.investmentRows);
    setInvestmentValues(investmentValueMap.valuesById);
    setMappingWarning(investmentValueMap.warningMessage);
    setInvestmentSummaryValues({
      mutualFundsTotal: String(sumValueMapByCategory(params.investmentRows, investmentValueMap.valuesById, "Mutual Funds")),
      stocksTotal: String(sumValueMapByCategory(params.investmentRows, investmentValueMap.valuesById, "Stocks")),
    });
    setAssetValues(params.assetRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(item.current_value ?? 0);
      return acc;
    }, {}));
    setLoanValues(params.liabilityRows.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = String(item.outstanding_amount ?? 0);
      return acc;
    }, {}));
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

      const [monthWorkspace, summary, investmentRows, assetRows, liabilityRows, cashSnapshot] = await Promise.all([
        getMonthEndCloseWorkspace(),
        compensationService.getSummary().catch(() => null),
        getInvestments(),
        getAssets(),
        getLiabilities(),
        cashFlowManagementService.getCashFlowSnapshot().catch(() => null),
      ]);

      applyLoadedWorkspaceData({
        monthWorkspace,
        summary,
        investmentRows,
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

        const [monthWorkspace, summary, investmentRows, assetRows, liabilityRows, cashSnapshot] = await Promise.all([
          getMonthEndCloseWorkspace(),
          compensationService.getSummary().catch(() => null),
          getInvestments(),
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
          investmentRows,
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

  const completedCount = useMemo(() => {
    return WORKFLOW_STEPS.reduce((count, step) => count + (completedSteps[step.key] ? 1 : 0), 0);
  }, [completedSteps]);

  const completionPercent = Math.round((completedCount / WORKFLOW_STEPS.length) * 100);

  const mutualFundInvestments = useMemo(() => {
    return investments.filter((item) => item.category === "Mutual Funds");
  }, [investments]);

  const stockInvestments = useMemo(() => {
    return investments.filter((item) => item.category === "Stocks");
  }, [investments]);

  const granularInvestments = useMemo(() => {
    return investments.filter((item) => item.category !== "Mutual Funds" && item.category !== "Stocks");
  }, [investments]);

  function markStepComplete(step: WorkflowStepKey) {
    setCompletedSteps((current) => ({ ...current, [step]: true }));
  }

  async function handleSaveInvestments() {
    try {
      setSavingStep("investments");
      setError(null);

      if (!workspace) {
        throw new Error("Monthly review workspace is unavailable.");
      }

      const overrides = buildMonthEndInvestmentActuals({
        investments,
        investmentValues,
        investmentSummaryValues,
      });

      const updatedItems = workspace.items.map((item) => {
        if (item.entityType !== "investment") {
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

      markStepComplete("investments");
      setNotice("Monthly Review investment balances captured for month-end reconciliation.");
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save investment values");
    } finally {
      setSavingStep(null);
    }
  }

  async function handleSaveAssets() {
    try {
      setSavingStep("assets");
      setError(null);

      const updates = assets
        .map((item) => {
          const nextValue = toNumber(assetValues[item.id] ?? String(item.current_value ?? 0));
          return {
            id: item.id,
            nextValue,
            changed: Math.abs(nextValue - Number(item.current_value ?? 0)) >= 0.01,
          };
        })
        .filter((item) => item.changed);

      await Promise.all(updates.map((item) => updateAsset({ id: item.id, current_value: item.nextValue })));

      markStepComplete("assets");
      setNotice(`Asset values ${updates.length > 0 ? "updated" : "reviewed"} successfully.`);
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save asset values");
    } finally {
      setSavingStep(null);
    }
  }

  async function handleSaveLoans() {
    try {
      setSavingStep("loans");
      setError(null);

      const updates = liabilities
        .map((item) => {
          const nextValue = toNumber(loanValues[item.id] ?? String(item.outstanding_amount ?? 0));
          return {
            id: item.id,
            nextValue,
            changed: Math.abs(nextValue - Number(item.outstanding_amount ?? 0)) >= 0.01,
          };
        })
        .filter((item) => item.changed);

      await Promise.all(updates.map((item) => updateLiability({ id: item.id, outstanding_amount: item.nextValue })));

      markStepComplete("loans");
      setNotice(`Loan balances ${updates.length > 0 ? "updated" : "reviewed"} successfully.`);
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      await loadWorkspaceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save loan balances");
    } finally {
      setSavingStep(null);
    }
  }

  async function handleSaveExpenses() {
    try {
      setSavingStep("expenses");
      setError(null);

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
      setNotice("Month reopened. You can now edit and re-close it.");
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

    const requiredSteps: WorkflowStepKey[] = ["compensation", "investments", "assets", "loans", "expenses", "summary"];
    const incompleteStep = requiredSteps.find((step) => !completedSteps[step]);

    if (incompleteStep) {
      setError(`Complete all workflow steps before closing. Pending: ${incompleteStep}.`);
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
            description="One guided monthly workflow for compensation, valuations, liabilities, expenses, summary, and month close."
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
                  <h3 className="text-base font-semibold text-slate-900">2. Investment Value Updates</h3>
                </div>
                <Button type="button" onClick={() => void handleSaveInvestments()} disabled={savingStep === "investments"}>
                  {savingStep === "investments" ? "Saving..." : "Save Investment Updates"}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {investments.length === 0 ? <p className="text-sm text-slate-500">No investments available.</p> : null}

                {mutualFundInvestments.length > 0 ? (
                  <div className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Total Mutual Fund Value</p>
                      <p className="text-xs text-slate-500">Aggregated across {mutualFundInvestments.length} mutual fund entr{mutualFundInvestments.length === 1 ? "y" : "ies"}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
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
                  <h3 className="text-base font-semibold text-slate-900">3. Asset Value Updates</h3>
                </div>
                <Button type="button" onClick={() => void handleSaveAssets()} disabled={savingStep === "assets"}>
                  {savingStep === "assets" ? "Saving..." : "Save Asset Updates"}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {assets.length === 0 ? <p className="text-sm text-slate-500">No assets available.</p> : null}
                {assets.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_180px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.asset_name}</p>
                      <p className="text-xs text-slate-500">{item.asset_type}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
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
                  <h3 className="text-base font-semibold text-slate-900">4. Loan Balance Updates</h3>
                </div>
                <Button type="button" onClick={() => void handleSaveLoans()} disabled={savingStep === "loans"}>
                  {savingStep === "loans" ? "Saving..." : "Save Loan Updates"}
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
                      value={loanValues[item.id] ?? "0"}
                      onChange={(event) => setLoanValues((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <ClipboardCheck className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-slate-900">5. Living Expenses</h3>
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
                  <h3 className="text-base font-semibold text-slate-900">6. Financial Summary</h3>
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
                      <p className={`mt-1 text-lg font-semibold ${tone(workspace.dashboard.monthOverMonthChange)}`}>{formatCurrency(workspace.dashboard.monthOverMonthChange, { maximumFractionDigits: 0 })}</p>
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
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Financial summary will appear once the workspace is loaded.</p>
              )}
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <h3 className="text-base font-semibold text-slate-900">7. Month Close Confirmation</h3>
                </div>
                <div className="flex items-center gap-2">
                  {workspace.latestClose?.id ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setReopenReason(""); setReopenDialogOpen(true); }}
                      disabled={reopeningMonth}
                    >
                      Reopen Month
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
                      {completedSteps[step.key] ? "Complete" : "Pending"}
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
            <DialogTitle>Reopen Month</DialogTitle>
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
