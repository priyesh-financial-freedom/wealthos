import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { ContentCard } from "@/components/layout/ContentCard";
import { getInvestmentCategoryMeta } from "@/components/investments/investmentCategoryMeta";
import { ModuleCardArrow } from "@/components/ui/module-design-system";
import { formatCurrency } from "@/lib/formatters";
import type { InvestmentCategory } from "@/types/investment";

interface InvestmentCategoryCardProps {
  category: InvestmentCategory;
  displayName: string;
  totalValue: number;
  holdingsCount: number;
  monthlyChange: number;
  href: string;
}

export function InvestmentCategoryCard({ category, displayName, totalValue, holdingsCount, monthlyChange, href }: InvestmentCategoryCardProps) {
  const changePositive = monthlyChange >= 0;
  const categoryMeta = getInvestmentCategoryMeta(category);
  const Icon = categoryMeta.icon;
  const hasData = holdingsCount > 0 || totalValue > 0;
  const singularLabel = categoryMeta.singularName;

  return (
    <Link href={href} className="group block">
      <ContentCard className="min-h-48 transition hover:border-slate-300 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{displayName}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(totalValue, { maximumFractionDigits: 0 })}</p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="text-slate-600">{holdingsCount} Holdings</span>
            </div>

            <div className="mt-3 text-sm">
              {hasData ? (
                <span className={changePositive ? "text-emerald-700" : "text-rose-700"}>
                  {changePositive ? <ArrowUpRight className="-mt-0.5 mr-1 inline h-3.5 w-3.5" /> : <ArrowDownRight className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />}
                  {changePositive ? "+" : "-"}
                  {formatCurrency(Math.abs(monthlyChange), { maximumFractionDigits: 0 })} this month
                </span>
              ) : (
                <span className="text-slate-500">Add your first {singularLabel}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <Icon className="h-4 w-4 text-slate-700" />
            </div>
            <ModuleCardArrow />
          </div>
        </div>
      </ContentCard>
    </Link>
  );
}
