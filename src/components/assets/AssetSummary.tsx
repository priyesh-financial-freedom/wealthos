import { TrendingUp } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { Asset } from "@/types/asset";

interface AssetSummaryProps {
  assets: Asset[];
}

export function AssetSummary({ assets }: AssetSummaryProps) {
  const totalValue = assets.reduce((sum, asset) => sum + asset.current_value, 0);
  const totalPurchases = assets.reduce((sum, asset) => sum + (asset.purchase_value ?? 0), 0);
  const gain = totalValue - totalPurchases;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <DashboardCard>
        <p className="text-sm text-slate-500">Total value</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">${totalValue.toLocaleString()}</p>
      </DashboardCard>
      <DashboardCard>
        <p className="text-sm text-slate-500">Cost basis</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">${totalPurchases.toLocaleString()}</p>
      </DashboardCard>
      <DashboardCard>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Unrealized gain</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">${gain.toLocaleString()}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
