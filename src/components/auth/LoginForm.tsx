"use client";

import { Suspense } from "react";

import { LoginFormContent } from "@/components/auth/LoginFormContent";

export function LoginForm() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading form...</p>}>
      <LoginFormContent />
    </Suspense>
  );
}
