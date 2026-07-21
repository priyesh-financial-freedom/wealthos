"use client";

import Link from "next/link";
import { memo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Landmark,
  Shield,
  Target,
  TrendingUp,
  Wallet,
  Wallet2,
} from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/feedback";
import { formatCurrency } from "@/lib/formatters";
import type { ExecutiveAllocationItem, ExecutiveDashboardData } from "@/services/dashboard";

interface ExecutiveDashboardProps {
  loading: boolean;
  data: ExecutiveDashboardData | null;
  error?: string | null;
}

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

const KpiCard = memo(function KpiCard({ title, value, detail, icon: Icon }: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
}) {
  return (
    <DashboardCard className="transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{detail}</p>
    </DashboardCard>
  );
});

function priorityBadge(priority: string) {
  if (priority === "Critical") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (priority === "High") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (priority === "Medium") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function goalStatusTone(status: string): string {
  if (status === "COMPLETED" || status === "ON_TRACK") {
    return "text-emerald-700";
  }
  if (status === "NEEDS_ATTENTION") {
    return "text-amber-700";
  }

  return "text-rose-700";
}

const HeroFinancialHealth = memo(function HeroFinancialHealth({ data }: { data: ExecutiveDashboardData }) {
  const topStrengths = data.health.strengths.slice(0, 2);
  const topWatchItems = data.health.watchItems.slice(0, 2);

  return (
    <DashboardCard className="overflow-hidden border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_35%),linear-gradient(135deg,#020617_0%,#0f172a_60%,#1e293b_100%)] text-white shadow-xl">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="text-sm font-medium text-slate-300">Hero Financial Health</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Score {data.health.overallScore}/100 · Grade {data.health.grade}</h2>
          <p className="mt-3 text-sm text-slate-300">Deterministic score powered by liquidity, debt, goals, retirement, diversification, and emergency readiness.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
              <Link href="/planning/decision-center">Open Decision Center</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/planning/goals">Review Goals</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">As Of</p>
            <p className="mt-2 text-lg font-semibold">{data.asOfLabel || "Current period"}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Top Strengths</p>
            {topStrengths.length === 0 ? <p className="mt-2 text-sm text-slate-200">No strengths available yet.</p> : topStrengths.map((item) => <p key={item} className="mt-2 text-sm text-slate-100">- {item}</p>)}
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Watch Items</p>
            {topWatchItems.length === 0 ? <p className="mt-2 text-sm text-slate-200">No active watch items.</p> : topWatchItems.map((item) => <p key={item} className="mt-2 text-sm text-slate-100">- {item}</p>)}
          </div>
        </div>
      </div>
    </DashboardCard>
  );
});

const DecisionCenterPreview = memo(function DecisionCenterPreview({ data }: { data: ExecutiveDashboardData }) {
  return (
    <DashboardCard className="h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Decision Center Preview</h3>
          <p className="text-sm text-slate-600">{data.decisionCenter.openCount} open recommendations · {data.decisionCenter.criticalCount} critical</p>
        </div>
        <AlertTriangle className="h-4 w-4 text-slate-400" />
      </div>

      {data.decisionCenter.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">No open recommendations right now.</div>
      ) : (
        <div className="space-y-3">
          {data.decisionCenter.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.recommendedAction}</p>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadge(item.priority)}`}>{item.priority}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button asChild variant="outline" className="mt-4 w-full">
        <Link href="/planning/decision-center">
          Open Decision Center
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </DashboardCard>
  );
});

const GoalProgressWidget = memo(function GoalProgressWidget({ data }: { data: ExecutiveDashboardData }) {
  return (
    <DashboardCard className="h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Goal Progress</h3>
          <p className="text-sm text-slate-600">{data.goals.onTrack} on-track · {data.goals.atRisk} at-risk · {data.goals.completed} completed</p>
        </div>
        <Target className="h-4 w-4 text-slate-400" />
      </div>

      {data.goals.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">No goals configured yet.</div>
      ) : (
        <div className="space-y-3">
          {data.goals.items.map((goal) => (
            <div key={goal.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{goal.name}</p>
                  <p className="mt-1 text-xs text-slate-500">Projected {formatCurrency(goal.projectedAmount, { maximumFractionDigits: 0 })} of {formatCurrency(goal.targetAmount, { maximumFractionDigits: 0 })}</p>
                </div>
                <span className={`text-xs font-semibold ${goalStatusTone(goal.status)}`}>{goal.status.replaceAll("_", " ")}</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, Math.max(0, goal.progressPercent))}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{goal.progressPercent.toFixed(1)}% funded</p>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
});

function AllocationList({ title, items }: { title: string; items: ExecutiveAllocationItem[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No data available.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.slice(0, 6).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="font-medium text-slate-700">{item.name}</span>
              </div>
              <span className="font-semibold text-slate-900">{item.sharePercent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const WealthAllocationWidget = memo(function WealthAllocationWidget({ data }: { data: ExecutiveDashboardData }) {
  return (
    <DashboardCard className="h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Wealth Allocation</h3>
          <p className="text-sm text-slate-600">Current split across balance-sheet categories</p>
        </div>
        <CircleDollarSign className="h-4 w-4 text-slate-400" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="h-72 w-full">
          {data.wealthAllocation.assets.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-sm text-slate-500">Add assets to view allocation.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.wealthAllocation.assets} dataKey="value" nameKey="name" innerRadius={64} outerRadius={98} paddingAngle={2} stroke="none">
                  {data.wealthAllocation.assets.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="space-y-5">
          <AllocationList title="Assets" items={data.wealthAllocation.assets} />
          <AllocationList title="Liabilities" items={data.wealthAllocation.liabilities} />
        </div>
      </div>
    </DashboardCard>
  );
});

const CashFlowSummaryWidget = memo(function CashFlowSummaryWidget({ data }: { data: ExecutiveDashboardData }) {
  return (
    <DashboardCard className="h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Cash Flow Summary</h3>
          <p className="text-sm text-slate-600">Forward six-month cash trajectory from simulation baseline</p>
        </div>
        <TrendingUp className="h-4 w-4 text-slate-400" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current Cash</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(data.cashFlow.currentCash, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Avg Monthly Delta</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(data.cashFlow.averageMonthlyDelta, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Negative Months</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{data.cashFlow.negativeMonths}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Projected Net Worth Change</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(data.cashFlow.projectedNetWorthChange, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {data.cashFlow.points.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">Run monthly projections to unlock cash flow preview.</div>
      ) : (
        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.cashFlow.points}>
              <defs>
                <linearGradient id="executive-cash-flow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} />
              <Area type="monotone" dataKey="value" stroke="#0f172a" fill="url(#executive-cash-flow)" strokeWidth={2.4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardCard>
  );
});

const RecentActivityTimeline = memo(function RecentActivityTimeline({ data }: { data: ExecutiveDashboardData }) {
  return (
    <DashboardCard className="h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Recent Activity Timeline</h3>
          <p className="text-sm text-slate-600">Most recent changes across review, goals, decisions, and simulation</p>
        </div>
        <Landmark className="h-4 w-4 text-slate-400" />
      </div>

      {data.recentActivity.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">No recent activity yet.</div>
      ) : (
        <div className="space-y-3">
          {data.recentActivity.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{item.timeLabel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
});

function ExecutiveEmptyState() {
  return (
    <DashboardCard className="overflow-hidden border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-0 text-white shadow-xl">
      <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
        <div>
          <p className="text-sm font-medium text-slate-300">Executive command center</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">Capture your first holdings to unlock this command center.</h3>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">Add assets, liabilities, and goals to activate health scoring, decision intelligence, and simulation-backed executive insights.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
              <Link href="/assets">Add Asset</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/liabilities">Add Liability</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/planning/goals">Add Goal</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-300">Financial Health</p>
            <p className="mt-2 text-2xl font-semibold text-white">0 / 100</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-300">Open Decisions</p>
            <p className="mt-2 text-2xl font-semibold text-white">0</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-300">Goals On Track</p>
            <p className="mt-2 text-2xl font-semibold text-white">0</p>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}

export const ExecutiveDashboard = memo(function ExecutiveDashboard({ loading, data, error }: ExecutiveDashboardProps) {
  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
  }

  if (!data) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Dashboard data is unavailable.</div>;
  }

  return (
    <div className="space-y-8">
      {data.emptyState ? (
        <ExecutiveEmptyState />
      ) : (
        <>
          <HeroFinancialHealth data={data} />

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Net Worth"
              value={formatCurrency(data.kpis.netWorth, { maximumFractionDigits: 0 })}
              detail="Current household net worth"
              icon={Wallet2}
            />
            <KpiCard
              title="Goals"
              value={`${data.kpis.goalsOnTrack}/${data.kpis.totalGoals}`}
              detail="On-track and completed goals"
              icon={Target}
            />
            <KpiCard
              title="Decisions"
              value={`${data.kpis.openDecisions}`}
              detail={`${data.kpis.criticalDecisions} critical recommendations`}
              icon={Shield}
            />
            <KpiCard
              title="Retirement"
              value={`${data.kpis.retirementCoveragePercent.toFixed(1)}%`}
              detail={formatCurrency(data.kpis.retirementAssets, { maximumFractionDigits: 0 }) + " in retirement assets"}
              icon={CheckCircle2}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <DecisionCenterPreview data={data} />
            <GoalProgressWidget data={data} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <WealthAllocationWidget data={data} />
            <CashFlowSummaryWidget data={data} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <RecentActivityTimeline data={data} />
            <DashboardCard className="h-full bg-slate-50">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Executive Notes</h3>
                  <p className="mt-2 text-sm text-slate-600">Health recommendations from the decision stack.</p>
                  <div className="mt-4 space-y-2">
                    {data.health.recommendations.slice(0, 4).map((recommendation) => (
                      <p key={recommendation} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">- {recommendation}</p>
                    ))}
                    {data.health.recommendations.length === 0 ? <p className="text-sm text-slate-500">No recommendations right now.</p> : null}
                  </div>
                </div>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link href="/planning">
                    Open Planning Workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </DashboardCard>
          </section>
        </>
      )}
    </div>
  );
});

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-56 rounded-2xl border border-slate-200 bg-slate-100" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-32 rounded bg-slate-200" />
            <div className="mt-4 h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="h-[24rem] rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-[24rem] rounded-2xl border border-slate-200 bg-slate-100" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="h-[24rem] rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-[24rem] rounded-2xl border border-slate-200 bg-slate-100" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="h-[20rem] rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="h-[20rem] rounded-2xl border border-slate-200 bg-slate-100" />
      </div>
      <LoadingSpinner label="Loading executive dashboard..." />
    </div>
  );
}
