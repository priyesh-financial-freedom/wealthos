"use client";

import { useMemo, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { ProjectionViewerMonthSnapshot } from "@/services/projection/ProjectionReadModel";

interface ProjectionSnapshotSelectorProps {
  monthSnapshots: ProjectionViewerMonthSnapshot[];
  projectionStartMonth: string;
  projectionEndMonth: string;
  primaryCurrentAge: number | null;
  retirementAge: number | null;
}

function isValidMonthKey(monthKey: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthKey);
}

function clampMonthKey(monthKey: string, minimum: string, maximum: string): string {
  if (monthKey < minimum) {
    return minimum;
  }

  if (monthKey > maximum) {
    return maximum;
  }

  return monthKey;
}

function addMonths(monthKey: string, monthsToAdd: number): string {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }

  const totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }

  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return label.replace(/,/g, "");
}

function formatMetricValue(value: number | null): string {
  if (value === null) {
    return "Data required";
  }

  return formatCurrency(value, { maximumFractionDigits: 0 });
}

function metricTone(value: number | null): string {
  return value === null ? "text-slate-500" : "text-slate-900";
}

export function ProjectionSnapshotSelector({
  monthSnapshots,
  projectionStartMonth,
  projectionEndMonth,
  primaryCurrentAge,
  retirementAge,
}: ProjectionSnapshotSelectorProps) {
  const snapshotByMonth = useMemo(() => new Map(monthSnapshots.map((snapshot) => [snapshot.month, snapshot])), [monthSnapshots]);
  const todayMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const initialMonth = useMemo(() => {
    if (!isValidMonthKey(todayMonth)) {
      return projectionStartMonth;
    }

    return clampMonthKey(todayMonth, projectionStartMonth, projectionEndMonth);
  }, [projectionEndMonth, projectionStartMonth]);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  const currentSnapshot = snapshotByMonth.get(selectedMonth) ?? monthSnapshots[0] ?? null;

  function selectMonth(monthKey: string) {
    setSelectedMonth(clampMonthKey(monthKey, projectionStartMonth, projectionEndMonth));
  }

  function jumpToToday() {
    selectMonth(todayMonth);
  }

  function jumpByAge(targetAge: number | null) {
    if (targetAge === null || primaryCurrentAge === null) {
      return;
    }

    const ageDelta = Math.max(0, targetAge - primaryCurrentAge);
    selectMonth(addMonths(todayMonth, ageDelta * 12));
  }

  const metrics = [
    { label: "Net Worth", value: currentSnapshot ? currentSnapshot.net_worth : null },
    { label: "Financial Assets", value: currentSnapshot ? currentSnapshot.financial_assets_total : null },
    { label: "Retirement Corpus", value: currentSnapshot ? currentSnapshot.retirement_corpus : null },
    { label: "Property / Non-Financial Assets", value: currentSnapshot ? currentSnapshot.property_value : null },
    { label: "Total Debt", value: currentSnapshot ? currentSnapshot.total_debt : null },
    { label: "Monthly Income", value: currentSnapshot ? currentSnapshot.monthly_income : null },
    { label: "Monthly Expense", value: currentSnapshot ? currentSnapshot.monthly_expense : null },
    { label: "Monthly Surplus / Shortfall", value: currentSnapshot ? currentSnapshot.corpus_drawdown : null },
  ];

  return (
    <ContentCard className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Snapshot selector</p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">{monthLabel(selectedMonth)}</h2>
            <p className="text-sm text-slate-600">Use any month in the plan horizon, or jump to a key milestone.</p>
          </div>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span className="sr-only">Select projection month</span>
            <input
              type="month"
              min={projectionStartMonth}
              max={projectionEndMonth}
              value={selectedMonth}
              onChange={(event) => selectMonth(event.target.value)}
              className="min-w-[180px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={jumpToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => jumpByAge(retirementAge)} disabled={retirementAge === null || primaryCurrentAge === null}>
            Retirement
          </Button>
          <Button variant="outline" size="sm" onClick={() => jumpByAge(70)} disabled={primaryCurrentAge === null}>
            Age 70
          </Button>
          <Button variant="outline" size="sm" onClick={() => jumpByAge(80)} disabled={primaryCurrentAge === null}>
            Age 80
          </Button>
          <Button variant="outline" size="sm" onClick={() => jumpByAge(90)} disabled={primaryCurrentAge === null}>
            Age 90
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <DashboardCard key={metric.label} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
            <p className={`text-2xl font-semibold tracking-tight ${metricTone(metric.value)}`}>{formatMetricValue(metric.value)}</p>
          </DashboardCard>
        ))}
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Property / Non-Financial Assets uses the non-financial assets bucket in this projection version. Monthly Surplus / Shortfall is shown as the monthly income/expense gap.
      </p>
    </ContentCard>
  );
}