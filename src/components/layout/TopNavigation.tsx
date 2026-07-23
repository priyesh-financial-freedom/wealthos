"use client";

import { Bell, Menu, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

interface TopNavigationProps {
  onMenuClick: () => void;
}

export function TopNavigation({ onMenuClick }: TopNavigationProps) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      if (!supabase) {
        console.warn("[TopNavigation] Supabase client not configured; skipping loadUser");
        return;
      }

      const startedAt = Date.now();
      console.log("[TopNavigation] before getSession");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("[TopNavigation] after getSession", {
        durationMs: Date.now() - startedAt,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });
      setEmail(session?.user?.email ?? null);
    }

    loadUser();
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="xl:hidden" onClick={onMenuClick}>
          <Menu className="h-4 w-4" />
        </Button>

        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
            W
          </div>
          <div className="hidden flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 sm:flex">
            <Search className="mr-2 h-4 w-4" />
            <span>Global search</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:flex">
            <Sparkles className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">{email ?? "User"}</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Logout</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
