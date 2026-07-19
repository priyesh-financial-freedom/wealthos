import { cn } from "@/lib/utils";

interface ContentContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentContainer({ children, className }: ContentContainerProps) {
  return <section className={cn("rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 sm:p-6", className)}>{children}</section>;
}
