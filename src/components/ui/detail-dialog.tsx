"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function DetailDialog({ open, onOpenChange, title, description, children, footer, className }: DetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex max-h-[90vh] w-[min(96vw,1100px)] flex-col gap-0 overflow-hidden p-0", className)}>
        <DialogHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <p className="text-sm text-slate-600">{description}</p> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-6 py-4">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}

interface DetailSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function DetailSection({ title, description, children, className }: DetailSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

interface DetailGridProps {
  children: React.ReactNode;
  className?: string;
}

export function DetailGrid({ children, className }: DetailGridProps) {
  return <div className={cn("grid gap-4 md:grid-cols-2", className)}>{children}</div>;
}

interface DetailItemProps {
  label: string;
  value: React.ReactNode;
}

export function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}
