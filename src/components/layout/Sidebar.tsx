"use client";

import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Coins,
  CreditCard,
  Compass,
  Landmark,
  LayoutDashboard,
  Medal,
  PiggyBank,
  ArrowRightLeft,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Wallet,
  Search,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface SidebarProps {
  activeHref: string;
  collapsed: boolean;
}

function rowLinkClass(params: { active: boolean; level: 1 | 2 | 3; collapsed: boolean }): string {
  const { active, level, collapsed } = params;
  const levelClass =
    level === 1
      ? "text-[14px] font-semibold"
      : level === 2
        ? "text-[14px] font-medium"
        : "text-[13px] font-medium";

  return cn(
    "flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
    levelClass,
    active
      ? "bg-slate-900 text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    collapsed && "justify-center px-2",
  );
}

function rowWrapClass(level: 1 | 2 | 3): string {
  if (level === 1) {
    return "";
  }

  if (level === 2) {
    return "ml-4";
  }

  return "ml-8";
}

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: string;
  matchHrefs?: string[];
  children?: SidebarNavItem[];
}

export function Sidebar({ activeHref, collapsed }: SidebarProps) {
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [planningOpen, setPlanningOpen] = useState(true);
  const [retirementOpen, setRetirementOpen] = useState(true);

  const dashboardActive = activeHref === "/dashboard";
  const planningDashboardActive = activeHref === "/planning";
  const planningScenariosActive = activeHref === "/planning/scenarios";
  const planningGoalsActive = activeHref === "/planning/goals";
  const planningRetirementActive = activeHref === "/planning/retirement";
  const planningCashFlowActive = activeHref === "/planning/cashflow";
  const planningEventsActive = activeHref === "/planning/events";
  const planningActive = planningDashboardActive || planningScenariosActive || planningGoalsActive || planningRetirementActive || planningCashFlowActive || planningEventsActive;
  const netWorthActive = activeHref === "/balance-sheet";

  const bankAccountsActive = activeHref === "/bank-accounts";
  const investmentsActive = activeHref === "/investments";
  const fixedDepositsActive = activeHref === "/fixed-deposits";
  const goldActive = activeHref === "/gold";
  const silverActive = activeHref === "/silver";
  const realEstateActive = activeHref === "/real-estate";
  const retirementActive = activeHref === "/retirement" || activeHref === "/retirement?type=EPF" || activeHref === "/retirement?type=PPF" || activeHref === "/retirement?type=NPS";
  const epfActive = activeHref === "/retirement?type=EPF";
  const ppfActive = activeHref === "/retirement?type=PPF";
  const npsActive = activeHref === "/retirement?type=NPS";
  const assetsActive = activeHref === "/assets" || bankAccountsActive || investmentsActive || fixedDepositsActive || goldActive || silverActive || realEstateActive || retirementActive;

  const liabilitiesActive = activeHref === "/liabilities";
  const goalsActive = activeHref === "/goals";
  const insuranceActive = activeHref === "/insurance";
  const reportsActive = ["/reports", "/history", "/income", "/expenses", "/documents"].includes(activeHref);
  const monthEndCloseActive = activeHref === "/month-end-close";
  const monthlyReviewActive = activeHref === "/monthly-review";
  const projectionViewerActive = activeHref === "/projection-viewer";
  const aiActive = activeHref === "/ai";
  const importDataActive = activeHref === "/import-data";
  const settingsActive = activeHref === "/settings";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1.5">
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
                  <Compass className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Planning</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => setPlanningOpen((current) => !current)}
                  aria-label={planningOpen ? "Collapse Planning" : "Expand Planning"}
                >
                  {planningOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {planningOpen ? (
              <div className="space-y-1">
                <div className={rowWrapClass(2)}>
                  <Link href="/planning" className={rowLinkClass({ active: planningDashboardActive, level: 2, collapsed })}>
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Dashboard</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/planning/scenarios" className={rowLinkClass({ active: planningScenariosActive, level: 2, collapsed })}>
                    <Compass className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Scenarios</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/planning/goals" className={rowLinkClass({ active: planningGoalsActive, level: 2, collapsed })}>
                    <Target className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Goals</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/planning/retirement" className={rowLinkClass({ active: planningRetirementActive, level: 2, collapsed })}>
                    <PiggyBank className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Retirement Planner</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/planning/cashflow" className={rowLinkClass({ active: planningCashFlowActive, level: 2, collapsed })}>
                    <ArrowRightLeft className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Cash Flow</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/planning/events" className={rowLinkClass({ active: planningEventsActive, level: 2, collapsed })}>
                    <CalendarClock className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Financial Events</span> : null}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/balance-sheet" className={rowLinkClass({ active: netWorthActive, level: 1, collapsed })}>
              <BarChart3 className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Net Worth</span> : null}
            </Link>
          </div>

          <div className="space-y-1">
            <div className={rowWrapClass(1)}>
              <div className="flex items-center gap-2">
                <Link href="/assets" className={cn("min-w-0 flex-1", rowLinkClass({ active: assetsActive, level: 1, collapsed }))}>
                  <Wallet className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">Assets</span> : null}
                </Link>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => setAssetsOpen((current) => !current)}
                  aria-label={assetsOpen ? "Collapse Assets" : "Expand Assets"}
                >
                  {assetsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {assetsOpen ? (
              <>
                <div className={rowWrapClass(2)}>
                  <Link href="/bank-accounts" className={rowLinkClass({ active: bankAccountsActive, level: 2, collapsed })}>
                    <Landmark className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Bank Accounts</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/investments" className={rowLinkClass({ active: investmentsActive, level: 2, collapsed })}>
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Investments</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/fixed-deposits" className={rowLinkClass({ active: fixedDepositsActive, level: 2, collapsed })}>
                    <CircleDollarSign className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Fixed Deposits</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/gold" className={rowLinkClass({ active: goldActive, level: 2, collapsed })}>
                    <Medal className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Gold</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/silver" className={rowLinkClass({ active: silverActive, level: 2, collapsed })}>
                    <Coins className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Silver</span> : null}
                  </Link>
                </div>

                <div className={rowWrapClass(2)}>
                  <Link href="/real-estate" className={rowLinkClass({ active: realEstateActive, level: 2, collapsed })}>
                    <Wallet className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">Real Estate</span> : null}
                  </Link>
                </div>

                <div className={cn("space-y-1", rowWrapClass(2))}>
                  <div className="flex items-center gap-2">
                    <Link href="/retirement" className={cn("min-w-0 flex-1", rowLinkClass({ active: retirementActive, level: 2, collapsed }))}>
                      <PiggyBank className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate">Retirement</span> : null}
                    </Link>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                      onClick={() => setRetirementOpen((current) => !current)}
                      aria-label={retirementOpen ? "Collapse Retirement" : "Expand Retirement"}
                    >
                      {retirementOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>

                  {retirementOpen ? (
                    <div className="space-y-1">
                      <div className={rowWrapClass(3)}>
                        <Link href="/retirement?type=EPF" className={rowLinkClass({ active: epfActive, level: 3, collapsed })}>
                          <Landmark className="h-3.5 w-3.5 shrink-0" />
                          {!collapsed ? <span className="truncate">EPF</span> : null}
                        </Link>
                      </div>
                      <div className={rowWrapClass(3)}>
                        <Link href="/retirement?type=PPF" className={rowLinkClass({ active: ppfActive, level: 3, collapsed })}>
                          <BookOpen className="h-3.5 w-3.5 shrink-0" />
                          {!collapsed ? <span className="truncate">PPF</span> : null}
                        </Link>
                      </div>
                      <div className={rowWrapClass(3)}>
                        <Link href="/retirement?type=NPS" className={rowLinkClass({ active: npsActive, level: 3, collapsed })}>
                          <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                          {!collapsed ? <span className="truncate">NPS</span> : null}
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/liabilities" className={rowLinkClass({ active: liabilitiesActive, level: 1, collapsed })}>
              <CreditCard className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Liabilities</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/goals" className={rowLinkClass({ active: goalsActive, level: 1, collapsed })}>
              <Target className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Goals</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/insurance" className={rowLinkClass({ active: insuranceActive, level: 1, collapsed })}>
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Insurance</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/reports" className={rowLinkClass({ active: reportsActive, level: 1, collapsed })}>
              <BarChart3 className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Reports</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/month-end-close" className={rowLinkClass({ active: monthEndCloseActive, level: 1, collapsed })}>
              <CalendarCheck2 className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Month-End Close</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/monthly-review" className={rowLinkClass({ active: monthlyReviewActive, level: 1, collapsed })}>
              <ArrowRightLeft className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Monthly Review</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/projection-viewer" className={rowLinkClass({ active: projectionViewerActive, level: 1, collapsed })}>
              <Search className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Projection Viewer</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/ai" className={rowLinkClass({ active: aiActive, level: 1, collapsed })}>
              <Sparkles className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">AI Advisor</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/import-data" className={rowLinkClass({ active: importDataActive, level: 1, collapsed })}>
              <Upload className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Import Data</span> : null}
            </Link>
          </div>

          <div className={rowWrapClass(1)}>
            <Link href="/settings" className={rowLinkClass({ active: settingsActive, level: 1, collapsed })}>
              <Settings className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">Settings</span> : null}
            </Link>
          </div>
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
