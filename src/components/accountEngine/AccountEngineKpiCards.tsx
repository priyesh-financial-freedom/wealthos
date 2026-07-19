import { ArrowDownCircle, ArrowUpCircle, Coins, Scale, Wallet } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { UniversalDashboardSummary } from "@/types/universalAccount";

interface AccountEngineKpiCardsProps {
  summary: UniversalDashboardSummary;
}

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatRatio(value: number | null) {
  if (value === null) {
    return "—";
  }
  return `${value.toFixed(2)}x`;
}

export function AccountEngineKpiCards({ summary }: AccountEngineKpiCardsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <KpiCard title="Total Portfolio" value={formatMoney(summary.totalCurrentValue)} subtitle="Combined value across account types" icon={Wallet} tone="positive" />
      <KpiCard title="Total Cash" value={formatMoney(summary.totalCash)} subtitle="Liquid balances across cash accounts" icon={Coins} tone="positive" />
      <KpiCard title="Monthly Inflow" value={formatMoney(summary.monthlyInflow)} subtitle="Latest month contributions" icon={ArrowUpCircle} tone="positive" />
      <KpiCard title="Monthly Outflow" value={formatMoney(summary.monthlyOutflow)} subtitle="Latest month withdrawals" icon={ArrowDownCircle} tone="warning" />
      <KpiCard title="Liquidity Ratio" value={formatRatio(summary.liquidityRatio)} subtitle="Cash divided by liabilities" icon={Scale} tone={summary.liquidityRatio && summary.liquidityRatio >= 1 ? "positive" : "default"} />
    </section>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning";
}) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-rose-200 bg-rose-50 text-rose-900",
  };

  return (
    <DashboardCard className={toneClasses[tone]}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{subtitle}</p>
    </DashboardCard>
  );
}
