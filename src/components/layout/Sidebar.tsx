"use client";

import { useState } from "react";
import {
  Banknote,
  BookOpen,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Target,
  House,
  Landmark,
  PiggyBank,
  LayoutDashboard,
  ReceiptText,
  SlidersHorizontal,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface SidebarProps {
  activeHref: string;
  collapsed: boolean;
}

type SidebarGroupKey = "planning" | "assets-investments" | "liabilities" | "reports" | "settings";

function rowLinkClass(params: { active: boolean; level: 1 | 2 | 3; collapsed: boolean }): string {
  const { active, level, collapsed } = params;
  const levelClass =
    level === 1
      ? "text-[14px] font-semibold tracking-[-0.01em]"
      : level === 2
        ? "text-[13px] font-medium"
        : "text-[12px] font-medium";

  return cn(
    "group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200",
    levelClass,
    active
      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_24px_-16px_rgba(37,99,235,0.95)]"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    collapsed && "justify-center px-2",
  );
}

function rowWrapClass(level: 1 | 2 | 3): string {
  if (level === 1) {
    return "";
  }

  if (level === 2) {
    return "ml-5";
  }

  return "ml-10";
}

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: string;
  matchHrefs?: string[];
  children?: SidebarNavItem[];
}

export function Sidebar({ activeHref, collapsed }: SidebarProps) {
  const [expandedGroup, setExpandedGroup] = useState<SidebarGroupKey | null>(null);

  const planningOpen =
    expandedGroup === "planning" ||
    activeHref === "/planning" ||
    activeHref.startsWith("/planning/") ||
    activeHref === "/retirement" ||
    activeHref === "/goals" ||
    activeHref === "/cash-flow" ||
    activeHref === "/income" ||
    activeHref === "/expenses";
  const assetsInvestmentsOpen =
    expandedGroup === "assets-investments" ||
    activeHref === "/assets" ||
    activeHref === "/bank-accounts" ||
    activeHref.startsWith("/investments");
  const liabilitiesOpen = expandedGroup === "liabilities" || activeHref === "/liabilities" || activeHref.startsWith("/liabilities?bucket=");
  const reportsOpen = expandedGroup === "reports" || activeHref.startsWith("/reports/balance-sheet");
  const settingsOpen = expandedGroup === "settings";

  function toggleGroup(group: SidebarGroupKey) {
    setExpandedGroup((current) => (current === group ? null : group));
  }

  const dashboardActive = activeHref === "/dashboard";
  const planningActive =
    activeHref === "/planning" ||
    activeHref.startsWith("/planning/") ||
    activeHref === "/retirement" ||
    activeHref === "/goals" ||
    activeHref === "/cash-flow" ||
    activeHref === "/income" ||
    activeHref === "/expenses";
  const myFinancialPlanActive =
    activeHref === "/planning/my-financial-plan" ||
    activeHref === "/cash-flow" ||
    activeHref === "/income" ||
    activeHref === "/expenses";
  const retirementActive = activeHref === "/planning/retirement" || activeHref === "/retirement";
  const goalsActive = activeHref === "/planning/goals" || activeHref === "/goals";
  const whatIfActive = activeHref === "/planning/scenarios";
  const monthlyReviewActive = activeHref === "/monthly-review";
  const assetsActive = activeHref === "/assets";
  const bankAccountsActive = activeHref === "/bank-accounts";
  const investmentsActive = activeHref === "/investments";
  const assetsInvestmentsActive = assetsActive || bankAccountsActive || investmentsActive;

  const liabilitiesRootActive = activeHref === "/liabilities";
  const homeLoansActive = activeHref === "/liabilities?bucket=home-loans";
  const carLoansActive = activeHref === "/liabilities?bucket=car-loans" || activeHref === "/liabilities?bucket=vehicle-loans";
  const creditCardsActive = activeHref === "/liabilities?bucket=credit-cards";
  const liabilitiesActive = liabilitiesRootActive || homeLoansActive || carLoansActive || creditCardsActive;

  const compensationActive = activeHref === "/compensation";
  const reportsActive = ["/reports", "/history", "/documents"].includes(activeHref) || activeHref.startsWith("/reports/balance-sheet");
  const settingsHomeActive = activeHref === "/settings";
  const settingsFamilyActive = activeHref === "/settings/family" || activeHref === "/settings/household";
  const settingsProfileActive = activeHref === "/settings/my-profile";
  const settingsTargetsActive = activeHref === "/settings/financial-preferences";
  const settingsAssumptionsActive = activeHref === "/settings/planning-assumptions";
  const settingsSystemActive = activeHref === "/settings/system";
  const settingsActive =
    settingsHomeActive ||
    settingsFamilyActive ||
    settingsProfileActive ||
    settingsTargetsActive ||
    settingsAssumptionsActive ||
    settingsSystemActive;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-2">
          <div className={rowWrapClass(1)}>
            <Link href="/dashboard" className={rowLinkClass({ active: dashboardActive, level: 1, collapsed })}>
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Dashboard</span> : null}
            </Link>
          </div>

          <div className="space-y-1">
            <div className={rowWrapClass(1)}>
              <div className="flex items-center gap-2">
                <Link href="/planning" className={cn("min-w-0 flex-1", rowLinkClass({ active: planningActive, level: 1, collapsed }))}>
                  <SlidersHorizontal className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Planning</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => toggleGroup("planning")}
                  aria-label={planningOpen ? "Collapse Planning" : "Expand Planning"}
                >
                  {planningOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {planningOpen ? (
              <div className="space-y-1">
                <div className={rowWrapClass(2)}>
                  <Link href="/planning/my-financial-plan" className={rowLinkClass({ active: myFinancialPlanActive, level: 2, collapsed })}>
                    <SlidersHorizontal className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">My Financial Plan</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/planning/retirement" className={rowLinkClass({ active: retirementActive, level: 2, collapsed })}>
                    <PiggyBank className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Retirement</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/planning/goals" className={rowLinkClass({ active: goalsActive, level: 2, collapsed })}>
                    <Target className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Goals</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/planning/scenarios" className={rowLinkClass({ active: whatIfActive, level: 2, collapsed })}>
                    <BookOpen className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">What If?</span> : null}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/monthly-review" className={rowLinkClass({ active: monthlyReviewActive, level: 1, collapsed })}>
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Monthly Review</span> : null}
            </Link>
          </div>

          <div className="space-y-1">
            <div className={rowWrapClass(1)}>
              <div className="flex items-center gap-2">
                <Link href="/assets" className={cn("min-w-0 flex-1", rowLinkClass({ active: assetsInvestmentsActive, level: 1, collapsed }))}>
                  <Banknote className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Assets &amp; Investments</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => toggleGroup("assets-investments")}
                  aria-label={assetsInvestmentsOpen ? "Collapse Assets and Investments" : "Expand Assets and Investments"}
                >
                  {assetsInvestmentsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {assetsInvestmentsOpen ? (
              <div className="space-y-1">
                <div className={rowWrapClass(2)}>
                  <Link href="/assets" className={rowLinkClass({ active: assetsActive, level: 2, collapsed })}>
                    <Landmark className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Assets</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/bank-accounts" className={rowLinkClass({ active: bankAccountsActive, level: 2, collapsed })}>
                    <Landmark className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Cash &amp; Banking</span> : null}
                  </Link>
                </div>
                <div className={rowWrapClass(2)}>
                  <Link href="/investments" className={rowLinkClass({ active: investmentsActive, level: 2, collapsed })}>
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Investments</span> : null}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className={rowWrapClass(1)}>
              <div className="flex items-center gap-2">
                <Link href="/liabilities" className={cn("min-w-0 flex-1", rowLinkClass({ active: liabilitiesActive, level: 1, collapsed }))}>
                  <House className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Liabilities</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => toggleGroup("liabilities")}
                  aria-label={liabilitiesOpen ? "Collapse Liabilities" : "Expand Liabilities"}
                >
                  {liabilitiesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {liabilitiesOpen ? (
              <>
                <div className={rowWrapClass(2)}>
                  <Link href="/liabilities?bucket=home-loans" className={rowLinkClass({ active: homeLoansActive, level: 2, collapsed })}>
                    <House className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Home Loan</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/liabilities?bucket=car-loans" className={rowLinkClass({ active: carLoansActive, level: 2, collapsed })}>
                    <CircleDollarSign className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Car Loan</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/liabilities?bucket=credit-cards" className={rowLinkClass({ active: creditCardsActive, level: 2, collapsed })}>
                    <CreditCard className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Credit Cards</span> : null}
                  </Link>
                </div>
              </>
            ) : null}
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/compensation" className={rowLinkClass({ active: compensationActive, level: 1, collapsed })}>
              <Banknote className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Compensation</span> : null}
            </Link>
          </div>

          <div className="space-y-1">
            <div className={rowWrapClass(1)}>
              <div className="flex items-center gap-2">
                <Link href="/reports" className={cn("min-w-0 flex-1", rowLinkClass({ active: reportsActive, level: 1, collapsed }))}>
                  <ReceiptText className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Reports</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => toggleGroup("reports")}
                  aria-label={reportsOpen ? "Collapse Reports" : "Expand Reports"}
                >
                  {reportsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {reportsOpen ? (
              <div className="space-y-1">
                <div className={rowWrapClass(2)}>
                  <Link href="/reports/balance-sheet" className={rowLinkClass({ active: activeHref.startsWith("/reports/balance-sheet"), level: 2, collapsed })}>
                    <ReceiptText className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Balance Sheet</span> : null}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className={rowWrapClass(1)}>
              <div className="flex items-center gap-2">
                <Link href="/settings" className={cn("min-w-0 flex-1", rowLinkClass({ active: settingsActive, level: 1, collapsed }))}>
                  <Settings className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Settings</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => toggleGroup("settings")}
                  aria-label={settingsOpen ? "Collapse Settings" : "Expand Settings"}
                >
                  {settingsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {settingsOpen ? (
              <div className="space-y-1">
                <div className={rowWrapClass(2)}>
                  <Link href="/settings/my-profile" className={rowLinkClass({ active: settingsProfileActive, level: 2, collapsed })}>
                    <Users className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Profile</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/settings/family" className={rowLinkClass({ active: settingsFamilyActive, level: 2, collapsed })}>
                    <Users className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Family</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/settings/planning-assumptions" className={rowLinkClass({ active: settingsAssumptionsActive, level: 2, collapsed })}>
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Assumptions</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/settings/financial-preferences" className={rowLinkClass({ active: settingsTargetsActive, level: 2, collapsed })}>
                    <CircleDollarSign className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Targets</span> : null}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="shrink-0 border-t border-slate-200 px-3 py-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-xs font-semibold text-white">
            U
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">User</p>
              <p className="truncate text-xs text-slate-500">Executive access</p>
            </div>
          ) : null}
          {!collapsed ? (
            <Link
              href="/login"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Logout
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
