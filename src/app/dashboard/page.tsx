import { Header } from "@/components/layout/Header";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Protected dashboard
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">
            Your WealthOS workspace
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            This page is only accessible to authenticated users.
          </p>
        </div>
      </main>
    </div>
  );
}
