"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ResetPasswordValues) {
    setMessage(null);
    setIsSubmitting(true);

    if (!supabase) {
      setMessage("Supabase is not configured yet. Add your environment variables first.");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      setMessage(error.message || "Unable to update your password right now.");
      setIsSubmitting(false);
      return;
    }

    setMessage("Your password has been updated. Redirecting to the dashboard...");
    setIsSubmitting(false);
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Reset password</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Choose a new password</h1>
          <p className="mt-2 text-sm text-slate-600">Set a new password for your account.</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-rose-600">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-sm text-rose-600">{form.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>

          {message ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating password..." : "Update password"}
          </Button>
        </form>
      </div>
    </main>
  );
}
