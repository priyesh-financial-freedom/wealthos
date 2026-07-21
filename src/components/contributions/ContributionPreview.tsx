import { Sparkles } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ContributionSchedule } from "@/components/contributions/ContributionSchedule";
import { formatCurrency } from "@/lib/formatters";
import type { ContributionPreview as ContributionPreviewModel } from "@/types/contributionPolicy";

interface ContributionPreviewProps {
  preview: ContributionPreviewModel | null;
}

export function ContributionPreview({ preview }: ContributionPreviewProps) {
  if (!preview) {
    return (
      <DashboardCard>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-slate-500" />
          <p className="text-sm text-slate-600">Select a policy and generate a preview to inspect future contribution schedule.</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Preview: {preview.policyName}</h3>
          <p className="text-sm text-slate-600">Generated on {new Date(preview.generatedAt).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Projected Total</p>
          <p className="text-xl font-semibold text-slate-900">{formatCurrency(preview.projectedTotal, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Horizon</p>
          <p className="text-base font-semibold text-slate-900">{preview.horizonMonths} months</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Contribution Entries</p>
          <p className="text-base font-semibold text-slate-900">{preview.schedule.length}</p>
        </div>
      </div>

      <ContributionSchedule items={preview.schedule} />
    </DashboardCard>
  );
}
