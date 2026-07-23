"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginValues) {
    setFormMessage(null);
    setIsSubmitting(true);

    if (!supabase) {
      setFormMessage("Supabase is not configured yet. Add your environment variables first.");
      setIsSubmitting(false);
      return;
    }

    try {
      console.log("1 - before signIn", { email: values.email });
      const result = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      console.log("2 - signIn complete", result);

      if (result.error) {
        setFormMessage(result.error.message || "Unable to log in right now.");
        setIsSubmitting(false);
        return;
      }

      console.log("3 - before getSession");
      const sessionResult = await supabase.auth.getSession();
      console.log("4 - after getSession", sessionResult);

      console.log("5 - before profile fetch");
      const userId = sessionResult.data.session?.user?.id;
      const profileResult = userId
        ? await supabase.from("profiles").select("id").eq("id", userId).maybeSingle()
        : { data: null, error: null };
      console.log("6 - profile loaded", profileResult);

      const nextPath = searchParams.get("next") ?? "/dashboard";
      console.log("7 - before router.push", { nextPath, userId });
      router.push(nextPath);
      console.log("8 - after router.push");
      router.refresh();
    } catch (error) {
      console.error("Login flow failed", error);
      setFormMessage(error instanceof Error ? error.message : "Unexpected login error.");
      setIsSubmitting(false);
    }
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

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={isSubmitting}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-sm text-rose-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      {formMessage ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {formMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Log in"}
      </Button>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <Link href="/register" className="font-medium text-slate-700 hover:underline">
          Create account
        </Link>
        <Link href="/forgot-password" className="font-medium text-slate-700 hover:underline">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
