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
  BarChart3,
  Brain,
  Briefcase,
  CircleCheck,
  CircleDollarSign,
  Landmark,
  Rocket,
  Target,
  TrendingUp,
  Users,
  Wallet2,
} from "lucide-react";

import {
  DashboardRefreshBanner,
  ErrorCard,
  ExecutiveEmptyState,
  ExecutiveKpiCard,
  InsightCard,
  LoadingExecutiveState,
  LoadingSkeleton,
  MetricChip,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  StatusBadge,
} from "@/components/dashboard/ExecutiveDesignSystem";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { ExecutiveAllocationItem, ExecutiveDashboardData } from "@/services/dashboard";

interface ExecutiveDashboardProps {
  loading: boolean;
  data: ExecutiveDashboardData | null;
  error?: string | null;
}

const COLORS = ["#2563eb", "#10b981", "#7c3aed", "#f59e0b", "#06b6d4", "#ef4444"];

function priorityBadge(priority: string) {
  if (priority === "Critical") {
    return "critical" as const;
  }
  if (priority === "High") {
    return "high" as const;
  }
  if (priority === "Medium") {
    return "medium" as const;
  }

  return "low" as const;
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

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
}

function computeFinancialIndependenceProgress(data: ExecutiveDashboardData) {
  const goalsRatio = data.kpis.totalGoals > 0 ? (data.kpis.goalsOnTrack / data.kpis.totalGoals) * 100 : 0;
  const retirement = Math.max(0, Math.min(100, data.kpis.retirementCoveragePercent));
  const health = Math.max(0, Math.min(100, data.health.overallScore));
  return Math.round(goalsRatio * 0.35 + retirement * 0.35 + health * 0.3);
}

function chartTooltipFormatter(value: number | string | null | undefined) {
  return formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 });
}

const HeroFinancialHealth = memo(function HeroFinancialHealth({ data }: { data: ExecutiveDashboardData }) {
  const fiProgress = computeFinancialIndependenceProgress(data);
  const topStrengths = data.health.strengths.slice(0, 2);
  const topWatchItems = data.health.watchItems.slice(0, 2);

  return (
    <section className="executive-card overflow-hidden rounded-[30px] border border-blue-900/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.24),_transparent_32%),radial-gradient(circle_at_85%_25%,rgba(37,99,235,0.24),transparent_38%),linear-gradient(135deg,#0a1222_0%,#102340_55%,#172f54_100%)] p-6 text-white lg:p-7">
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <p className="executive-label !text-blue-100/90">Executive command center</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] lg:text-[2.1rem]">
            Net Worth {formatCurrency(data.kpis.netWorth, { maximumFractionDigits: 0 })}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-blue-100/90">
            High-signal view across portfolio strength, forecast trajectory, and critical decisions requiring action.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <MetricChip label="Health" value={`${data.health.overallScore}/100`} tone="emerald" />
            <MetricChip label="FI Progress" value={`${fiProgress}%`} tone="purple" />
            <MetricChip label="As of" value={data.asOfLabel || "Current"} tone="cyan" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-white text-slate-900 hover:bg-slate-100">
              <Link href="/planning/decision-center">Open Decision Center</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/planning/goals">Review Goals</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="executive-label !text-sky-100">Health score</p>
              <CircleCheck className="h-4 w-4 text-emerald-300" />
            </div>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-3xl font-semibold tracking-[-0.02em]">{data.health.overallScore}</p>
              <p className="pb-1 text-sm text-sky-100">Grade {data.health.grade}</p>
            </div>
            <ProgressBar value={data.health.overallScore} colorClass="bg-emerald-400" />
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="executive-label !text-sky-100">Top strengths</p>
            {topStrengths.length === 0 ? <p className="mt-2 text-sm text-sky-100">No strengths available yet.</p> : topStrengths.map((item) => <p key={item} className="mt-2 text-sm text-sky-50">- {item}</p>)}
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="executive-label !text-sky-100">Watch list</p>
            {topWatchItems.length === 0 ? <p className="mt-2 text-sm text-sky-100">No active watch items.</p> : topWatchItems.map((item) => <p key={item} className="mt-2 text-sm text-sky-50">- {item}</p>)}
          </div>
        </div>
      </div>
    </section>
  );
});

const DecisionCenterPreview = memo(function DecisionCenterPreview({ data }: { data: ExecutiveDashboardData }) {
  return (
    <InsightCard
      title="Decision Center Preview"
      caption={`${data.decisionCenter.openCount} open recommendations, ${data.decisionCenter.criticalCount} critical`}
      className="h-full"
    >
      <SectionHeader title="Priority Queue" action={<AlertTriangle className="h-4 w-4 text-amber-500" />} />

      {data.decisionCenter.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No open recommendations right now.</div>
      ) : (
        <div className="space-y-3">
          {data.decisionCenter.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.recommendedAction}</p>
                </div>
                <StatusBadge tone={priorityBadge(item.priority)} label={item.priority} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Button asChild variant="outline" className="mt-4 w-full border-slate-300 bg-white hover:bg-slate-50">
        <Link href="/planning/decision-center">
          Open Decision Center
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </InsightCard>
  );
});

const GoalProgressWidget = memo(function GoalProgressWidget({ data }: { data: ExecutiveDashboardData }) {
  return (
    <InsightCard
      title="Goal Progress"
      caption={`${data.goals.onTrack} on-track, ${data.goals.atRisk} at-risk, ${data.goals.completed} completed`}
      className="h-full"
    >
      <SectionHeader title="Funding Momentum" action={<Target className="h-4 w-4 text-violet-500" />} />

      {data.goals.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No goals configured yet.</div>
      ) : (
        <div className="space-y-3">
          {data.goals.items.map((goal) => (
            <div key={goal.id} className="rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{goal.name}</p>
                  <p className="mt-1 text-xs text-slate-500">Projected {formatCurrency(goal.projectedAmount, { maximumFractionDigits: 0 })} of {formatCurrency(goal.targetAmount, { maximumFractionDigits: 0 })}</p>
                </div>
                <span className={`text-xs font-semibold ${goalStatusTone(goal.status)}`}>{goal.status.replaceAll("_", " ")}</span>
              </div>
              <div className="mt-3">
                <ProgressBar value={goal.progressPercent} colorClass="bg-violet-600" />
              </div>
              <p className="mt-2 text-xs text-slate-500">{goal.progressPercent.toFixed(1)}% funded</p>
            </div>
          ))}
        </div>
      )}
    </InsightCard>
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
    <InsightCard title="Asset Allocation" caption="Diversification by category" className="h-full">
      <SectionHeader title="Portfolio Mix" action={<CircleDollarSign className="h-4 w-4 text-cyan-500" />} />
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
                <Tooltip
                  contentStyle={{ borderRadius: 14, borderColor: "#dbe5f3", boxShadow: "0 16px 34px -22px rgba(17,24,39,0.45)", background: "#ffffff" }}
                  formatter={(value) => chartTooltipFormatter(value as number)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="space-y-5">
          <AllocationList title="Assets" items={data.wealthAllocation.assets} />
          <AllocationList title="Liabilities" items={data.wealthAllocation.liabilities} />
        </div>
      </div>
    </InsightCard>
  );
});

const CashFlowSummaryWidget = memo(function CashFlowSummaryWidget({ data }: { data: ExecutiveDashboardData }) {
  return (
    <InsightCard title="Cash Flow Trajectory" caption="Forward six-month simulation trend" className="h-full">
      <SectionHeader title="Forecast" action={<TrendingUp className="h-4 w-4 text-blue-500" />} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current Cash</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(data.cashFlow.currentCash, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Avg Monthly Delta</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(data.cashFlow.averageMonthlyDelta, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Negative Months</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{data.cashFlow.negativeMonths}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
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
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#dbe5f3" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 14, borderColor: "#dbe5f3", boxShadow: "0 16px 34px -22px rgba(17,24,39,0.45)", background: "#ffffff" }}
                formatter={(value) => chartTooltipFormatter(value as number)}
              />
              <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#executive-cash-flow)" strokeWidth={2.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </InsightCard>
  );
});

const RecentActivityTimeline = memo(function RecentActivityTimeline({ data }: { data: ExecutiveDashboardData }) {
  return (
    <InsightCard title="Executive Brief" caption="Latest movements across review, planning, and simulation" className="h-full">
      <SectionHeader title="Recent Activity" action={<Landmark className="h-4 w-4 text-slate-500" />} />

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
    </InsightCard>
  );
});

export const ExecutiveDashboard = memo(function ExecutiveDashboard({ loading, data, error }: ExecutiveDashboardProps) {
  if (loading) {
    return <LoadingExecutiveState />;
  }

  if (error) {
    return <ErrorCard message={error} />;
  }

  if (!data) {
    return <ErrorCard message="Dashboard data is unavailable." />;
  }

  const fiProgress = computeFinancialIndependenceProgress(data);

  return (
    <div className="space-y-7">
      <DashboardRefreshBanner message={`Dashboard synced for ${data.asOfLabel || "current period"}.`} />

      {data.emptyState ? (
        <ExecutiveEmptyState
          title="Add your first holdings to unlock premium insights"
          description="Capture assets, liabilities, and goals to activate simulation-backed executive guidance."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/assets">Add Asset</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/liabilities">Add Liability</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/planning/goals">Add Goal</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <HeroFinancialHealth data={data} />

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ExecutiveKpiCard
              title="Net Worth"
              value={formatCurrency(data.kpis.netWorth, { maximumFractionDigits: 0 })}
              detail="Current family net worth"
              icon={Wallet2}
              tone="blue"
            />
            <ExecutiveKpiCard
              title="Goals Progress"
              value={`${data.kpis.goalsOnTrack}/${data.kpis.totalGoals}`}
              detail="On-track and completed goals"
              icon={Target}
              tone="amber"
            />
            <ExecutiveKpiCard
              title="Decisions"
              value={`${data.kpis.openDecisions}`}
              detail={`${data.kpis.criticalDecisions} critical recommendations`}
              icon={Brain}
              tone="red"
            />
            <ExecutiveKpiCard
              title="Retirement"
              value={`${data.kpis.retirementCoveragePercent.toFixed(1)}%`}
              detail={formatCurrency(data.kpis.retirementAssets, { maximumFractionDigits: 0 }) + " in retirement assets"}
              icon={Briefcase}
              tone="purple"
            />
          </section>

          {data.household ? (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ExecutiveKpiCard
                title="Family"
                value={data.household.householdName}
                detail={`${data.household.membersCount} members`}
                icon={Users}
                tone="cyan"
              />
              <ExecutiveKpiCard
                title="Planning Horizon"
                value={data.household.planningHorizonLabel}
                detail="Configured planning window"
                icon={BarChart3}
                tone="emerald"
              />
              <ExecutiveKpiCard
                title="Current Financial Month"
                value={data.household.currentFinancialMonthLabel}
                detail="Based on family financial year start"
                icon={Landmark}
                tone="blue"
              />
            </section>
          ) : null}

          <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <InsightCard
              title="Financial Independence"
              caption="Blended progress across health, retirement, and goal execution"
              className="h-full"
            >
              <div className="grid gap-5 md:grid-cols-[0.32fr_0.68fr]">
                <div className="flex items-center justify-center">
                  <ProgressRing value={fiProgress} label="FI" tone="purple" />
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">Health momentum</span>
                      <span className="text-slate-500">{formatPercent(data.health.overallScore)}</span>
                    </div>
                    <ProgressBar value={data.health.overallScore} colorClass="bg-emerald-500" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">Retirement readiness</span>
                      <span className="text-slate-500">{formatPercent(data.kpis.retirementCoveragePercent)}</span>
                    </div>
                    <ProgressBar value={data.kpis.retirementCoveragePercent} colorClass="bg-violet-600" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">Goal execution</span>
                      <span className="text-slate-500">{data.kpis.totalGoals > 0 ? formatPercent((data.kpis.goalsOnTrack / data.kpis.totalGoals) * 100) : "0.0%"}</span>
                    </div>
                    <ProgressBar value={data.kpis.totalGoals > 0 ? (data.kpis.goalsOnTrack / data.kpis.totalGoals) * 100 : 0} colorClass="bg-amber-500" />
                  </div>
                </div>
              </div>
            </InsightCard>

            <DecisionCenterPreview data={data} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <GoalProgressWidget data={data} />
            <CashFlowSummaryWidget data={data} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <WealthAllocationWidget data={data} />
            <InsightCard title="Health Score" caption="Trend and recommendations" className="h-full">
              <SectionHeader title="Health Trend" action={<Rocket className="h-4 w-4 text-emerald-500" />} />

              {data.health.trend.length === 0 ? (
                <LoadingSkeleton rows={3} />
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.health.trend}>
                      <defs>
                        <linearGradient id="health-score-trend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#dbe5f3" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 14, borderColor: "#dbe5f3", boxShadow: "0 16px 34px -22px rgba(17,24,39,0.45)", background: "#ffffff" }}
                      />
                      <Area type="monotone" dataKey="score" stroke="#10b981" fill="url(#health-score-trend)" strokeWidth={2.4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="mt-4 space-y-2.5">
                {data.health.recommendations.slice(0, 3).map((recommendation) => (
                  <div key={recommendation} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {recommendation}
                  </div>
                ))}
                {data.health.recommendations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">No health recommendations right now.</div>
                ) : null}
              </div>
            </InsightCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <RecentActivityTimeline data={data} />
            <InsightCard title="Executive Brief" caption="Decision signals and recommendations" className="h-full">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="executive-label">Open decisions</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{data.decisionCenter.openCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="executive-label">Critical decisions</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{data.decisionCenter.criticalCount}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <MetricChip label="Net Worth" value={formatCurrency(data.kpis.netWorth, { maximumFractionDigits: 0 })} tone="blue" />
                <MetricChip label="Retirement" value={formatPercent(data.kpis.retirementCoveragePercent)} tone="purple" />
                <MetricChip label="Health" value={`${data.health.overallScore}`} tone="emerald" />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="executive-label">Guidance</p>
                <p className="mt-2 text-sm text-slate-700">
                  {data.health.recommendations[0] ?? "The platform has no immediate action item. Continue your current plan and monitor monthly variance."}
                </p>
              </div>

              <Button asChild variant="outline" className="mt-4 w-full border-slate-300 bg-white hover:bg-slate-50">
                <Link href="/planning">
                  Open Planning Workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </InsightCard>
          </section>
        </>
      )}
    </div>
  );
});
