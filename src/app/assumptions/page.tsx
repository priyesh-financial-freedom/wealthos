"use client";

import { useEffect, useState, type ReactNode } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/textarea";
import { assumptionsService, DEFAULT_ASSUMPTIONS_BUNDLE, DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import type { AssumptionSection, AssumptionsBundle } from "@/types/assumptions";

type EditableSection = Exclude<AssumptionSection, "tax">;

function cloneBundle(bundle: AssumptionsBundle): AssumptionsBundle {
  return JSON.parse(JSON.stringify(bundle)) as AssumptionsBundle;
}

function numberValue(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function SectionFrame({
  title,
  description,
  children,
  onSave,
  saving,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <DashboardCard className="h-full">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save section"}
        </Button>
      </div>
    </DashboardCard>
  );
}

export default function AssumptionsPage() {
  const [assumptions, setAssumptions] = useState<AssumptionsBundle>(() => cloneBundle(DEFAULT_ASSUMPTIONS_BUNDLE));
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<EditableSection | "tax" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function updateSection<K extends keyof AssumptionsBundle>(section: K, patch: Partial<AssumptionsBundle[K]>) {
    setAssumptions((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...patch,
      },
    }));
  }

  async function loadData() {
    const bundle = await assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY);
    setAssumptions(bundle);
  }

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        setLoading(true);
        const bundle = await assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY);
        if (isMounted) {
          setAssumptions(bundle);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load assumptions");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function saveSection(section: EditableSection | "tax") {
    setSavingSection(section);
    setError(null);
    setNotice(null);

    try {
      switch (section) {
        case "income":
          await assumptionsService.saveIncomeAssumptions(assumptions.income, DEFAULT_SCENARIO_KEY);
          break;
        case "investments":
          await assumptionsService.saveInvestmentAssumptions(assumptions.investments, DEFAULT_SCENARIO_KEY);
          break;
        case "inflation":
          await assumptionsService.saveInflationAssumptions(assumptions.inflation, DEFAULT_SCENARIO_KEY);
          break;
        case "loans":
          await assumptionsService.saveLoanAssumptions(assumptions.loans, DEFAULT_SCENARIO_KEY);
          break;
        case "retirement":
          await assumptionsService.saveRetirementAssumptions(assumptions.retirement, DEFAULT_SCENARIO_KEY);
          break;
        case "tax":
          await assumptionsService.saveTaxAssumptions(assumptions.tax, DEFAULT_SCENARIO_KEY);
          break;
        case "planning":
          await assumptionsService.savePlanningHorizon(assumptions.planning, DEFAULT_SCENARIO_KEY);
          break;
      }
      setNotice(`${section.charAt(0).toUpperCase() + section.slice(1)} assumptions saved.`);
      await loadData();
      window.dispatchEvent(new Event("wealthos:assumptions-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save assumptions");
    } finally {
      setSavingSection(null);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Assumptions"
          description="Single control panel for the planning inputs that will drive future financial projections."
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Scenario: <span className="font-medium text-slate-900">{DEFAULT_SCENARIO_KEY}</span> · Planning horizon defaults to <span className="font-medium text-slate-900">2062</span>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        {loading ? (
          <LoadingSpinner label="Loading assumptions..." />
        ) : (
          <ContentContainer className="border-none bg-transparent p-0 shadow-none">
            <div className="grid gap-6 xl:grid-cols-2">
              <SectionFrame
                title="Income"
                description="Salary, growth, bonuses, and earnings cut-off assumptions."
                saving={savingSection === "income"}
                onSave={() => void saveSection("income")}
              >
                <Field label="Monthly Income">
                  <Input type="number" value={assumptions.income.monthlyIncome} onChange={(event) => updateSection("income", { monthlyIncome: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Annual Increment %">
                  <Input type="number" step="0.01" value={assumptions.income.annualIncrementRate} onChange={(event) => updateSection("income", { annualIncrementRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Salary Growth %">
                  <Input type="number" step="0.01" value={assumptions.income.salaryGrowthRate} onChange={(event) => updateSection("income", { salaryGrowthRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Bonus Amount">
                  <Input type="number" value={assumptions.income.bonusAmount} onChange={(event) => updateSection("income", { bonusAmount: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Bonus Month">
                  <Input type="number" min={1} max={12} value={assumptions.income.bonusMonth} onChange={(event) => updateSection("income", { bonusMonth: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Other Monthly Income">
                  <Input type="number" value={assumptions.income.otherMonthlyIncome} onChange={(event) => updateSection("income", { otherMonthlyIncome: numberValue(Number(event.target.value)) })} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Salary Stop Month">
                    <Input type="number" min={1} max={12} value={assumptions.income.salaryStopMonth} onChange={(event) => updateSection("income", { salaryStopMonth: numberValue(Number(event.target.value)) })} />
                  </Field>
                  <Field label="Salary Stop Year">
                    <Input type="number" value={assumptions.income.salaryStopYear} onChange={(event) => updateSection("income", { salaryStopYear: numberValue(Number(event.target.value)) })} />
                  </Field>
                </div>
              </SectionFrame>

              <SectionFrame
                title="Investments"
                description="Contribution and return assumptions for SIPs, stocks, FDs, gold, and real estate."
                saving={savingSection === "investments"}
                onSave={() => void saveSection("investments")}
              >
                <Field label="Monthly SIP Amount">
                  <Input type="number" value={assumptions.investments.monthlySipAmount} onChange={(event) => updateSection("investments", { monthlySipAmount: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Stock Investment Amount">
                  <Input type="number" value={assumptions.investments.stockInvestmentAmount} onChange={(event) => updateSection("investments", { stockInvestmentAmount: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Annual Increment %">
                  <Input type="number" step="0.01" value={assumptions.investments.annualIncrementRate} onChange={(event) => updateSection("investments", { annualIncrementRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Expected Return %">
                  <Input type="number" step="0.01" value={assumptions.investments.expectedReturnRate} onChange={(event) => updateSection("investments", { expectedReturnRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Fixed Deposit Rate %">
                  <Input type="number" step="0.01" value={assumptions.investments.fixedDepositRate} onChange={(event) => updateSection("investments", { fixedDepositRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Gold Appreciation %">
                  <Input type="number" step="0.01" value={assumptions.investments.goldAppreciationRate} onChange={(event) => updateSection("investments", { goldAppreciationRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Real Estate Appreciation %">
                  <Input type="number" step="0.01" value={assumptions.investments.realEstateAppreciationRate} onChange={(event) => updateSection("investments", { realEstateAppreciationRate: numberValue(Number(event.target.value)) })} />
                </Field>
              </SectionFrame>

              <SectionFrame
                title="Inflation"
                description="Model spending pressure across living costs and long-term categories."
                saving={savingSection === "inflation"}
                onSave={() => void saveSection("inflation")}
              >
                <Field label="General Inflation %">
                  <Input type="number" step="0.01" value={assumptions.inflation.generalInflationRate} onChange={(event) => updateSection("inflation", { generalInflationRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Education Inflation %">
                  <Input type="number" step="0.01" value={assumptions.inflation.educationInflationRate} onChange={(event) => updateSection("inflation", { educationInflationRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Healthcare Inflation %">
                  <Input type="number" step="0.01" value={assumptions.inflation.healthcareInflationRate} onChange={(event) => updateSection("inflation", { healthcareInflationRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Retirement Inflation %">
                  <Input type="number" step="0.01" value={assumptions.inflation.retirementInflationRate} onChange={(event) => updateSection("inflation", { retirementInflationRate: numberValue(Number(event.target.value)) })} />
                </Field>
              </SectionFrame>

              <SectionFrame
                title="Loans"
                description="Loan interest, EMI growth, and prepayment preferences."
                saving={savingSection === "loans"}
                onSave={() => void saveSection("loans")}
              >
                <Field label="Average Interest Rate %">
                  <Input type="number" step="0.01" value={assumptions.loans.averageInterestRate} onChange={(event) => updateSection("loans", { averageInterestRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="EMI Increment %">
                  <Input type="number" step="0.01" value={assumptions.loans.emiIncrementRate} onChange={(event) => updateSection("loans", { emiIncrementRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Annual Prepayment Amount">
                  <Input type="number" value={assumptions.loans.annualPrepaymentAmount} onChange={(event) => updateSection("loans", { annualPrepaymentAmount: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="Annual Prepayment Month">
                  <Input type="number" min={1} max={12} value={assumptions.loans.annualPrepaymentMonth} onChange={(event) => updateSection("loans", { annualPrepaymentMonth: numberValue(Number(event.target.value)) })} />
                </Field>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={assumptions.loans.useExtraCashForPrepayment}
                    onChange={(event) => updateSection("loans", { useExtraCashForPrepayment: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Use extra cash for prepayment
                </label>
              </SectionFrame>

              <SectionFrame
                title="Retirement"
                description="Retirement contribution assumptions and salary stop settings."
                saving={savingSection === "retirement"}
                onSave={() => void saveSection("retirement")}
              >
                <Field label="EPF Employee Contribution %">
                  <Input type="number" step="0.01" value={assumptions.retirement.epfEmployeeContributionRate} onChange={(event) => updateSection("retirement", { epfEmployeeContributionRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="EPF Employer Contribution %">
                  <Input type="number" step="0.01" value={assumptions.retirement.epfEmployerContributionRate} onChange={(event) => updateSection("retirement", { epfEmployerContributionRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="NPS Contribution %">
                  <Input type="number" step="0.01" value={assumptions.retirement.npsContributionRate} onChange={(event) => updateSection("retirement", { npsContributionRate: numberValue(Number(event.target.value)) })} />
                </Field>
                <Field label="PPF Monthly Contribution">
                  <Input type="number" value={assumptions.retirement.ppfMonthlyContribution} onChange={(event) => updateSection("retirement", { ppfMonthlyContribution: numberValue(Number(event.target.value)) })} />
                </Field>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Target Age">
                    <Input type="number" value={assumptions.retirement.retirementTargetAge} onChange={(event) => updateSection("retirement", { retirementTargetAge: numberValue(Number(event.target.value)) })} />
                  </Field>
                  <Field label="Salary Stop Month">
                    <Input type="number" min={1} max={12} value={assumptions.retirement.salaryStopMonth} onChange={(event) => updateSection("retirement", { salaryStopMonth: numberValue(Number(event.target.value)) })} />
                  </Field>
                  <Field label="Salary Stop Year">
                    <Input type="number" value={assumptions.retirement.salaryStopYear} onChange={(event) => updateSection("retirement", { salaryStopYear: numberValue(Number(event.target.value)) })} />
                  </Field>
                </div>
              </SectionFrame>

              <SectionFrame
                title="Planning"
                description="Define the projection window for monthly simulation."
                saving={savingSection === "planning"}
                onSave={() => void saveSection("planning")}
              >
                <Field label="Start Month">
                  <Input type="month" value={assumptions.planning.startMonth} onChange={(event) => updateSection("planning", { startMonth: event.target.value })} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="End Year">
                    <Input type="number" value={assumptions.planning.endYear} onChange={(event) => updateSection("planning", { endYear: numberValue(Number(event.target.value)) })} />
                  </Field>
                  <Field label="End Month">
                    <Input type="number" min={1} max={12} value={assumptions.planning.endMonth} onChange={(event) => updateSection("planning", { endMonth: numberValue(Number(event.target.value)) })} />
                  </Field>
                </div>
              </SectionFrame>

              <DashboardCard className="border-dashed border-slate-300 bg-slate-50 xl:col-span-2">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900">Tax</h2>
                  <p className="text-sm text-slate-600">Placeholder assumptions for future tax modeling. The Projection Engine will read this data later, but no tax calculations are implemented yet.</p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Regime">
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-transparent px-3 py-1 text-sm"
                      value={assumptions.tax.regime}
                      onChange={(event) => updateSection("tax", { regime: event.target.value as AssumptionsBundle["tax"]["regime"] })}
                    >
                      <option value="new">New</option>
                      <option value="old">Old</option>
                      <option value="custom">Custom</option>
                    </select>
                  </Field>
                  <Field label="Effective Tax %">
                    <Input type="number" step="0.01" value={assumptions.tax.effectiveTaxRate} onChange={(event) => updateSection("tax", { effectiveTaxRate: numberValue(Number(event.target.value)) })} />
                  </Field>
                  <Field label="Surcharge %">
                    <Input type="number" step="0.01" value={assumptions.tax.surchargeRate} onChange={(event) => updateSection("tax", { surchargeRate: numberValue(Number(event.target.value)) })} />
                  </Field>
                  <Field label="Cess %">
                    <Input type="number" step="0.01" value={assumptions.tax.cessRate} onChange={(event) => updateSection("tax", { cessRate: numberValue(Number(event.target.value)) })} />
                  </Field>
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="tax-note">Notes</Label>
                  <Textarea id="tax-note" value={assumptions.tax.note} onChange={(event) => updateSection("tax", { note: event.target.value })} />
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => void saveSection("tax")} disabled={savingSection === "tax"}>
                    {savingSection === "tax" ? "Saving..." : "Save tax placeholder"}
                  </Button>
                </div>
              </DashboardCard>
            </div>
          </ContentContainer>
        )}
      </PageContainer>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}