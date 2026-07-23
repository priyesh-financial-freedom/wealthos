"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

export function Header() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setEmail(session?.user?.email ?? null);
      setLoading(false);
    }

    loadUser();

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    }) ?? { data: { subscription: { unsubscribe() {} } } };

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    if (!supabase) {
      setErrorMessage("Supabase is not configured yet.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message || "Unable to sign out right now.");
      setLoading(false);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">WealthOS</p>
          <p className="text-sm text-slate-500">Protected workspace</p>
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-sm text-slate-500">Loading...</span>
          ) : (
            <span className="text-sm text-slate-700">{email ?? "Signed out"}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={loading}>
            Logout
          </Button>
        </div>
      </div>
      {errorMessage ? (
        <div className="mx-auto max-w-6xl px-6 pb-3 text-sm text-rose-600">{errorMessage}</div>
      ) : null}
    </header>
  );
}
