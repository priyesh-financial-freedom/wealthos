import { ArrowDownRight, ArrowUpRight, Layers, Landmark, Wallet } from "lucide-react";

import { ModuleCard } from "@/components/ui/module-design-system";
import { formatCurrency } from "@/lib/formatters";

interface InvestmentSummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  tone?: "default" | "positive" | "warning";
  icon?: "wallet" | "change" | "count" | "allocation";
}

const toneClass: Record<NonNullable<InvestmentSummaryCardProps["tone"]>, string> = {
  default: "border-slate-200 bg-white",
  positive: "border-emerald-200 bg-emerald-50",
  warning: "border-rose-200 bg-rose-50",
};

function IconForType({ icon, positiveChange }: { icon: InvestmentSummaryCardProps["icon"]; positiveChange?: boolean }) {
  if (icon === "wallet") {
    return <Wallet className="h-4 w-4 text-slate-600" />;
  }

  if (icon === "change") {
    return positiveChange ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-rose-600" />;
  }

  if (icon === "count") {
    return <Landmark className="h-4 w-4 text-slate-600" />;
  }

  return <Layers className="h-4 w-4 text-slate-600" />;
}

export function InvestmentSummaryCard({ title, value, subtitle, tone = "default", icon = "allocation" }: InvestmentSummaryCardProps) {
  const positiveChange = !value.trim().startsWith("-");

  return (
    <ModuleCard className={toneClass[tone]}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-xs text-slate-600">{subtitle}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <IconForType icon={icon} positiveChange={positiveChange} />
        </div>
      </div>
    </ModuleCard>
  );
}

export function formatSignedCurrency(value: number): string {
  const absolute = formatCurrency(Math.abs(value), { maximumFractionDigits: 0 });
  return value < 0 ? `-${absolute}` : absolute;
}
