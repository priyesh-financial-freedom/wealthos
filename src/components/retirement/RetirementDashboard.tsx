"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Landmark, Layers3, PiggyBank, WalletCards } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { RetirementDashboardModel } from "@/types/retirementAccount";

interface RetirementDashboardProps {
  model: RetirementDashboardModel;
  emptyState: boolean;
}

const COLORS = ["#f59e0b", "#0f172a", "#15803d", "#2563eb", "#a855f7", "#db2777"];

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function RetirementDashboard({ model, emptyState }: RetirementDashboardProps) {
  if (emptyState) {
    return (
      <DashboardCard className="overflow-hidden border-[#2b2414] bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.24),_transparent_35%),linear-gradient(135deg,#09090b_0%,#111827_55%,#1f2937_100%)] p-0 text-white shadow-xl">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div>
            <p className="text-sm font-medium text-amber-200/80">Retirement vault</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Bring EPF, PPF, and NPS into one premium retirement command center.</h3>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">Track balances, contribution discipline, and long-term compounding with monthly retirement snapshots.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Total Retirement Assets", value: "₹0" },
              { label: "PPF Balance", value: "₹0" },
              { label: "EPF Balance", value: "₹0" },
              { label: "NPS Balance", value: "₹0" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-sm text-slate-300">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </DashboardCard>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Retirement Assets" value={formatMoney(model.totalRetirementAssets)} subtitle="Combined EPF, PPF, and NPS" icon={WalletCards} tone="dark" />
        <MetricCard title="EPF Balance" value={formatMoney(model.balancesByType.EPF)} subtitle="Provident fund position" icon={Landmark} />
        <MetricCard title="PPF Balance" value={formatMoney(model.balancesByType.PPF)} subtitle="Public provident corpus" icon={PiggyBank} />
        <MetricCard title="NPS Balance" value={formatMoney(model.balancesByType.NPS)} subtitle="National pension exposure" icon={Layers3} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard>
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Owner Allocation</h3>
            <p className="text-sm text-slate-600">Retirement balances split by owner</p>
          </div>
          {model.ownerAllocation.length === 0 ? (
            <EmptyChartState label="Add retirement accounts to view owner allocation." />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.ownerAllocation}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                  <Bar dataKey="value" fill="#0f172a" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>

        <DashboardCard>
          <div className="mb-4 space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Account Type Allocation</h3>
            <p className="text-sm text-slate-600">Current split across PPF, EPF, and NPS</p>
          </div>
          {model.accountTypeAllocation.length === 0 ? (
            <EmptyChartState label="No retirement accounts added yet." />
          ) : (
            <div className="grid gap-4">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={model.accountTypeAllocation} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={3}>
                      {model.accountTypeAllocation.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {model.accountTypeAllocation.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{formatMoney(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DashboardCard>
      </section>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "dark";
}) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
    dark: "border-[#2b2414] bg-[linear-gradient(135deg,#09090b_0%,#111827_60%,#1f2937_100%)] text-white",
  };

  return (
    <DashboardCard className={toneClasses[tone]}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${tone === "dark" ? "text-slate-300" : "text-slate-500"}`}>{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone === "dark" ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className={`mt-4 text-sm ${tone === "dark" ? "text-slate-300" : "text-slate-600"}`}>{subtitle}</p>
    </DashboardCard>
  );
}