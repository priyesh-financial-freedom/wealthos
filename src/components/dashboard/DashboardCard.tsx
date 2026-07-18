import { cn } from "@/lib/utils";

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function DashboardCard({ children, className, id }: DashboardCardProps) {
  return (
    <div id={id} className={cn("rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70", className)}>
      {children}
    </div>
  );
}
