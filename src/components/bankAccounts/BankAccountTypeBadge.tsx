import type { BankAccountType } from "@/types/bankAccount";

interface BankAccountTypeBadgeProps {
  type: BankAccountType;
}

const styles: Record<BankAccountType, string> = {
  Savings: "bg-emerald-100 text-emerald-800",
  Salary: "bg-sky-100 text-sky-800",
  Current: "bg-indigo-100 text-indigo-800",
  Cash: "bg-amber-100 text-amber-800",
  Wallet: "bg-violet-100 text-violet-800",
};

export function BankAccountTypeBadge({ type }: BankAccountTypeBadgeProps) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[type]}`}>{type}</span>;
}
