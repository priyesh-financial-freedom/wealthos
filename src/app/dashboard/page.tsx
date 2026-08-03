"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { formatCurrency, formatPercent } from "@/lib/formatters";

type OwnerLabel = "Priyesh" | "Shobhana" | "Joint";

type CardState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "unavailable" };

interface FamilyNetWorthCardData {
  familyNetWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyChange: number | null;
  ownerSplit: Record<OwnerLabel, number> | null;
}

interface RetirementCardData {
  currentRetirementCorpus: number | null;
  expectedCorpusAtRetirement: number | null;
  retirementDate: string | null;
  statusLabel: string | null;
  detail: string;
}

interface MonthlyReviewCardData {
  latestReviewMonth: string | null;
  netWorthChange: number | null;
  savingsRate: number | null;
  status: "Completed" | "Pending" | "Data required";
}

interface GoalsCardData {
  totalGoals: number;
  nextGoalName: string | null;
  nextGoalDate: string | null;
}

interface DebtSnapshotCardData {
  totalOutstandingDebt: number;
  homeLoan: number;
  carLoan: number;
  overdraft: number;
  creditCards: number;
  other: number;
}

interface SnapshotHistoryRecord {
  monthLabel: string;
  totals: {
    netWorth: number;
  };
}

type BalanceSheetData = Awaited<ReturnType<typeof import("@/services/balanceSheet")["getBalanceSheetData"]>>;

function normalizeOwner(value: unknown): OwnerLabel | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "priyesh" || normalized === "kumar priyesh") {
    return "Priyesh";
  }

  if (normalized === "shobhana") {
    return "Shobhana";
  }

  if (normalized === "joint" || normalized === "priyesh + shobhana") {
    return "Joint";
  }

  return null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function toTitleCase(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatHumanReadableDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const parts = value.split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return value;
  }

  const [year, month, day] = parts;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function computeOwnerSplit(balanceSheetData: Record<string, unknown>): Record<OwnerLabel, number> | null {
  const split: Record<OwnerLabel, number> = {
    Priyesh: 0,
    Shobhana: 0,
    Joint: 0,
  };

  let sawOwnedValue = false;
  let missingOwner = false;

  const addRows = (rows: unknown, keys: string[], multiplier = 1) => {
    if (!Array.isArray(rows)) {
      return;
    }

    for (const row of rows) {
      if (!row || typeof row !== "object") {
        continue;
      }

      const record = row as Record<string, unknown>;
      const value = firstNumber(record, keys);

      if (value === null || value === 0) {
        continue;
      }

      const owner = normalizeOwner(record.owner);
      if (!owner) {
        missingOwner = true;
        continue;
      }

      split[owner] += value * multiplier;
      sawOwnedValue = true;
    }
  };

  addRows(balanceSheetData.assets, ["current_value"]);
  addRows(balanceSheetData.investments, ["current_value", "cost_basis"]);
  addRows(balanceSheetData.bankAccounts, ["current_balance"]);
  addRows(balanceSheetData.retirementAccounts, ["current_balance"]);
  addRows(balanceSheetData.fixedDeposits, ["current_value", "maturity_value", "principal_amount"]);
  addRows(balanceSheetData.goldHoldings, ["current_value"]);
  addRows(balanceSheetData.silverHoldings, ["current_value"]);
  addRows(balanceSheetData.realEstateProperties, ["current_market_value", "purchase_price"]);
  addRows(balanceSheetData.liabilities, ["outstanding_amount"], -1);

  if (!sawOwnedValue || missingOwner) {
    return null;
  }

  return split;
}

function computeMonthlyChange(history: SnapshotHistoryRecord[]): number | null {
  if (history.length < 2) {
    return null;
  }

  return Number(history[0]?.totals.netWorth ?? 0) - Number(history[1]?.totals.netWorth ?? 0);
}

async function loadSnapshotHistory(): Promise<SnapshotHistoryRecord[]> {
  const { snapshotReadModel } = await import("@/services/snapshots");
  const monthEndHistory = await snapshotReadModel.loadHistory({ source: "month-end-close" }).catch(() => []);

  if (monthEndHistory.length > 0) {
    return monthEndHistory;
  }

  return snapshotReadModel.loadHistory({ source: "legacy-monthly-snapshot" }).catch(() => []);
}

async function loadBalanceSheet(): Promise<Awaited<ReturnType<typeof import("@/services/balanceSheet")["getBalanceSheetData"]>>> {
  const { getBalanceSheetData } = await import("@/services/balanceSheet");
  return getBalanceSheetData();
}

function getCurrentRetirementCorpusFromBalanceSheet(balanceSheetData: BalanceSheetData | null): number | null {
  const candidate = balanceSheetData?.summary?.categoryTotals?.retirement;
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

async function loadFamilyNetWorthCard(
  balanceSheetPromise: Promise<Awaited<ReturnType<typeof import("@/services/balanceSheet")["getBalanceSheetData"]>>>,
  historyPromise: Promise<SnapshotHistoryRecord[]>,
): Promise<FamilyNetWorthCardData> {
  const [balanceSheetData, history] = await Promise.all([
    balanceSheetPromise,
    historyPromise,
  ]);

  return {
    familyNetWorth: Number(balanceSheetData.summary.netWorth ?? 0),
    totalAssets: Number(balanceSheetData.summary.totalBalanceSheetAssets ?? 0),
    totalLiabilities: Number(balanceSheetData.summary.totalLiabilities ?? 0),
    monthlyChange: computeMonthlyChange(history),
    ownerSplit: computeOwnerSplit(balanceSheetData as unknown as Record<string, unknown>),
  };
}

async function loadRetirementCard(balanceSheetPromise: Promise<BalanceSheetData>): Promise<RetirementCardData> {
  const response = await fetch("/api/dashboard/retirement", {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Authentication required.");
    }

    let apiMessage = "Unable to load retirement summary";

    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      apiMessage = payload.error?.message ?? apiMessage;
    } catch {
      // Keep a safe fallback message when no JSON payload is returned.
    }

    const balanceSheetData = await balanceSheetPromise.catch(() => null);

    return {
      currentRetirementCorpus: getCurrentRetirementCorpusFromBalanceSheet(balanceSheetData),
      expectedCorpusAtRetirement: null,
      retirementDate: null,
      statusLabel: "Data required",
      detail: apiMessage,
    };
  }

  const data = await response.json() as RetirementCardData;
  if (data.currentRetirementCorpus !== null) {
    return data;
  }

  const balanceSheetData = await balanceSheetPromise.catch(() => null);
  return {
    ...data,
    currentRetirementCorpus: getCurrentRetirementCorpusFromBalanceSheet(balanceSheetData),
  };
}

async function loadMonthlyReviewCard(historyPromise: Promise<SnapshotHistoryRecord[]>): Promise<MonthlyReviewCardData> {
  const [{ cashFlowManagementService }, history] = await Promise.all([
    import("@/services/cashFlowManagement"),
    historyPromise,
  ]);

  const cashFlowSummary = await cashFlowManagementService.getCashFlowSummary().catch(() => null);
  const latestReviewMonth = history[0]?.monthLabel ?? null;

  return {
    latestReviewMonth,
    netWorthChange: computeMonthlyChange(history),
    savingsRate: cashFlowSummary?.savingsRate ?? null,
    status: latestReviewMonth
      ? "Completed"
      : cashFlowSummary
        ? "Pending"
        : "Data required",
  };
}

async function loadGoalsCard(): Promise<GoalsCardData> {
  const { goalService } = await import("@/services/planning/goals");
  const goals = await goalService.listGoals({ includeProgress: false });
  const orderedGoals = [...goals]
    .filter((goal) => !goal.is_completed)
    .sort((left, right) => left.target_date.localeCompare(right.target_date));

  return {
    totalGoals: goals.length,
    nextGoalName: orderedGoals[0]?.name ?? null,
    nextGoalDate: orderedGoals[0]?.target_date ?? null,
  };
}

async function loadDebtSnapshotCard(
  balanceSheetPromise: Promise<Awaited<ReturnType<typeof import("@/services/balanceSheet")["getBalanceSheetData"]>>>,
): Promise<DebtSnapshotCardData> {
  const balanceSheetData = await balanceSheetPromise;
  const liabilities = balanceSheetData.liabilities ?? [];

  const sumByTypes = (types: string[]) => liabilities
    .filter((liability) => types.includes(liability.liability_type))
    .reduce((sum, liability) => sum + Number(liability.outstanding_amount ?? 0), 0);

  const homeLoan = sumByTypes(["Home Loan", "Loan Against Property"]);
  const carLoan = sumByTypes(["Car Loan"]);
  const overdraft = sumByTypes(["Bank Overdraft", "Overdraft / Line of Credit"]);
  const creditCards = sumByTypes(["Credit Card"]);
  const totalOutstandingDebt = Number(balanceSheetData.summary.totalLiabilities ?? 0);
  const other = Math.max(0, totalOutstandingDebt - homeLoan - carLoan - overdraft - creditCards);

  return {
    totalOutstandingDebt,
    homeLoan,
    carLoan,
    overdraft,
    creditCards,
    other,
  };
}

function DataUnavailable() {
  return <p className="mt-4 text-sm text-slate-500">Data unavailable</p>;
}

function Badge({ label, tone }: { label: string; tone: "emerald" | "amber" | "slate" }) {
  const className = tone === "emerald"
    ? "bg-emerald-100 text-emerald-700"
    : tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [familyNetWorth, setFamilyNetWorth] = useState<CardState<FamilyNetWorthCardData>>({ status: "loading" });
  const [retirement, setRetirement] = useState<CardState<RetirementCardData>>({ status: "loading" });
  const [monthlyReview, setMonthlyReview] = useState<CardState<MonthlyReviewCardData>>({ status: "loading" });
  const [goals, setGoals] = useState<CardState<GoalsCardData>>({ status: "loading" });
  const [debtSnapshot, setDebtSnapshot] = useState<CardState<DebtSnapshotCardData>>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      const historyPromise = loadSnapshotHistory();
      const balanceSheetPromise = loadBalanceSheet();

      const [familyResult, retirementResult, monthlyReviewResult, goalsResult, debtResult] = await Promise.allSettled([
        loadFamilyNetWorthCard(balanceSheetPromise, historyPromise),
        loadRetirementCard(balanceSheetPromise),
        loadMonthlyReviewCard(historyPromise),
        loadGoalsCard(),
        loadDebtSnapshotCard(balanceSheetPromise),
      ]);

      if (!isMounted) {
        return;
      }

      setFamilyNetWorth(familyResult.status === "fulfilled" ? { status: "ready", data: familyResult.value } : { status: "unavailable" });
      setRetirement(retirementResult.status === "fulfilled" ? { status: "ready", data: retirementResult.value } : { status: "unavailable" });
      setMonthlyReview(monthlyReviewResult.status === "fulfilled" ? { status: "ready", data: monthlyReviewResult.value } : { status: "unavailable" });
      setGoals(goalsResult.status === "fulfilled" ? { status: "ready", data: goalsResult.value } : { status: "unavailable" });
      setDebtSnapshot(debtResult.status === "fulfilled" ? { status: "ready", data: debtResult.value } : { status: "unavailable" });
    }

    const handleRefresh = () => {
      void loadDashboard();
    };

    void loadDashboard();

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("wealthos:finance-data-updated", handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("wealthos:finance-data-updated", handleRefresh);
    };
  }, []);

  return (
    <AppLayout>
      <PageContainer className="mx-auto w-full max-w-[1200px]">
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Dashboard" }]} />

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <div className="space-y-4">
            <div className="flex flex-col gap-2 rounded-3xl bg-white p-6 shadow-[0_28px_64px_-42px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5 sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">WealthOS</p>
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.02em] text-slate-900">Family Dashboard</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">A simple, reliable family overview with only the essentials.</p>
              </div>
            </div>

            <section data-testid="simple-dashboard-grid" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <DashboardCard className="border-t-4 border-blue-500 xl:col-span-2">
                <h2 className="text-lg font-semibold text-slate-900">Family Net Worth</h2>
                {familyNetWorth.status === "ready" ? (
                  <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr] xl:items-start">
                    <div className="space-y-4 rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 px-5 py-6 text-white sm:px-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Family Net Worth</p>
                      <p className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{formatCurrency(familyNetWorth.data.familyNetWorth, { maximumFractionDigits: 0 })}</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white/15 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-blue-100">Total Assets</p>
                          <p className="mt-2 text-lg font-semibold">{formatCurrency(familyNetWorth.data.totalAssets, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="rounded-2xl bg-white/15 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-blue-100">Total Liabilities</p>
                          <p className="mt-2 text-lg font-semibold">{formatCurrency(familyNetWorth.data.totalLiabilities, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="rounded-2xl bg-white/15 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-blue-100">Monthly Change</p>
                          <p className="mt-2 text-lg font-semibold">{familyNetWorth.data.monthlyChange === null ? "—" : formatCurrency(familyNetWorth.data.monthlyChange, { maximumFractionDigits: 0 })}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-3xl bg-slate-50 px-4 py-4 text-sm text-slate-600 sm:px-5">
                      {familyNetWorth.data.ownerSplit ? (
                        <div className="space-y-2">
                          <p className="font-medium text-slate-900">Owner split</p>
                          <MetricRow label="Priyesh" value={formatCurrency(familyNetWorth.data.ownerSplit.Priyesh, { maximumFractionDigits: 0 })} />
                          <MetricRow label="Shobhana" value={formatCurrency(familyNetWorth.data.ownerSplit.Shobhana, { maximumFractionDigits: 0 })} />
                          <MetricRow label="Joint" value={formatCurrency(familyNetWorth.data.ownerSplit.Joint, { maximumFractionDigits: 0 })} />
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-slate-500">
                          <p className="text-sm font-medium text-slate-700">Owner-wise split</p>
                          <p className="mt-1 text-sm text-slate-500">Coming soon</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : familyNetWorth.status === "loading" ? (
                  <p className="mt-4 text-sm text-slate-500">Loading...</p>
                ) : (
                  <DataUnavailable />
                )}
              </DashboardCard>

              <DashboardCard className="border-t-4 border-emerald-500">
                <h2 className="text-lg font-semibold text-slate-900">Retirement</h2>
                {retirement.status === "ready" ? (
                  <div className="mt-4 space-y-3">
                    <MetricRow
                      label="Current Corpus"
                      value={retirement.data.currentRetirementCorpus === null ? "Data required" : formatCurrency(retirement.data.currentRetirementCorpus, { maximumFractionDigits: 0 })}
                    />
                    <MetricRow label="Expected Corpus" value={retirement.data.expectedCorpusAtRetirement === null ? "Data required" : formatCurrency(retirement.data.expectedCorpusAtRetirement, { maximumFractionDigits: 0 })} />
                    <MetricRow label="Retirement Date" value={retirement.data.retirementDate ?? "Set in Assumptions"} />
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Status</span>
                      {retirement.data.statusLabel === "On Track" || retirement.data.statusLabel === "Needs Attention"
                        ? <Badge label={retirement.data.statusLabel} tone={retirement.data.statusLabel === "On Track" ? "emerald" : "amber"} />
                        : <span className="text-right font-medium text-slate-900">Data required</span>}
                    </div>
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Expected corpus uses the latest locked rolling projection at retirement date, with fixed as fallback.</p>
                  </div>
                ) : retirement.status === "loading" ? (
                  <p className="mt-4 text-sm text-slate-500">Loading...</p>
                ) : (
                  <DataUnavailable />
                )}
              </DashboardCard>

              <DashboardCard className="border-t-4 border-teal-500">
                <h2 className="text-lg font-semibold text-slate-900">Monthly Review</h2>
                {monthlyReview.status === "ready" ? (
                  <div className="mt-4 space-y-3">
                    <MetricRow label="Latest Review Month" value={monthlyReview.data.latestReviewMonth ?? "No review yet"} />
                    <MetricRow label="Net Worth Change" value={monthlyReview.data.netWorthChange === null ? "—" : formatCurrency(monthlyReview.data.netWorthChange, { maximumFractionDigits: 0 })} />
                    <MetricRow label="Savings Rate" value={monthlyReview.data.savingsRate === null ? "—" : formatPercent(monthlyReview.data.savingsRate)} />
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Status</span>
                      <Badge label={monthlyReview.data.status} tone={monthlyReview.data.status === "Completed" ? "emerald" : monthlyReview.data.status === "Pending" ? "amber" : "slate"} />
                    </div>
                    <Link href="/monthly-review" className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                      Open Monthly Review
                    </Link>
                  </div>
                ) : monthlyReview.status === "loading" ? (
                  <p className="mt-4 text-sm text-slate-500">Loading...</p>
                ) : (
                  <DataUnavailable />
                )}
              </DashboardCard>

              <DashboardCard className="border-t-4 border-amber-500">
                <h2 className="text-lg font-semibold text-slate-900">Goals</h2>
                {goals.status === "ready" ? (
                  <div className="mt-4 space-y-3">
                    <MetricRow label="Total Goals" value={String(goals.data.totalGoals)} />
                    <MetricRow label="Next Goal" value={goals.data.nextGoalName ? toTitleCase(goals.data.nextGoalName) : "No active goals"} />
                    <MetricRow label="Next Goal Date" value={goals.data.nextGoalDate ? formatHumanReadableDate(goals.data.nextGoalDate) : "—"} />
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Detailed funding status available on Goals page.</p>
                  </div>
                ) : goals.status === "loading" ? (
                  <p className="mt-4 text-sm text-slate-500">Loading...</p>
                ) : (
                  <DataUnavailable />
                )}
              </DashboardCard>

              <DashboardCard className="border-t-4 border-rose-500">
                <h2 className="text-lg font-semibold text-slate-900">Debt Snapshot</h2>
                {debtSnapshot.status === "ready" ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-3xl bg-rose-50 px-5 py-5 text-rose-900 ring-1 ring-rose-100">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Total Outstanding Debt</p>
                      <p className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{formatCurrency(debtSnapshot.data.totalOutstandingDebt, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="space-y-3">
                      <MetricRow label="Home Loan" value={formatCurrency(debtSnapshot.data.homeLoan, { maximumFractionDigits: 0 })} />
                      <MetricRow label="Car Loan" value={formatCurrency(debtSnapshot.data.carLoan, { maximumFractionDigits: 0 })} />
                      <MetricRow label="Overdraft" value={formatCurrency(debtSnapshot.data.overdraft, { maximumFractionDigits: 0 })} />
                      <MetricRow label="Credit Cards" value={formatCurrency(debtSnapshot.data.creditCards, { maximumFractionDigits: 0 })} />
                      <MetricRow label="Other" value={formatCurrency(debtSnapshot.data.other, { maximumFractionDigits: 0 })} />
                    </div>
                  </div>
                ) : debtSnapshot.status === "loading" ? (
                  <p className="mt-4 text-sm text-slate-500">Loading...</p>
                ) : (
                  <DataUnavailable />
                )}
              </DashboardCard>
            </section>
          </div>
        </ContentContainer>
      </PageContainer>
    </AppLayout>
  );
}
