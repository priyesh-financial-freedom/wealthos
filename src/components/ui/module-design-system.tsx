import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface ModuleKpiGridProps {
  children: React.ReactNode;
  className?: string;
}

export function ModuleKpiGrid({ children, className }: ModuleKpiGridProps) {
  return <section className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>{children}</section>;
}

interface ModuleCardProps {
  children: React.ReactNode;
  className?: string;
}

export function ModuleCard({ children, className }: ModuleCardProps) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70", className)}>{children}</div>;
}

interface ModuleInsightPanelProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

export function ModuleInsightPanel({ title, description, children, className }: ModuleInsightPanelProps) {
  return (
    <ModuleCard className={cn("space-y-3", className)}>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </ModuleCard>
  );
}

interface ModuleOnboardingStateProps {
  title: string;
  description: string;
  steps?: string[];
  className?: string;
}

export function ModuleOnboardingState({ title, description, steps, className }: ModuleOnboardingStateProps) {
  return (
    <ModuleCard className={cn("bg-slate-50", className)}>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      {steps && steps.length > 0 ? (
        <>
          <p className="mt-4 text-sm font-medium text-slate-800">Recommended order:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      ) : null}
    </ModuleCard>
  );
}

interface ModuleCategoryGridProps {
  children: React.ReactNode;
  className?: string;
}

export function ModuleCategoryGrid({ children, className }: ModuleCategoryGridProps) {
  return <section className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>{children}</section>;
}

export function ModuleCardArrow() {
  return <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />;
}
