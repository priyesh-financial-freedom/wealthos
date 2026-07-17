"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setStatusMessage(null);
    setIsSubmitting(true);

    if (!supabase) {
      setStatusMessage("Supabase is not configured yet. Add your environment variables first.");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setStatusMessage(error.message || "Unable to send the reset email right now.");
      setIsSubmitting(false);
      return;
    }

    setStatusMessage("If the email exists, a reset link has been sent. Please check your inbox.");
    setIsSubmitting(false);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          disabled={isSubmitting}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-rose-600">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      {statusMessage ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {statusMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending reset link..." : "Send reset link"}
      </Button>

      <p className="text-sm text-slate-600">
        <Link href="/login" className="font-medium text-slate-700 hover:underline">
          Return to login
        </Link>
      </p>
    </form>
  );
}
