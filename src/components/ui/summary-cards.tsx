import { cn } from "@/lib/utils";

interface SummaryCardGridProps {
  children: React.ReactNode;
  className?: string;
}

export function SummaryCardGrid({ children, className }: SummaryCardGridProps) {
  return <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

interface SummaryCardProps {
  title: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: "default" | "positive" | "warning" | "dark";
  className?: string;
}

export function SummaryCard({ title, value, description, icon, tone = "default", className }: SummaryCardProps) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    dark: "border-[#2b2414] bg-[linear-gradient(135deg,#09090b_0%,#111827_60%,#1f2937_100%)] text-white",
  };

  return (
    <article className={cn("rounded-3xl border p-5 shadow-sm shadow-slate-200/70", toneClasses[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm font-medium", tone === "dark" ? "text-slate-300" : "text-slate-500")}>{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        {icon ? <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tone === "dark" ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700")}>{icon}</div> : null}
      </div>
      {description ? <p className={cn("mt-3 text-sm", tone === "dark" ? "text-slate-300" : "text-slate-600")}>{description}</p> : null}
    </article>
  );
}
