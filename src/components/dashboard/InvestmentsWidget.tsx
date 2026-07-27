import { BarChart3 } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetComingSoon, WidgetHeader, WidgetMetric, WidgetMetricGrid } from "@/components/dashboard/WidgetPrimitives";
import { formatCurrency } from "@/lib/formatters";

interface InvestmentsWidgetProps {
  available: boolean;
  currentPortfolio: number;
  plannedPortfolio: number | null;
  portfolioVariance: number | null;
  monthlyInvestment: number;
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

export function InvestmentsWidget({ available, currentPortfolio, plannedPortfolio, portfolioVariance, monthlyInvestment }: InvestmentsWidgetProps) {
  const varianceTone = portfolioVariance === null ? "default" : portfolioVariance >= 0 ? "positive" : "warning";

  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Investments" title="Portfolio snapshot" icon={BarChart3} iconTone="blue" />

      {!available ? (
        <WidgetComingSoon />
      ) : (
        <WidgetMetricGrid>
          <WidgetMetric label="Current" value={formatCurrency(currentPortfolio, { maximumFractionDigits: 0 })} />
          <WidgetMetric label="Planned" value={plannedPortfolio === null ? "Coming Soon" : formatCurrency(plannedPortfolio, { maximumFractionDigits: 0 })} />
          <WidgetMetric label="Variance" value={formatVariance(portfolioVariance)} tone={varianceTone} />
          <WidgetMetric label="Monthly contribution" value={formatCurrency(monthlyInvestment, { maximumFractionDigits: 0 })} />
        </WidgetMetricGrid>
      )}
    </DashboardCard>
  );
}
