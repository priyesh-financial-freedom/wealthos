import { Sparkles } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";

export function AIInsightCard() {
  return (
    <DashboardCard className="h-full">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">AI portfolio insight</h3>
          <p className="mt-2 text-sm text-slate-600">
            Your cash reserve is currently 18% above the recommended target for the next 6 months. Consider rebalancing into long-term growth holdings.
          </p>
        </div>
      </div>
    </DashboardCard>
  );
}
