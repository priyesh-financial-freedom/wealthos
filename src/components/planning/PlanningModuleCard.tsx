import { ArrowRight, ArrowRightLeft, CalendarClock, FolderKanban, PiggyBank, Target, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";

interface PlanningModuleCardProps {
  title: string;
  description: string;
  statusMessage: string;
  actionLabel: string;
  href: string;
  icon: string;
}

const iconMap: Record<string, LucideIcon> = {
  FolderKanban,
  Target,
  PiggyBank,
  ArrowRightLeft,
  CalendarClock,
};

export function PlanningModuleCard({ title, description, statusMessage, actionLabel, href, icon }: PlanningModuleCardProps) {
  const Icon = iconMap[icon] ?? FolderKanban;

  return (
    <DashboardCard className="flex h-full flex-col justify-between gap-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-slate-300/60">
      <div className="space-y-4">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Status</p>
          <p className="mt-1 text-base font-medium tracking-tight text-slate-900">{statusMessage}</p>
        </div>

        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={href} aria-label={actionLabel}>
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </DashboardCard>
  );
}
