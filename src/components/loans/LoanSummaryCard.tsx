import { BadgeIndianRupee, CirclePercent, Landmark, ReceiptText, TimerReset } from "lucide-react";
import type { ComponentType } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { LoanSummary } from "@/services/loanManagement";

interface LoanSummaryCardProps {
  summary: LoanSummary;
}

function Item({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <DashboardCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </DashboardCard>
  );
}

export function LoanSummaryCard({ summary }: LoanSummaryCardProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Item label="Total Outstanding" value={formatCurrency(summary.totalOutstanding, { maximumFractionDigits: 0 })} icon={BadgeIndianRupee} />
      <Item label="Total EMI" value={formatCurrency(summary.totalEmi, { maximumFractionDigits: 0 })} icon={ReceiptText} />
      <Item label="Average Interest" value={formatPercent(summary.averageInterestRate, { digits: 1, multiply: false })} icon={CirclePercent} />
      <Item label="Active Loans" value={String(summary.activeLoans)} icon={Landmark} />
      <Item label="Upcoming Prepayments" value={String(summary.upcomingPrepayments)} icon={TimerReset} />
    </section>
  );
}
