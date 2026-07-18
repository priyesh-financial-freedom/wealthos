"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNavigation } from "@/components/layout/TopNavigation";

interface AppLayoutProps {
  children: React.ReactNode;
}

const sidebarItems = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/balance-sheet", label: "Balance Sheet", icon: "Scale" },
  { href: "/bank-accounts", label: "Bank Accounts", icon: "Landmark" },
  { href: "/accounts", label: "Accounts", icon: "Wallet" },
  { href: "/assets", label: "Assets", icon: "Wallet" },
  { href: "/fixed-deposits", label: "Fixed Deposits", icon: "CircleDollarSign" },
  { href: "/gold", label: "Gold", icon: "Medal" },
  { href: "/silver", label: "Silver", icon: "Coins" },
  { href: "/liabilities", label: "Liabilities", icon: "CreditCard" },
  { href: "/investments", label: "Investments", icon: "TrendingUp" },
  { href: "/history", label: "History", icon: "ArrowRightLeft" },
  { href: "/income", label: "Income", icon: "Receipt" },
  { href: "/expenses", label: "Expenses", icon: "ReceiptText" },
  { href: "/goals", label: "Goals", icon: "Target" },
  { href: "/retirement", label: "Retirement", icon: "PiggyBank" },
  { href: "/insurance", label: "Insurance", icon: "ShieldCheck" },
  { href: "/documents", label: "Documents", icon: "FileText" },
  { href: "/reports", label: "Reports", icon: "BarChart3" },
  { href: "/ai", label: "AI Advisor", icon: "Sparkles" },
  { href: "/import-data", label: "Import Data", icon: "Upload" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
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
          <Sidebar items={sidebarItems} activeHref={pathname} collapsed={collapsed} />
        </aside>

        <div className={cn("flex min-h-screen flex-1 flex-col", collapsed ? "xl:pl-24" : "xl:pl-72")}>
          <TopNavigation onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
        <Sidebar items={sidebarItems} activeHref={pathname} collapsed={false} />
      </div>
    </div>
  );
}
