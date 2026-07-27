"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SummaryCard, SummaryCardGrid } from "@/components/ui/summary-cards";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { compensationService, type CompensationProfile, type CompensationSummary } from "@/services/compensation";
import { cashFlowManagementService, type CashFlowSummary } from "@/services/cashFlowManagement";

const currentMonth = new Date().toISOString().slice(0, 7);

const defaultProfile: CompensationProfile = {
  employer: "",
  grossSalaryPerMonth: 0,
  effectiveMonth: currentMonth,
  annualIncrementPercent: 8,
  incrementMonth: 4,
  basicPercentOfGross: 40,
  employeePfPercent: 12,
  vpfPercent: 0,
  employerEpfPercent: 12,
  professionalTax: 0,
  incomeTaxPercent: 0,
  currentNps: 0,
  annualBonus: 0,
  bonusMonth: 3,
};

const emptyCashFlow: CashFlowSummary = {
  monthlyIncome: 0,
  monthlyAutomaticCommitments: 0,
  monthlyManualExpenses: 0,
  monthlyExpenses: 0,
  monthlySavings: 0,
  savingsRate: 0,
};

function toNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export default function CompensationPage() {
  const [profile, setProfile] = useState<CompensationProfile>(defaultProfile);
  const [summary, setSummary] = useState<CompensationSummary | null>(null);
  const [cashFlowSummary, setCashFlowSummary] = useState<CashFlowSummary>(emptyCashFlow);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculated = useMemo(() => compensationService.buildSummaryFromProfile(profile), [profile]);

  const loadData = useCallback(async () => {
    setError(null);

    try {
      const [storedSummary, cashFlow] = await Promise.all([
        compensationService.getSummary(),
        cashFlowManagementService.getCashFlowSummary().catch(() => emptyCashFlow),
      ]);

      setSummary(storedSummary);
      setProfile(storedSummary?.profile ?? defaultProfile);
      setCashFlowSummary(cashFlow);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load compensation data.");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      await loadData();
      if (mounted) {
        setLoading(false);
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [loadData]);

  async function saveProfile() {
    setSaving(true);
    setError(null);

    try {
      await compensationService.upsertProfile(profile);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save compensation profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Compensation" }]} />

        <PageToolbar>
          <PageHeader
            title="Compensation"
            description="Compensation Engine is the single source of truth for employment income, deductions, and projection feed values."
            summary={summary ? `Effective ${summary.profile.effectiveMonth}` : "Set up your compensation profile"}
          />
          <Button onClick={() => void saveProfile()} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </PageToolbar>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {loading ? (
          <LoadingSpinner label="Loading compensation..." />
        ) : (
          <div className="space-y-6">
            <SummaryCardGrid>
              <SummaryCard title="Net Monthly Salary" value={formatCurrency(calculated.netMonthlySalary, { maximumFractionDigits: 0 })} tone="positive" />
              <SummaryCard title="Bonus (Monthly Equivalent)" value={formatCurrency(calculated.monthlyBonusEquivalent, { maximumFractionDigits: 0 })} />
              <SummaryCard title="Annual Gross" value={formatCurrency(calculated.annualGross, { maximumFractionDigits: 0 })} />
              <SummaryCard title="Annual Fixed Compensation" value={formatCurrency(calculated.annualFixedCompensation, { maximumFractionDigits: 0 })} />
            </SummaryCardGrid>

            <ContentContainer>
              <h2 className="text-lg font-semibold text-slate-900">Compensation Profile</h2>
              <p className="mt-1 text-sm text-slate-600">Editable inputs used by Compensation Summary service and downstream modules.</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Employer" id="comp-employer">
                  <Input id="comp-employer" value={profile.employer} onChange={(event) => setProfile((current) => ({ ...current, employer: event.target.value }))} />
                </Field>
                <Field label="Gross Salary / Month" id="comp-gross">
                  <Input id="comp-gross" type="number" min="0" step="0.01" value={profile.grossSalaryPerMonth} onChange={(event) => setProfile((current) => ({ ...current, grossSalaryPerMonth: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Effective Month" id="comp-effective">
                  <Input id="comp-effective" type="month" value={profile.effectiveMonth} onChange={(event) => setProfile((current) => ({ ...current, effectiveMonth: event.target.value || currentMonth }))} />
                </Field>
                <Field label="Annual Increment %" id="comp-increment-rate">
                  <Input id="comp-increment-rate" type="number" min="0" max="100" step="0.1" value={profile.annualIncrementPercent} onChange={(event) => setProfile((current) => ({ ...current, annualIncrementPercent: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Increment Month" id="comp-increment-month">
                  <Input id="comp-increment-month" type="number" min="1" max="12" step="1" value={profile.incrementMonth} onChange={(event) => setProfile((current) => ({ ...current, incrementMonth: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Basic % of Gross" id="comp-basic-percent">
                  <Input id="comp-basic-percent" type="number" min="0" max="100" step="0.1" value={profile.basicPercentOfGross} onChange={(event) => setProfile((current) => ({ ...current, basicPercentOfGross: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Employee PF %" id="comp-employee-pf">
                  <Input id="comp-employee-pf" type="number" min="0" max="100" step="0.1" value={profile.employeePfPercent} onChange={(event) => setProfile((current) => ({ ...current, employeePfPercent: toNumber(event.target.value) }))} />
                </Field>
                <Field label="VPF %" id="comp-vpf">
                  <Input id="comp-vpf" type="number" min="0" max="100" step="0.1" value={profile.vpfPercent} onChange={(event) => setProfile((current) => ({ ...current, vpfPercent: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Employer EPF %" id="comp-employer-epf">
                  <Input id="comp-employer-epf" type="number" min="0" max="100" step="0.1" value={profile.employerEpfPercent} onChange={(event) => setProfile((current) => ({ ...current, employerEpfPercent: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Professional Tax" id="comp-prof-tax">
                  <Input id="comp-prof-tax" type="number" min="0" step="0.01" value={profile.professionalTax} onChange={(event) => setProfile((current) => ({ ...current, professionalTax: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Income Tax %" id="comp-income-tax">
                  <Input id="comp-income-tax" type="number" min="0" max="100" step="0.1" value={profile.incomeTaxPercent} onChange={(event) => setProfile((current) => ({ ...current, incomeTaxPercent: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Current NPS" id="comp-nps">
                  <Input id="comp-nps" type="number" min="0" step="0.01" value={profile.currentNps} onChange={(event) => setProfile((current) => ({ ...current, currentNps: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Annual Bonus" id="comp-bonus">
                  <Input id="comp-bonus" type="number" min="0" step="0.01" value={profile.annualBonus} onChange={(event) => setProfile((current) => ({ ...current, annualBonus: toNumber(event.target.value) }))} />
                </Field>
                <Field label="Bonus Month" id="comp-bonus-month">
                  <Input id="comp-bonus-month" type="number" min="1" max="12" step="1" value={profile.bonusMonth} onChange={(event) => setProfile((current) => ({ ...current, bonusMonth: toNumber(event.target.value) }))} />
                </Field>
              </div>
            </ContentContainer>

            <ContentContainer>
              <h2 className="text-lg font-semibold text-slate-900">Calculated Values (Read-only)</h2>
              <p className="mt-1 text-sm text-slate-600">All values are computed by Compensation Engine formulas.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Basic Salary" value={formatCurrency(calculated.basicSalary, { maximumFractionDigits: 0 })} />
                <Metric label="Employee PF" value={formatCurrency(calculated.employeePf, { maximumFractionDigits: 0 })} />
                <Metric label="VPF" value={formatCurrency(calculated.vpf, { maximumFractionDigits: 0 })} />
                <Metric label="Employer EPF" value={formatCurrency(calculated.employerEpf, { maximumFractionDigits: 0 })} />
                <Metric label="Professional Tax" value={formatCurrency(calculated.professionalTax, { maximumFractionDigits: 0 })} />
                <Metric label="Income Tax" value={formatCurrency(calculated.incomeTax, { maximumFractionDigits: 0 })} />
                <Metric label="NPS" value={formatCurrency(calculated.nps, { maximumFractionDigits: 0 })} />
                <Metric label="Net Monthly Salary" value={formatCurrency(calculated.netMonthlySalary, { maximumFractionDigits: 0 })} />
                <Metric label="Annual Gross" value={formatCurrency(calculated.annualGross, { maximumFractionDigits: 0 })} />
              </div>
            </ContentContainer>

            <ContentContainer>
              <h2 className="text-lg font-semibold text-slate-900">Projection Feed</h2>
              <p className="mt-1 text-sm text-slate-600">Projection Engine remains unchanged and receives compensated assumptions derived from this summary.</p>

              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span>Cash Flow Input: Net Monthly Salary</span>
                  <span className="font-medium">{formatCurrency(calculated.netMonthlySalary, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cash Flow Input: Bonus (Monthly Equivalent)</span>
                  <span className="font-medium">{formatCurrency(calculated.monthlyBonusEquivalent, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Salary Growth for Projection</span>
                  <span className="font-medium">{formatPercent(calculated.profile.annualIncrementPercent, { digits: 1, multiply: false })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Retirement Feed: Employee PF + VPF</span>
                  <span className="font-medium">{formatCurrency(calculated.employeePf + calculated.vpf, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Retirement Feed: Employer EPF</span>
                  <span className="font-medium">{formatCurrency(calculated.employerEpf, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Retirement Feed: NPS</span>
                  <span className="font-medium">{formatCurrency(calculated.nps, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="my-2 border-t border-dashed border-slate-300" />
                <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                  <span>Current Cash Flow Monthly Income</span>
                  <span>{formatCurrency(cashFlowSummary.monthlyIncome, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </ContentContainer>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}

function Field(props: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      {props.children}
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs uppercase tracking-[0.08em] text-slate-500">{props.label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{props.value}</p>
    </div>
  );
}
