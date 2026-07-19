import { cn } from "@/lib/utils";

interface FormGridProps {
  children: React.ReactNode;
  className?: string;
}

export function FormGrid({ children, className }: FormGridProps) {
  return <div className={cn("grid gap-4 md:grid-cols-2", className)}>{children}</div>;
}

interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
}

export function FormField({ children, className }: FormFieldProps) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function FormActions({ children, className }: FormActionsProps) {
  return <div className={cn("sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4", className)}>{children}</div>;
}
