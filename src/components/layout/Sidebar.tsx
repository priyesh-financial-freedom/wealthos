import { ArrowRightLeft, BarChart3, CircleDollarSign, Coins, CreditCard, FileText, Landmark, LayoutDashboard, Medal, PiggyBank, Receipt, ReceiptText, Settings, ShieldCheck, Sparkles, Target, TrendingUp, Upload, Wallet } from "lucide-react";
import Link from "next/link";

import { SidebarItem } from "@/components/layout/SidebarItem";

interface SidebarProps {
  items: Array<{
    href: string;
    label: string;
    icon: string;
  }>;
  activeHref: string;
  collapsed: boolean;
}

const iconMap = {
  LayoutDashboard,
  Landmark,
  Wallet,
  CreditCard,
  TrendingUp,
  Receipt,
  ReceiptText,
  Target,
  PiggyBank,
  ShieldCheck,
  FileText,
  BarChart3,
  Sparkles,
  Upload,
  Settings,
  ArrowRightLeft,
  CircleDollarSign,
  Medal,
  Coins,
};

export function Sidebar({ items, activeHref, collapsed }: SidebarProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap] ?? LayoutDashboard;

            return (
              <SidebarItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={Icon}
                active={activeHref === item.href}
                collapsed={collapsed}
              />
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-slate-200 px-3 py-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            U
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">User</p>
              <p className="truncate text-xs text-slate-500">Signed in</p>
            </div>
          ) : null}
          {!collapsed ? (
            <Link
              href="/login"
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Logout
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
