"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, CheckCircle2, ChevronDown, ChevronUp, Save, Scale } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import {
  calculateMonthEndCloseVarianceSummary,
  closeMonthEndClose,
  getMonthEndCloseWorkspace,
  saveMonthEndCloseDraft,
} from "@/services/monthEndClose";
import type { MonthEndCloseEditorItem, MonthEndCloseWorkspace } from "@/types/monthEndClose";

function numberTone(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-700";
}

function displayVariance(value: number | null) {
  return value === null ? "—" : formatPercent(value, { digits: 1, multiply: false });
}

function VarianceBadge({ item }: { item: MonthEndCloseEditorItem | null }) {
  if (!item) {
    return <p className="text-sm text-slate-500">—</p>;
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
      <p className={`text-sm ${numberTone(item.absoluteVariance)}`}>{formatCurrency(item.absoluteVariance, { maximumFractionDigits: 0 })}</p>
    </div>
  );
}

function SummaryCards({ workspace, items }: { workspace: MonthEndCloseWorkspace; items: MonthEndCloseEditorItem[] }) {
  const varianceSummary = calculateMonthEndCloseVarianceSummary(items);
  const { dashboard } = workspace;
  const largestPositiveVariance = items.filter((item) => item.absoluteVariance > 0).sort((left, right) => right.absoluteVariance - left.absoluteVariance)[0] ?? null;
  const largestNegativeVariance = items.filter((item) => item.absoluteVariance < 0).sort((left, right) => left.absoluteVariance - right.absoluteVariance)[0] ?? null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <DashboardCard>
        <div className="flex items-center gap-2 text-slate-600">
          <CalendarRange className="h-4 w-4" />
          <p className="text-xs uppercase tracking-wide">Current Closed Month</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-slate-900">{dashboard.currentClosedMonth?.label ?? "No close yet"}</p>
        <p className="mt-1 text-sm text-slate-500">Pending: {dashboard.pendingMonth.label}</p>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center gap-2 text-slate-600">
          <Scale className="h-4 w-4" />
          <p className="text-xs uppercase tracking-wide">Net Worth</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(varianceSummary.actualKpis.netWorth, { maximumFractionDigits: 0 })}</p>
        <p className={`mt-1 text-sm ${numberTone(dashboard.monthOverMonthChange)}`}>{formatCurrency(dashboard.monthOverMonthChange, { maximumFractionDigits: 0 })} month-over-month</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Total Assets</p>
        <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(varianceSummary.actualKpis.totalAssets, { maximumFractionDigits: 0 })}</p>
        <p className="mt-1 text-xs text-slate-500">Projected: {formatCurrency(varianceSummary.projectedKpis.totalAssets, { maximumFractionDigits: 0 })}</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Total Liabilities</p>
        <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(varianceSummary.actualKpis.totalLiabilities, { maximumFractionDigits: 0 })}</p>
        <p className="mt-1 text-xs text-slate-500">Projected: {formatCurrency(varianceSummary.projectedKpis.totalLiabilities, { maximumFractionDigits: 0 })}</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Projection Variance</p>
        <p className={`mt-2 text-xl font-semibold ${numberTone(varianceSummary.projectionVariance)}`}>{formatCurrency(varianceSummary.projectionVariance, { maximumFractionDigits: 0 })}</p>
        <p className="mt-1 text-xs text-slate-500">Actual net worth minus projected net worth</p>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Largest Positive Variance</p>
        <div className="mt-2">
          <VarianceBadge item={largestPositiveVariance} />
        </div>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Largest Negative Variance</p>
        <div className="mt-2">
          <VarianceBadge item={largestNegativeVariance} />
        </div>
      </DashboardCard>

      <DashboardCard>
        <p className="text-xs uppercase tracking-wide text-slate-600">Workflow</p>
        <p className="mt-2 text-xl font-semibold text-slate-900">{workspace.status === "closed" ? "Closed" : "Draft"}</p>
        <p className="mt-1 text-xs text-slate-500">Actuals are editable until the month is closed.</p>
      </DashboardCard>
    </div>
  );
}

function MonthEndCloseTable({
  title,
  items,
  actualValues,
  onActualValueChange,
}: {
  title: string;
  items: MonthEndCloseEditorItem[];
  actualValues: Record<string, string>;
  onActualValueChange: (rowKey: string, value: string) => void;
}) {
  return (
    <DashboardCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Entity</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Opening Value</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Projected Value</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actual Value</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Absolute Variance</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Percentage Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.map((item) => (
              <tr key={item.rowKey}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.entityTypeLabel}</p>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(item.openingValue, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(item.projectedValue, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-right">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="ml-auto w-36 text-right"
                    value={actualValues[item.rowKey] ?? String(item.actualValue)}
                    onChange={(event) => onActualValueChange(item.rowKey, event.target.value)}
                  />
                </td>
                <td className={`px-4 py-3 text-right font-medium ${numberTone(item.absoluteVariance)}`}>{formatCurrency(item.absoluteVariance, { maximumFractionDigits: 0 })}</td>
                <td className={`px-4 py-3 text-right font-medium ${numberTone(item.absoluteVariance)}`}>{displayVariance(item.percentageVariance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

export default function MonthEndClosePage() {
  const [workspace, setWorkspace] = useState<MonthEndCloseWorkspace | null>(null);
  const [actualValues, setActualValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [closingMonth, setClosingMonth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLiabilities, setShowLiabilities] = useState(true);

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const nextWorkspace = await getMonthEndCloseWorkspace();
      setWorkspace(nextWorkspace);
      setActualValues(
        nextWorkspace.items.reduce<Record<string, string>>((acc, item) => {
          acc[item.rowKey] = String(item.actualValue);
          return acc;
        }, {}),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load month-end close workspace");
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const items = useMemo(() => {
    if (!workspace) {
      return [];
    }

    return workspace.items.map((item) => {
      const actualValue = Number(actualValues[item.rowKey] ?? item.actualValue ?? 0);
      const absoluteVariance = actualValue - item.projectedValue;
      const percentageVariance = item.projectedValue === 0 ? (actualValue === 0 ? 0 : null) : ((actualValue - item.projectedValue) / Math.abs(item.projectedValue)) * 100;

      return {
        ...item,
        actualValue,
        absoluteVariance,
        percentageVariance,
      };
    });
  }, [actualValues, workspace]);

  const assetItems = useMemo(() => items.filter((item) => item.itemType === "asset"), [items]);
  const liabilityItems = useMemo(() => items.filter((item) => item.itemType === "liability"), [items]);

  function handleActualValueChange(rowKey: string, value: string) {
    setActualValues((current) => ({ ...current, [rowKey]: value }));
  }

  async function handleSaveDraft() {
    if (!workspace) {
      return;
    }

    try {
      setSavingDraft(true);
      setError(null);
      const nextWorkspace = await saveMonthEndCloseDraft({
        closeId: workspace.close?.id ?? null,
        closeMonth: workspace.month.month,
        closeYear: workspace.month.year,
        items: items.map((item) => ({
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
      setWorkspace(nextWorkspace);
      setActualValues(
        nextWorkspace.items.reduce<Record<string, string>>((acc, item) => {
          acc[item.rowKey] = String(item.actualValue);
          return acc;
        }, {}),
      );
      setNotice(`Draft saved for ${workspace.month.label}.`);
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save draft");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleCloseMonth() {
    if (!workspace) {
      return;
    }

    try {
      setClosingMonth(true);
      setError(null);
      const closedLabel = workspace.month.label;
      const nextWorkspace = await closeMonthEndClose({
        closeId: workspace.close?.id ?? null,
        closeMonth: workspace.month.month,
        closeYear: workspace.month.year,
        items: items.map((item) => ({
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
      setWorkspace(nextWorkspace);
      setActualValues(
        nextWorkspace.items.reduce<Record<string, string>>((acc, item) => {
          acc[item.rowKey] = String(item.actualValue);
          return acc;
        }, {}),
      );
      setNotice(`Month closed for ${closedLabel}.`);
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to close month");
    } finally {
      setClosingMonth(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Month-End Close"
            description="Capture immutable actual month-end values, compare them against the projection universe, and seed future forecasts from closed actuals."
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => void handleSaveDraft()} disabled={loading || savingDraft || closingMonth || !workspace}>
              <Save className="h-4 w-4" />
              {savingDraft ? "Saving Draft..." : "Save Draft"}
            </Button>
            <Button type="button" onClick={() => void handleCloseMonth()} disabled={loading || savingDraft || closingMonth || !workspace}>
              <CheckCircle2 className="h-4 w-4" />
              {closingMonth ? "Closing Month..." : "Close Month"}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        {loading ? <LoadingSpinner label="Preparing month-end close workspace..." /> : null}

        {!loading && !workspace ? (
          <DashboardCard>
            <p className="text-sm text-slate-600">Month-end close data is not available.</p>
          </DashboardCard>
        ) : null}

        {!loading && workspace ? (
          <div className="space-y-6">
            <SummaryCards workspace={workspace} items={items} />

            <MonthEndCloseTable title="Assets" items={assetItems} actualValues={actualValues} onActualValueChange={handleActualValueChange} />

            <DashboardCard className="p-0">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => setShowLiabilities((current) => !current)}
              >
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Liabilities</h3>
                  <p className="text-sm text-slate-500">Home loans, car loans, and all other liability actuals remain independent from projections.</p>
                </div>
                {showLiabilities ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
              </button>
              {showLiabilities ? (
                <div className="border-t border-slate-200 p-0">
                  <MonthEndCloseTable title="Liabilities" items={liabilityItems} actualValues={actualValues} onActualValueChange={handleActualValueChange} />
                </div>
              ) : null}
            </DashboardCard>
          </div>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}