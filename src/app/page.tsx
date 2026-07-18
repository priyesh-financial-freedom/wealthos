"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { supabase } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let isActive = true;

    async function resolveDestination() {
      if (!supabase) {
        router.replace("/login");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      router.replace(session ? "/dashboard" : "/login");
    }

    void resolveDestination();

    return () => {
      isActive = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-24 text-slate-700">
      <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
        Opening WealthOS
      </div>
    </main>
  );
}
