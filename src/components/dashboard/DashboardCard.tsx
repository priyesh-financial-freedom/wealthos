import { cn } from "@/lib/utils";

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function DashboardCard({ children, className, id }: DashboardCardProps) {
  return (
    <div id={id} className={cn("rounded-3xl bg-white p-7 shadow-[0_28px_64px_-42px_rgba(15,23,42,0.45)]", className)}>
      {children}
    </div>
  );
}
