"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  planningAssumptionService,
  type EffectivePlanningAssumptions,
  type PlanningAssumptionEditorState,
  type PlanningAssumptionOverrides,
  type PlanningAssumptionScopeSelection,
} from "@/services/planning/assumptions";

const FIELD_GROUPS = [
  {
    title: "Income",
    fields: [
      { key: "salaryGrowthRate", label: "Salary Growth %", min: 0, max: 30, step: "0.1" },
      { key: "retirementAge", label: "Retirement Age", min: 40, max: 80, step: "1" },
    ],
  },
  {
    title: "Investments",
    fields: [
      { key: "equityReturn", label: "Equity Investments Return %", min: 0, max: 25, step: "0.1" },
      { key: "npsEquityReturn", label: "NPS Expected Return %", min: 0, max: 25, step: "0.1" },
      { key: "epfReturn", label: "EPF Return %", min: 0, max: 15, step: "0.1" },
      { key: "ppfReturn", label: "PPF Return %", min: 0, max: 15, step: "0.1" },
      { key: "debtReturn", label: "Fixed Deposit Return %", min: 0, max: 20, step: "0.1" },
      { key: "goldReturn", label: "Gold Return %", min: 0, max: 20, step: "0.1" },
      { key: "realEstateReturn", label: "Property Appreciation %", min: 0, max: 20, step: "0.1" },
      { key: "cashReturn", label: "Cash / Savings Return %", min: 0, max: 15, step: "0.1" },
      { key: "monthlySipAmount", label: "Monthly SIP", min: 0, max: 100000000, step: "100" },
    ],
  },
  {
    title: "Loans",
    fields: [
      { key: "homeLoanInterest", label: "Home Loan Interest %", min: 0, max: 20, step: "0.1" },
      { key: "annualPrepaymentAmount", label: "Annual Prepayment Amount", min: 0, max: 1000000000, step: "1000" },
    ],
  },
  {
    title: "Inflation",
    fields: [{ key: "generalInflation", label: "General Inflation %", min: 0, max: 20, step: "0.1" }],
  },
] as const;

type FieldKey = (typeof FIELD_GROUPS)[number]["fields"][number]["key"];

function buildDraftValues(values: EffectivePlanningAssumptions): Partial<Record<FieldKey, string>> {
  const draft: Partial<Record<FieldKey, string>> = {};

  for (const group of FIELD_GROUPS) {
    for (const field of group.fields) {
      draft[field.key] = String(values[field.key]);
    }
  }

  return draft;
}

function parseFieldValue(key: FieldKey, rawValue: string): number {
  if (key === "retirementAge") {
    const parsed = Number.parseInt(rawValue, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Field({
  definition,
  value,
  onChange,
}: {
  definition: (typeof FIELD_GROUPS)[number]["fields"][number];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
      <Label htmlFor={definition.key} className="text-sm font-medium text-slate-900">
        {definition.label}
      </Label>
      <Input
        id={definition.key}
        type="number"
        min={definition.min}
        max={definition.max}
        step={definition.step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default function MyFinancialPlanPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<PlanningAssumptionEditorState | null>(null);
  const [draftValues, setDraftValues] = useState<Partial<Record<FieldKey, string>>>({});

  const activeScenario = useMemo(
    () => editorState?.scenarios.find((scenario) => scenario.id === editorState.activeScenarioId) ?? null,
    [editorState],
  );

  const loadPlan = useCallback(async (scope?: PlanningAssumptionScopeSelection) => {
    const nextState = await planningAssumptionService.getEditorState(scope);
    setEditorState(nextState);
    setDraftValues(buildDraftValues(nextState.effective.values));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        await loadPlan();
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your financial plan.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [loadPlan]);

  function handleFieldChange(key: FieldKey, value: string) {
    setDraftValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSave() {
    if (!editorState) {
      return;
    }

    const patch: Partial<Pick<EffectivePlanningAssumptions, FieldKey>> = {};

    for (const group of FIELD_GROUPS) {
      for (const field of group.fields) {
        patch[field.key] = parseFieldValue(field.key, draftValues[field.key] ?? String(editorState.effective.values[field.key]));
      }
    }

    try {
      setSaving(true);
      setError(null);
      const nextState = await planningAssumptionService.updateScopeValues(editorState.scope, patch as PlanningAssumptionOverrides);
      setEditorState(nextState);
      setDraftValues(buildDraftValues(nextState.effective.values));
      setNotice("Saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your financial plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="My Financial Plan"
          description="Keep the future assumptions that shape your plan in one simple place."
          summary={activeScenario ? `Working in ${activeScenario.name}` : "Loading your plan"}
        />

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        {loading ? (
          <LoadingSpinner label="Loading your financial plan..." />
        ) : (
          <div className="space-y-6">
            {FIELD_GROUPS.map((group) => (
              <ContentCard key={group.title} className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">{group.title}</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.fields.map((field) => (
                    <Field
                      key={field.key}
                      definition={field}
                      value={draftValues[field.key] ?? ""}
                      onChange={(value) => handleFieldChange(field.key, value)}
                    />
                  ))}
                </div>
              </ContentCard>
            ))}

            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} disabled={saving} className="min-w-28">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}