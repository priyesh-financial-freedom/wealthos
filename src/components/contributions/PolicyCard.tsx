import { Copy, PauseCircle, PlayCircle, Pencil, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { ContributionPolicy } from "@/types/contributionPolicy";

interface PolicyCardProps {
  policy: ContributionPolicy;
  onEdit: (policy: ContributionPolicy) => void;
  onDuplicate: (policy: ContributionPolicy) => void;
  onToggleStatus: (policy: ContributionPolicy) => void;
  onPreview: (policy: ContributionPolicy) => void;
}

function frequencyLabel(frequency: ContributionPolicy["frequency"]) {
  if (frequency === "MONTHLY") {
    return "Monthly";
  }

  if (frequency === "QUARTERLY") {
    return "Quarterly";
  }

  return "Annually";
}

function growthLabel(policy: ContributionPolicy) {
  if (policy.growthStrategy === "STEP_UP_PERCENTAGE") {
    return `${policy.growthRate ?? 0}% annual step-up`;
  }

  if (policy.growthStrategy === "STEP_UP_AMOUNT") {
    return `${formatCurrency(policy.growthAmount ?? 0, { maximumFractionDigits: 0 })} annual top-up`;
  }

  return "Fixed amount";
}

export function PolicyCard({ policy, onEdit, onDuplicate, onToggleStatus, onPreview }: PolicyCardProps) {
  const active = policy.status === "ACTIVE";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{policy.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{policy.description || "No description provided."}</p>
        </div>
        <span className={active
          ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700"
          : "rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700"
        }>
          {policy.status}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Contribution</dt>
          <dd className="mt-1 font-semibold text-slate-900">{formatCurrency(policy.amount, { maximumFractionDigits: 0 })}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Frequency</dt>
          <dd className="mt-1 font-semibold text-slate-900">{frequencyLabel(policy.frequency)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Growth</dt>
          <dd className="mt-1 font-semibold text-slate-900">{growthLabel(policy)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Window</dt>
          <dd className="mt-1 font-semibold text-slate-900">{policy.startDate} {policy.endDate ? `to ${policy.endDate}` : "onward"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onEdit(policy)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button type="button" variant="outline" onClick={() => onDuplicate(policy)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </Button>
        <Button type="button" variant="outline" onClick={() => onPreview(policy)}>
          <Sparkles className="mr-2 h-4 w-4" />
          Preview
        </Button>
        <Button type="button" variant={active ? "outline" : "default"} onClick={() => onToggleStatus(policy)}>
          {active ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {active ? "Pause" : "Resume"}
        </Button>
      </div>
    </article>
  );
}
