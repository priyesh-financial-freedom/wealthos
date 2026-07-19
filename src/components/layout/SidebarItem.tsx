import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  nested?: boolean;
}

export function SidebarItem({ href, label, icon: Icon, active, collapsed, nested = false }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        nested && "py-2 text-[13px] font-medium",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", nested && "h-3.5 w-3.5")} />
      {!collapsed ? <span>{label}</span> : null}
    </Link>
  );
}
