import { BriefcaseBusiness, CircleDollarSign, Link2, ShieldCheck } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { Account } from "@/types/account";

interface AccountSummaryProps {
  accounts: Account[];
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AccountSummary({ accounts }: AccountSummaryProps) {
  const totalValue = accounts.reduce((sum, account) => sum + Number(account.current_value ?? 0), 0);
  const activeCount = accounts.filter((account) => account.status === "active").length;
  const linkedCount = accounts.filter((account) => Boolean(account.linked_item_type && account.linked_item_id)).length;
  const categories = new Set(accounts.map((account) => account.category)).size;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <DashboardCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Total Value</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalValue, "USD")}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CircleDollarSign className="h-5 w-5" />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Active Accounts</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{activeCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Linked Items</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{linkedCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Link2 className="h-5 w-5" />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Categories Used</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{categories}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
