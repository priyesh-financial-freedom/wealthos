import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24 text-slate-900">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          WealthOS foundation
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Production-ready project scaffold is ready.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          This starter includes the Next.js app router, TypeScript, Tailwind,
          Supabase client wiring, and a shadcn-style UI foundation without any
          business features.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button>Get started</Button>
          <Button variant="outline">Review structure</Button>
        </div>
      </div>
    </main>
  );
}
