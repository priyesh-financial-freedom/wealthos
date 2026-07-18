import { cn } from "@/lib/utils";
import type { InvestmentCategory } from "@/types/investment";

interface InvestmentCategoryBadgeProps {
  category: InvestmentCategory;
}

const badgeStyles: Record<InvestmentCategory, string> = {
  "Mutual Funds": "bg-slate-100 text-slate-700",
  Stocks: "bg-blue-100 text-blue-700",
  ETFs: "bg-cyan-100 text-cyan-700",
  Bonds: "bg-amber-100 text-amber-700",
  "Fixed Deposits": "bg-emerald-100 text-emerald-700",
  EPF: "bg-violet-100 text-violet-700",
  PPF: "bg-fuchsia-100 text-fuchsia-700",
  NPS: "bg-indigo-100 text-indigo-700",
  Gold: "bg-yellow-100 text-yellow-800",
  Silver: "bg-zinc-100 text-zinc-700",
  "Sovereign Gold Bonds": "bg-orange-100 text-orange-700",
  Crypto: "bg-rose-100 text-rose-700",
  "Cash Equivalents": "bg-emerald-50 text-emerald-700",
};

export function InvestmentCategoryBadge({ category }: InvestmentCategoryBadgeProps) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", badgeStyles[category])}>{category}</span>;
}