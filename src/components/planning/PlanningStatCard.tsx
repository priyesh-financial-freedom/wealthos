import { DashboardCard } from "@/components/dashboard/DashboardCard";

interface PlanningStatCardProps {
  label: string;
  value: string;
  detail: string;
}

export function PlanningStatCard({ label, value, detail }: PlanningStatCardProps) {
  return (
    <DashboardCard className="h-full">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
    </DashboardCard>
  );
}
