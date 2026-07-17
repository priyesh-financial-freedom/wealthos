import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Welcome back</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Log in to WealthOS</h1>
          <p className="mt-2 text-sm text-slate-600">Use your Supabase credentials to continue.</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-slate-600">
          Need an account?{" "}
          <Link href="/register" className="font-medium text-slate-700 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
