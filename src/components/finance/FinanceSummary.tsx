import { NetWorthCard } from "@/components/finance/NetWorthCard";
import type { FinanceSummarySnapshot } from "@/services/finance";

interface FinanceSummaryProps {
  summary: FinanceSummarySnapshot;
}

export function FinanceSummary({ summary }: FinanceSummaryProps) {
  const cards = [
    { title: "Total Assets", value: `$${summary.totalAssets.toLocaleString()}`, subtitle: "Current value of holdings", href: "/assets" },
    { title: "Total Liabilities", value: `$${summary.totalLiabilities.toLocaleString()}`, subtitle: "Outstanding debt obligations", href: "/liabilities", tone: "warning" as const },
    { title: "Net Worth", value: `$${summary.netWorth.toLocaleString()}`, subtitle: "Assets minus liabilities", href: "/assets", tone: "positive" as const },
    { title: "Debt Ratio", value: `${(summary.debtRatio * 100).toFixed(1)}%`, subtitle: "Liabilities as a share of assets", href: "/liabilities" },
    { title: "Largest Asset", value: summary.largestAsset ? `$${summary.largestAsset.current_value.toLocaleString()}` : "—", subtitle: summary.largestAsset ? summary.largestAsset.asset_name : "No assets yet", href: "/assets" },
    { title: "Largest Liability", value: summary.largestLiability ? `$${summary.largestLiability.outstanding_amount.toLocaleString()}` : "—", subtitle: summary.largestLiability ? summary.largestLiability.account_name : "No liabilities yet", href: "/liabilities", tone: "warning" as const },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <NetWorthCard key={card.title} title={card.title} value={card.value} subtitle={card.subtitle} tone={card.tone} href={card.href} />
      ))}
    </section>
  );
}
