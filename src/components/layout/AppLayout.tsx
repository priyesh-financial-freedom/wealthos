"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [requestedType, setRequestedType] = useState<string | null>(null);

  useEffect(() => {
    const selectedType = new URLSearchParams(window.location.search).get("type");
    setRequestedType(selectedType);
  }, []);

  const activeHref = pathname === "/retirement" && (requestedType === "EPF" || requestedType === "PPF" || requestedType === "NPS")
    ? `/retirement?type=${requestedType}`
    : pathname;

  return (
    <div className="h-dvh min-h-screen bg-slate-50 text-slate-900">
      <div className="flex h-full overflow-hidden">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden h-screen overflow-hidden border-r border-slate-200 bg-white/95 backdrop-blur xl:flex xl:flex-col",
            collapsed ? "w-24" : "w-72",
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
                W
              </div>
              {!collapsed ? <span className="text-base font-semibold">WealthOS</span> : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
          <Sidebar activeHref={activeHref} collapsed={collapsed} />
        </aside>

        <div className={cn("flex h-full min-h-0 flex-1 flex-col overflow-hidden", collapsed ? "xl:pl-24" : "xl:pl-72")}>
          <TopNavigation onMenuClick={() => setMobileOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>

      <div className={cn("fixed inset-0 z-40 bg-slate-950/40 xl:hidden", mobileOpen ? "block" : "hidden")} onClick={() => setMobileOpen(false)} />
      <div className={cn("fixed inset-y-0 left-0 z-50 h-screen w-72 flex-col overflow-hidden border-r border-slate-200 bg-white xl:hidden", mobileOpen ? "flex" : "hidden")}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
              W
            </div>
            <span className="text-base font-semibold">WealthOS</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(false)}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <Sidebar activeHref={activeHref} collapsed={false} />
      </div>
    </div>
  );
}
