import { cn } from "@/lib/utils";

interface LiabilityTypeBadgeProps {
  type: string;
}

const badgeStyles: Record<string, string> = {
  "Home Loan": "bg-slate-100 text-slate-700",
  "Car Loan": "bg-blue-100 text-blue-700",
  "Personal Loan": "bg-amber-100 text-amber-700",
  "Education Loan": "bg-violet-100 text-violet-700",
  "Credit Card": "bg-rose-100 text-rose-700",
  Other: "bg-emerald-100 text-emerald-700",
};

export function LiabilityTypeBadge({ type }: LiabilityTypeBadgeProps) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", badgeStyles[type] ?? "bg-slate-100 text-slate-700")}>{type}</span>;
}
