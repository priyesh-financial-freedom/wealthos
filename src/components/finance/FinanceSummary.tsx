import { NetWorthCard } from "@/components/finance/NetWorthCard";
import type { FinanceSummarySnapshot } from "@/services/finance";

interface FinanceSummaryProps {
  summary: FinanceSummarySnapshot;
}

export function FinanceSummary({ summary }: FinanceSummaryProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <NetWorthCard title="Net Worth" value={`$${summary.netWorth.toLocaleString()}`} subtitle="Assets minus liabilities" tone="positive" />
      <NetWorthCard title="Total Assets" value={`$${summary.totalAssets.toLocaleString()}`} subtitle="Current value of holdings" />
      <NetWorthCard title="Total Liabilities" value={`$${summary.totalLiabilities.toLocaleString()}`} subtitle="Outstanding debt obligations" tone="warning" />
      <NetWorthCard title="Debt Ratio" value={`${(summary.debtRatio * 100).toFixed(1)}%`} subtitle="Liabilities as a share of assets" />
    </section>
  );
}
