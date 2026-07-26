import { formatCurrency } from "@/lib/formatters";
import type { Investment } from "@/types/investment";

interface InvestmentDetailHeaderProps {
  investment: Investment;
}

export function InvestmentDetailHeader({ investment }: InvestmentDetailHeaderProps) {
  const gainLoss = Number(investment.current_value ?? 0) - Number(investment.cost_value ?? investment.cost_basis ?? 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{investment.investment_type}</p>
      <h3 className="mt-1 text-lg font-semibold text-slate-900">{investment.investment_name}</h3>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <div>
          <p className="text-slate-500">Current Value</p>
          <p className="font-medium text-slate-900">{formatCurrency(investment.current_value, { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-slate-500">Cost Value</p>
          <p className="font-medium text-slate-900">{formatCurrency(investment.cost_value ?? investment.cost_basis, { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-slate-500">Gain / Loss</p>
          <p className={gainLoss >= 0 ? "font-medium text-emerald-700" : "font-medium text-rose-700"}>
            {formatCurrency(gainLoss, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
    </div>
  );
}
