import { Landmark } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetComingSoon, WidgetHeader, WidgetMetric, WidgetMetricGrid } from "@/components/dashboard/WidgetPrimitives";
import { formatCurrency } from "@/lib/formatters";

interface LiabilitiesWidgetProps {
  available: boolean;
  outstanding: number;
  plannedOutstanding: number | null;
  outstandingVariance: number | null;
  emi: number;
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

export function LiabilitiesWidget({ available, outstanding, plannedOutstanding, outstandingVariance, emi }: LiabilitiesWidgetProps) {
  const varianceTone = outstandingVariance === null ? "default" : outstandingVariance <= 0 ? "positive" : "warning";

  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Liabilities" title="Debt snapshot" icon={Landmark} iconTone="rose" />

      {!available ? (
        <WidgetComingSoon />
      ) : (
        <WidgetMetricGrid>
          <WidgetMetric label="Current" value={formatCurrency(outstanding, { maximumFractionDigits: 0 })} />
          <WidgetMetric label="Planned" value={plannedOutstanding === null ? "Coming Soon" : formatCurrency(plannedOutstanding, { maximumFractionDigits: 0 })} />
          <WidgetMetric label="Variance" value={formatVariance(outstandingVariance)} tone={varianceTone} />
          <WidgetMetric label="Monthly EMI" value={formatCurrency(emi, { maximumFractionDigits: 0 })} />
        </WidgetMetricGrid>
      )}
    </DashboardCard>
  );
}
