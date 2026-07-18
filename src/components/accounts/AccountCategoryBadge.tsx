import type { AccountCategory } from "@/types/account";

interface AccountCategoryBadgeProps {
  category: AccountCategory;
}

const styles: Record<AccountCategory, string> = {
  "Bank Account": "bg-sky-100 text-sky-800",
  Investment: "bg-indigo-100 text-indigo-800",
  Retirement: "bg-violet-100 text-violet-800",
  "Fixed Income": "bg-cyan-100 text-cyan-800",
  "Real Estate": "bg-emerald-100 text-emerald-800",
  Vehicle: "bg-amber-100 text-amber-800",
  "Precious Metals": "bg-yellow-100 text-yellow-800",
  Liability: "bg-rose-100 text-rose-800",
  Insurance: "bg-teal-100 text-teal-800",
  "Credit Card": "bg-orange-100 text-orange-800",
  Other: "bg-slate-100 text-slate-700",
};

export function AccountCategoryBadge({ category }: AccountCategoryBadgeProps) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[category]}`}>{category}</span>;
}
