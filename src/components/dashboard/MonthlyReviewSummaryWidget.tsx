import Link from "next/link";
import { History } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { WidgetHeader, WidgetMetric, WidgetMetricGrid } from "@/components/dashboard/WidgetPrimitives";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { ExecutiveDashboardData } from "@/components/dashboard/dashboardTypes";

interface MonthlyReviewSummaryWidgetProps {
  summary: ExecutiveDashboardData["monthlyReviewSummary"];
}

function metricValue(value: number | null, kind: "currency" | "percent") {
  if (value === null) {
    return "Data required";
  }

  if (kind === "currency") {
    return formatCurrency(value, { maximumFractionDigits: 0 });
  }

  return formatPercent(value / 100, { digits: 1, multiply: true });
}

export function MonthlyReviewSummaryWidget({ summary }: MonthlyReviewSummaryWidgetProps) {
  return (
    <DashboardCard>
      <WidgetHeader eyebrow="Monthly monitoring" title="Monthly review summary" icon={History} iconTone="cyan" />

      {!summary.available ? (
        <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">No monthly snapshots yet</div>
      ) : (
        <WidgetMetricGrid>
          <WidgetMetric label="Month" value={summary.month ?? "Data required"} />
          <WidgetMetric label="Net worth change" value={metricValue(summary.netWorthChange, "currency")} tone={summary.netWorthChange !== null && summary.netWorthChange >= 0 ? "positive" : "warning"} />
          <WidgetMetric label="Savings rate" value={metricValue(summary.savingsRate, "percent")} />
          <WidgetMetric label="Debt reduction" value={metricValue(summary.debtReduction, "currency")} tone={summary.debtReduction !== null && summary.debtReduction >= 0 ? "positive" : "warning"} />
          <WidgetMetric label="Goal progress" value={summary.goalProgress === null ? "Data required" : `${Math.round(summary.goalProgress)}%`} />
          <WidgetMetric
            label="Retirement readiness change"
            value={summary.retirementReadinessChange === null ? "Data required" : `${summary.retirementReadinessChange >= 0 ? "+" : ""}${summary.retirementReadinessChange.toFixed(1)}%`}
            tone={summary.retirementReadinessChange !== null && summary.retirementReadinessChange >= 0 ? "positive" : "warning"}
          />
        </WidgetMetricGrid>
      )}

      <div className="mt-5">
        <Button asChild variant="outline">
          <Link href="/monthly-review">{summary.ctaLabel}</Link>
        </Button>
      </div>
    </DashboardCard>
  );
}
