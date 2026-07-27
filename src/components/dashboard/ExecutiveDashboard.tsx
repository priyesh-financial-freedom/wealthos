"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import { BarChart3, Landmark, PiggyBank, Wallet2 } from "lucide-react";

import {
  ErrorCard,
  ExecutiveEmptyState,
  ExecutiveKpiCard,
  InsightCard,
  LoadingExecutiveState,
  ProgressBar,
} from "@/components/dashboard/ExecutiveDesignSystem";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ExecutiveDashboardData } from "@/services/dashboard";

interface ExecutiveDashboardProps {
  loading: boolean;
  data: ExecutiveDashboardData | null;
  error?: string | null;
}

function valueToneClass(value: number) {
  if (!Number.isFinite(value)) {
    return "text-slate-900";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-900";
}

function summaryCards(data: ExecutiveDashboardData) {
  return [
    {
      title: "Net Worth",
      value: data.executiveSummary.netWorth,
      detail: "Current net worth",
      icon: Wallet2,
      tone: "blue" as const,
      href: undefined,
    },
    {
      title: "Total Assets",
      value: data.executiveSummary.assets,
      detail: "Total assets",
      icon: BarChart3,
      tone: "emerald" as const,
      href: "/assets",
    },
    {
      title: "Total Liabilities",
      value: data.executiveSummary.liabilities,
      detail: "Total liabilities",
      icon: Landmark,
      tone: "amber" as const,
      href: undefined,
    },
    {
      title: "Monthly Savings",
      value: data.executiveSummary.monthlySavings,
      detail: "Income minus expenses",
      icon: PiggyBank,
      tone: "purple" as const,
      href: undefined,
    },
  ];
}

const SummaryGrid = memo(function SummaryGrid({ data }: { data: ExecutiveDashboardData }) {
  const cards = useMemo(() => summaryCards(data), [data]);

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        card.href ? (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ExecutiveKpiCard
              title={card.title}
              value={formatCurrency(card.value, { maximumFractionDigits: 0 })}
              detail={card.detail}
              icon={card.icon}
              tone={card.tone}
              valueClassName={valueToneClass(card.value)}
              className="h-full cursor-pointer"
            />
          </Link>
        ) : (
          <ExecutiveKpiCard
            key={card.title}
            title={card.title}
            value={formatCurrency(card.value, { maximumFractionDigits: 0 })}
            detail={card.detail}
            icon={card.icon}
            tone={card.tone}
            valueClassName={valueToneClass(card.value)}
          />
        )
      ))}
    </section>
  );
});

function InteractiveMetricCard({
  href,
  label,
  value,
  valueClassName,
}: {
  href: string;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={cn("mt-2 text-lg font-semibold text-slate-900", valueClassName)}>{value}</p>
    </Link>
  );
}

const InvestmentsAndLoans = memo(function InvestmentsAndLoans({ data }: { data: ExecutiveDashboardData }) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <InsightCard title="Investments" caption="Portfolio snapshot">
        <div className="grid gap-3 sm:grid-cols-2">
          <InteractiveMetricCard
            href="/investments"
            label="Current Portfolio Value"
            value={formatCurrency(data.investments.currentPortfolio, { maximumFractionDigits: 0 })}
            valueClassName={valueToneClass(data.investments.currentPortfolio)}
          />
          <InteractiveMetricCard
            href="/investments"
            label="Monthly Investment"
            value={formatCurrency(data.investments.monthlyInvestment, { maximumFractionDigits: 0 })}
            valueClassName={valueToneClass(data.investments.monthlyInvestment)}
          />
          <InteractiveMetricCard
            href="/investments"
            label="Projected Value"
            value={formatCurrency(data.investments.projectedValue, { maximumFractionDigits: 0 })}
            valueClassName={valueToneClass(data.investments.projectedValue)}
          />
          <InteractiveMetricCard
            href="/investments"
            label="Expected CAGR"
            value={formatPercent(data.investments.expectedCagr, { multiply: false })}
            valueClassName={valueToneClass(data.investments.expectedCagr)}
          />
        </div>
      </InsightCard>

      <InsightCard title="Loans" caption={`${data.loans.activeLoans} active loans`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <InteractiveMetricCard
            href="/loans"
            label="Outstanding"
            value={formatCurrency(data.loans.outstanding, { maximumFractionDigits: 0 })}
            valueClassName={valueToneClass(data.loans.outstanding)}
          />
          <InteractiveMetricCard
            href="/loans"
            label="EMI"
            value={formatCurrency(data.loans.emi, { maximumFractionDigits: 0 })}
            valueClassName={valueToneClass(data.loans.emi)}
          />
          <InteractiveMetricCard
            href="/loans"
            label="Interest Rate"
            value={formatPercent(data.loans.interestRate, { multiply: false })}
            valueClassName={valueToneClass(data.loans.interestRate)}
          />
        </div>
      </InsightCard>
    </section>
  );
});

const GoalsSection = memo(function GoalsSection({ data }: { data: ExecutiveDashboardData }) {
  return (
    <InsightCard
      title="Goals"
      caption={`${data.goals.onTrack} on-track, ${data.goals.atRisk} at-risk, ${data.goals.completed} completed`}
    >
      {data.goals.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          No goals configured yet.
        </div>
      ) : (
        <div className="space-y-3">
          {data.goals.items.map((goal) => (
            <Link
              key={goal.id}
              href={`/planning/goals?goalId=${encodeURIComponent(goal.id)}`}
              className="group block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{goal.name}</p>
                <span className="text-sm text-slate-600">{goal.progressPercent.toFixed(1)}%</span>
              </div>
              <div className="mt-3">
                <ProgressBar value={goal.progressPercent} colorClass="bg-blue-600" />
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <p>Target: {formatCurrency(goal.targetAmount, { maximumFractionDigits: 0 })}</p>
                <p>Gap: {formatCurrency(goal.gap, { maximumFractionDigits: 0 })}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </InsightCard>
  );
});

const MonthlySummary = memo(function MonthlySummary({ data }: { data: ExecutiveDashboardData }) {
  return (
    <InsightCard title="Monthly Summary" caption={`As of ${data.asOfLabel || "current period"}`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Income</p>
          <p className={cn("mt-2 text-lg font-semibold", data.monthlySummary.income >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(data.monthlySummary.income, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Expenses</p>
          <p className={cn("mt-2 text-lg font-semibold", data.monthlySummary.expenses >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(data.monthlySummary.expenses, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Savings</p>
          <p className={cn("mt-2 text-lg font-semibold", data.monthlySummary.savings >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(data.monthlySummary.savings, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Investments</p>
          <p className={cn("mt-2 text-lg font-semibold", data.monthlySummary.investments >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(data.monthlySummary.investments, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Net Worth Change</p>
          <p className={cn("mt-2 text-lg font-semibold", data.monthlySummary.netWorthChange >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(data.monthlySummary.netWorthChange, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>
    </InsightCard>
  );
});

export const ExecutiveDashboard = memo(function ExecutiveDashboard({ loading, data, error }: ExecutiveDashboardProps) {
  if (loading) {
    return <LoadingExecutiveState />;
  }

  if (error) {
    return <ErrorCard message={error} />;
  }

  if (!data) {
    return <ErrorCard message="Dashboard data is unavailable." />;
  }

  if (data.emptyState) {
    return (
      <ExecutiveEmptyState
        title="Add financial data to unlock the executive dashboard"
        description="Capture assets, liabilities, investments, and goals to generate a full monthly summary."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/assets">Add Asset</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/liabilities">Add Liability</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/investments">Add Investment</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <SummaryGrid data={data} />
      <InvestmentsAndLoans data={data} />
      <GoalsSection data={data} />
      <MonthlySummary data={data} />
    </div>
  );
});
