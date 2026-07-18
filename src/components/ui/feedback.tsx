"use client";

import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ToastProps {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}

export function ToastViewport({ type, message, onDismiss }: ToastProps) {
  if (!message) {
    return null;
  }

  const Icon = type === "success" ? CheckCircle2 : AlertCircle;
  const tone = type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${tone}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
