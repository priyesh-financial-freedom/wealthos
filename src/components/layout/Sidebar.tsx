"use client";

import { useState } from "react";
import {
  Banknote,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Target,
  House,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
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

type SidebarGroupKey = "cash-banking" | "investments" | "retirement" | "borrowings" | "settings";

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

  const cashBankingOpen = expandedGroup === "cash-banking";
  const retirementOpen = expandedGroup === "retirement";
  const borrowingsOpen = expandedGroup === "borrowings";
  const settingsOpen = expandedGroup === "settings";

  function toggleGroup(group: SidebarGroupKey) {
    setExpandedGroup((current) => (current === group ? null : group));
  }

  const dashboardActive = activeHref === "/dashboard";
  const assetsActive = activeHref === "/assets";
  const bankAccountsActive = activeHref === "/bank-accounts";
  const cashBankingActive = bankAccountsActive;

  const investmentsActive = activeHref === "/investments";

  const retirementRootActive = activeHref === "/retirement";
  const epfActive = activeHref === "/retirement?type=EPF";
  const ppfActive = activeHref === "/retirement?type=PPF";
  const npsActive = activeHref === "/retirement?type=NPS";
  const retirementActive = retirementRootActive || epfActive || ppfActive || npsActive;

  const liabilitiesRootActive = activeHref === "/liabilities";
  const homeLoansActive = activeHref === "/liabilities?bucket=home-loans";
  const carLoansActive = activeHref === "/liabilities?bucket=car-loans" || activeHref === "/liabilities?bucket=vehicle-loans";
  const creditCardsActive = activeHref === "/liabilities?bucket=credit-cards";
  const borrowingsActive = liabilitiesRootActive || homeLoansActive || carLoansActive || creditCardsActive;

  const goalsActive = activeHref === "/goals" || activeHref === "/planning/goals";
  const compensationActive = activeHref === "/compensation";
  const cashFlowActive = activeHref === "/cash-flow" || activeHref === "/income" || activeHref === "/expenses";
  const reportsActive = ["/reports", "/history", "/documents"].includes(activeHref);
  const settingsHomeActive = activeHref === "/settings";
  const settingsFamilyActive = activeHref === "/settings/family" || activeHref === "/settings/household";
  const settingsProfileActive = activeHref === "/settings/my-profile";
  const settingsFinancialPreferencesActive = activeHref === "/settings/financial-preferences";
  const settingsPlanningAssumptionsActive = activeHref === "/settings/planning-assumptions";
  const settingsSystemActive = activeHref === "/settings/system";
  const settingsActive =
    settingsHomeActive ||
    settingsFamilyActive ||
    settingsProfileActive ||
    settingsFinancialPreferencesActive ||
    settingsPlanningAssumptionsActive ||
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

          <div className={rowWrapClass(1)}>
            <Link href="/assets" className={rowLinkClass({ active: assetsActive, level: 1, collapsed })}>
              <Landmark className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Assets</span> : null}
            </Link>
          </div>

          <div className="space-y-1">
            <div className={rowWrapClass(1)}>
              <div className="flex items-center gap-2">
                <Link href="/bank-accounts" className={cn("min-w-0 flex-1", rowLinkClass({ active: cashBankingActive, level: 1, collapsed }))}>
                  <Banknote className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Cash &amp; Banking</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => toggleGroup("cash-banking")}
                  aria-label={cashBankingOpen ? "Collapse Cash and Banking" : "Expand Cash and Banking"}
                >
                  {cashBankingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {cashBankingOpen ? (
              <div className="space-y-1">
                <div className={rowWrapClass(2)}>
                  <Link href="/bank-accounts" className={rowLinkClass({ active: bankAccountsActive, level: 2, collapsed })}>
                    <Landmark className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Bank Accounts</span> : null}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/investments" className={rowLinkClass({ active: investmentsActive, level: 1, collapsed })}>
              <TrendingUp className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Investments</span> : null}
            </Link>
          </div>

          <div className="space-y-1">
            <div className={rowWrapClass(1)}>
              <div className="flex items-center gap-2">
                <Link href="/retirement?type=EPF" className={cn("min-w-0 flex-1", rowLinkClass({ active: retirementActive, level: 1, collapsed }))}>
                  <PiggyBank className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Retirement</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => toggleGroup("retirement")}
                  aria-label={retirementOpen ? "Collapse Retirement" : "Expand Retirement"}
                >
                  {retirementOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {retirementOpen ? (
              <>
                <div className={rowWrapClass(2)}>
                  <Link href="/retirement?type=EPF" className={rowLinkClass({ active: epfActive, level: 2, collapsed })}>
                    <Landmark className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">EPF</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/retirement?type=PPF" className={rowLinkClass({ active: ppfActive, level: 2, collapsed })}>
                    <BookOpen className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">PPF</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/retirement?type=NPS" className={rowLinkClass({ active: npsActive, level: 2, collapsed })}>
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">NPS</span> : null}
                  </Link>
                </div>
              </>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className={rowWrapClass(1)}>
              <div className="flex items-center gap-2">
                <Link href="/liabilities?bucket=home-loans" className={cn("min-w-0 flex-1", rowLinkClass({ active: borrowingsActive, level: 1, collapsed }))}>
                  <House className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Borrowings</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => toggleGroup("borrowings")}
                  aria-label={borrowingsOpen ? "Collapse Borrowings" : "Expand Borrowings"}
                >
                  {borrowingsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {borrowingsOpen ? (
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
            <Link href="/goals" className={rowLinkClass({ active: goalsActive, level: 1, collapsed })}>
              <Target className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Goals</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/compensation" className={rowLinkClass({ active: compensationActive, level: 1, collapsed })}>
              <Banknote className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Compensation</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/cash-flow" className={rowLinkClass({ active: cashFlowActive, level: 1, collapsed })}>
              <CircleDollarSign className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Cash Flow</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/reports" className={rowLinkClass({ active: reportsActive, level: 1, collapsed })}>
              <ReceiptText className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Reports</span> : null}
            </Link>
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
                    {!collapsed ? <span className="truncate">My Profile</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/settings/family" className={rowLinkClass({ active: settingsFamilyActive, level: 2, collapsed })}>
                    <Users className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Family</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/settings/financial-preferences" className={rowLinkClass({ active: settingsFinancialPreferencesActive, level: 2, collapsed })}>
                    <CircleDollarSign className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Financial Preferences</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/settings/planning-assumptions" className={rowLinkClass({ active: settingsPlanningAssumptionsActive, level: 2, collapsed })}>
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Planning Assumptions</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/settings/system" className={rowLinkClass({ active: settingsSystemActive, level: 2, collapsed })}>
                    <Settings className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">System</span> : null}
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
