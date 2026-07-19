import { ArrowUpRight } from "lucide-react";

import type { FinanceSummarySnapshot } from "@/services/finance";

interface ExecutiveSummaryProps {
  summary: FinanceSummarySnapshot;
}

export function ExecutiveSummary({ summary }: ExecutiveSummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">Executive Summary</p>
          <h3 className="mt-2 text-2xl font-semibold">Net worth remains resilient with a balanced debt profile.</h3>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            The current structure shows a net worth of <span className="font-semibold text-white">₹{summary.netWorth.toLocaleString("en-IN")}</span> with a debt ratio of <span className="font-semibold text-white">{(summary.debtRatio * 100).toFixed(1)}%</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-slate-100">
          View insights <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
