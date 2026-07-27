import { PiggyBank } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetComingSoon, WidgetHeader, WidgetMetric, WidgetMetricGrid } from "@/components/dashboard/WidgetPrimitives";
import { formatCurrency } from "@/lib/formatters";

interface RetirementWidgetProps {
  available: boolean;
  totalRetirementAssets: number;
  plannedTotalRetirementAssets: number | null;
  retirementVariance: number | null;
  accountsCount: number;
}

function formatVariance(value: number | null) {
  if (value === null) {
    return "Coming Soon";
  }

  if (value === 0) {
    return formatCurrency(0, { maximumFractionDigits: 0 });
  }

  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${formatCurrency(Math.abs(value), { maximumFractionDigits: 0 })}`;
}

export function RetirementWidget({ available, totalRetirementAssets, plannedTotalRetirementAssets, retirementVariance, accountsCount }: RetirementWidgetProps) {
  const varianceTone = retirementVariance === null ? "default" : retirementVariance >= 0 ? "positive" : "warning";

  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Retirement" title="Retirement readiness" icon={PiggyBank} iconTone="emerald" />

      {!available ? (
        <WidgetComingSoon />
      ) : (
        <WidgetMetricGrid>
          <WidgetMetric label="Current" value={formatCurrency(totalRetirementAssets, { maximumFractionDigits: 0 })} />
          <WidgetMetric
            label="Planned"
            value={plannedTotalRetirementAssets === null ? "Coming Soon" : formatCurrency(plannedTotalRetirementAssets, { maximumFractionDigits: 0 })}
          />
          <WidgetMetric label="Variance" value={formatVariance(retirementVariance)} tone={varianceTone} />
          <WidgetMetric label="Tracked accounts" value={accountsCount.toLocaleString("en-IN")} />
        </WidgetMetricGrid>
      )}
    </DashboardCard>
  );
}
