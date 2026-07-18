import { ArrowRightLeft, BarChart3, CreditCard, FileText, Landmark, LayoutDashboard, PiggyBank, Receipt, ReceiptText, Settings, ShieldCheck, Sparkles, Target, TrendingUp, Wallet } from "lucide-react";

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
  Settings,
  ArrowRightLeft,
};

export function Sidebar({ items, activeHref, collapsed }: SidebarProps) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
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
  );
}
