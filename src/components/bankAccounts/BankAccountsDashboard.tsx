"use client";

import { CalendarClock, CircleDollarSign, Landmark } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { formatCurrency } from "@/lib/formatters";
import type { BankAccountsDashboardModel } from "@/types/bankAccount";

interface BankAccountsDashboardProps {
  model: BankAccountsDashboardModel;
  emptyState: boolean;
}

export function BankAccountsDashboard({ model, emptyState }: BankAccountsDashboardProps) {
  if (emptyState) {
    return (
      <DashboardCard className="overflow-hidden border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-0 text-white shadow-xl">
        <div className="p-6 lg:p-8">
          <p className="text-sm font-medium text-slate-300">Cash Position</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">Add your first bank account to start month-end cash tracking.</h3>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">This workspace tracks month-end balances only. Add accounts and monthly history to monitor cash position over time.</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <MetricCard title="Total Cash" value={formatCurrency(model.totalCash, { maximumFractionDigits: 0 })} subtitle="Across active accounts included in cash position" icon={CircleDollarSign} />
      <MetricCard title="Active Accounts" value={String(model.activeAccountsCount)} subtitle="Accounts currently marked active" icon={Landmark} />
      <MetricCard title="Last Updated Month" value={model.lastUpdatedMonth} subtitle="Latest month with balance history" icon={CalendarClock} />
    </section>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <DashboardCard>
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
