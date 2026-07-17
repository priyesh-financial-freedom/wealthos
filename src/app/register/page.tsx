import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Create account</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Register for WealthOS</h1>
          <p className="mt-2 text-sm text-slate-600">Create an account to access the protected workspace.</p>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
