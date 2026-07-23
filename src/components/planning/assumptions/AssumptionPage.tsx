"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Layers3, SlidersHorizontal, Sparkles } from "lucide-react";

import { AssumptionForm } from "@/components/planning/assumptions/AssumptionForm";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import {
  planningAssumptionService,
  PLANNING_ASSUMPTION_FIELD_DEFINITIONS,
  validatePlanningAssumptionValue,
} from "@/services/planning/assumptions";
import type {
  EffectivePlanningAssumptions,
  PlanningAssumptionCategoryKey,
  PlanningAssumptionEditorState,
  PlanningAssumptionKey,
  PlanningAssumptionOverrides,
  PlanningAssumptionScopeSelection,
} from "@/services/planning/assumptions";

function buildDraftValues(values: EffectivePlanningAssumptions): Partial<Record<PlanningAssumptionKey, string>> {
  const draft: Partial<Record<PlanningAssumptionKey, string>> = {};

  for (const field of PLANNING_ASSUMPTION_FIELD_DEFINITIONS) {
    draft[field.key] = String(values[field.key]);
  }

  return draft;
}

function parseDraftValue(key: PlanningAssumptionKey, rawValue: string): EffectivePlanningAssumptions[PlanningAssumptionKey] {
  const field = PLANNING_ASSUMPTION_FIELD_DEFINITIONS.find((item) => item.key === key);
  if (!field) {
    throw new Error(`Unknown planning assumption field: ${key}`);
  }

  if (field.inputKind === "select") {
    return rawValue as EffectivePlanningAssumptions[PlanningAssumptionKey];
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    throw new Error(`${field.label} must be a valid number.`);
  }

  return numericValue as EffectivePlanningAssumptions[PlanningAssumptionKey];
}

function assignPatchValue<Key extends PlanningAssumptionKey>(
  patch: PlanningAssumptionOverrides,
  key: Key,
  value: EffectivePlanningAssumptions[Key],
) {
  patch[key] = value;
}

export function PlanningAssumptionPage() {
  const [loading, setLoading] = useState(true);
  const [editorState, setEditorState] = useState<PlanningAssumptionEditorState | null>(null);
  const [draftValues, setDraftValues] = useState<Partial<Record<PlanningAssumptionKey, string>>>({});
  const [validationErrors, setValidationErrors] = useState<Partial<Record<PlanningAssumptionKey, string>>>({});
  const [expandedSections, setExpandedSections] = useState<Partial<Record<PlanningAssumptionCategoryKey, boolean>>>({
    PERSONAL: true,
    INCOME: true,
    INFLATION: true,
    INVESTMENTS: true,
    LOANS: true,
    TAXES: true,
    RETIREMENT: true,
  });
  const [savingSection, setSavingSection] = useState<PlanningAssumptionCategoryKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeScenario = useMemo(
    () => editorState?.scenarios.find((scenario) => scenario.id === editorState.activeScenarioId) ?? null,
    [editorState],
  );

  function applyEditorState(nextState: PlanningAssumptionEditorState) {
    setEditorState(nextState);
    setDraftValues(buildDraftValues(nextState.effective));
    setValidationErrors({});
  }

  async function loadEditorState(scope?: PlanningAssumptionScopeSelection) {
    const nextState = await planningAssumptionService.getEditorState(scope);
    applyEditorState(nextState);
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        setLoading(true);
        const nextState = await planningAssumptionService.getEditorState();
        if (!mounted) {
          return;
        }

        applyEditorState(nextState);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load planning assumptions.");
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
  }, []);

  function handleFieldChange(key: PlanningAssumptionKey, value: string) {
    setDraftValues((current) => ({
      ...current,
      [key]: value,
    }));

    try {
      const parsedValue = parseDraftValue(key, value);
      const issue = validatePlanningAssumptionValue(key, parsedValue);
      setValidationErrors((current) => ({
        ...current,
        [key]: issue ?? undefined,
      }));
    } catch (parseError) {
      setValidationErrors((current) => ({
        ...current,
        [key]: parseError instanceof Error ? parseError.message : "Invalid value.",
      }));
    }
  }

  async function handleSaveSection(category: PlanningAssumptionCategoryKey) {
    if (!editorState) {
      return;
    }

    const fieldKeys = PLANNING_ASSUMPTION_FIELD_DEFINITIONS.filter((field) => field.category === category).map((field) => field.key);
    const patch: PlanningAssumptionOverrides = {};
    const nextErrors: Partial<Record<PlanningAssumptionKey, string>> = {};

    for (const key of fieldKeys) {
      try {
        const parsedValue = parseDraftValue(key, draftValues[key] ?? String(editorState.effective[key]));
        const issue = validatePlanningAssumptionValue(key, parsedValue);
        if (issue) {
          nextErrors[key] = issue;
          continue;
        }

        assignPatchValue(patch, key, parsedValue);
      } catch (parseError) {
        nextErrors[key] = parseError instanceof Error ? parseError.message : "Invalid value.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors((current) => ({ ...current, ...nextErrors }));
      return;
    }

    try {
      setSavingSection(category);
      const nextState = await planningAssumptionService.updateScopeValues(editorState.scope, patch);
      applyEditorState(nextState);
      setNotice(`${category.charAt(0) + category.slice(1).toLowerCase()} assumptions saved.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save assumption changes.");
    } finally {
      setSavingSection(null);
    }
  }

  async function handleResetField(key: PlanningAssumptionKey) {
    if (!editorState) {
      return;
    }

    try {
      const nextState = await planningAssumptionService.resetScopeValues(editorState.scope, [key]);
      applyEditorState(nextState);
      setNotice("Assumption reset to inherited default.");
      setError(null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset assumption.");
    }
  }

  async function handleResetSection(category: PlanningAssumptionCategoryKey) {
    if (!editorState) {
      return;
    }

    try {
      const fieldKeys = PLANNING_ASSUMPTION_FIELD_DEFINITIONS.filter((field) => field.category === category).map((field) => field.key);
      const nextState = await planningAssumptionService.resetScopeValues(editorState.scope, fieldKeys);
      applyEditorState(nextState);
      setNotice(`${category.charAt(0) + category.slice(1).toLowerCase()} assumptions reset.`);
      setError(null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset section.");
    }
  }

  async function handleActivateScenario(scenarioId: string) {
    try {
      setLoading(true);
      await planningAssumptionService.setActiveScenario(scenarioId);
      await loadEditorState({ level: "SCENARIO", scenarioId });
      setNotice("Active planning scenario updated.");
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Unable to switch scenarios.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenUserDefaults() {
    try {
      setLoading(true);
      await loadEditorState({ level: "USER_DEFAULTS" });
    } catch (scopeError) {
      setError(scopeError instanceof Error ? scopeError.message : "Unable to load user defaults.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCustomScenario() {
    const scenarioName = window.prompt("Enter custom scenario name", "Custom Scenario");
    if (!scenarioName) {
      return;
    }

    try {
      setLoading(true);
      const scenarios = await planningAssumptionService.createCustomScenario(scenarioName);
      const createdScenario = scenarios.find((scenario) => scenario.name === scenarioName.trim()) ?? scenarios.at(-1) ?? null;

      if (!createdScenario) {
        throw new Error("Custom scenario could not be created.");
      }

      await handleActivateScenario(createdScenario.id);
      setNotice("Custom scenario created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create custom scenario.");
      setLoading(false);
    }
  }

  if (loading && !editorState) {
    return (
      <AppLayout>
        <PageContainer>
          <PageHeader title="Planning Assumptions" description="Loading the centralized assumptions foundation for WealthOS 2.0." />
          <LoadingSpinner label="Loading assumptions foundation..." />
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Planning Assumptions"
          description="The central assumptions engine for every planning scenario, goal override and deterministic WealthOS forecast."
        />

        <ContentCard className="overflow-hidden border-slate-900 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#0f172a_58%,#1e293b_100%)] text-white">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200">
                <Layers3 className="h-3.5 w-3.5" />
                WealthOS 2.0 Foundation
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight">One assumptions engine for every future planning decision.</h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                  Global system defaults cascade into user defaults, then into planning scenarios, then into optional goal overrides. Downstream engines should only read effective assumptions from this module.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">1. Global Defaults</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">2. User Defaults</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">3. Scenario Overrides</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">4. Goal Overrides</div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Active Scenario</p>
                <p className="mt-2 text-xl font-semibold">{activeScenario?.name ?? "None"}</p>
                <p className="mt-1 text-sm text-slate-300">{activeScenario?.description ?? "No active scenario selected."}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Editing Scope</p>
                <p className="mt-2 text-xl font-semibold">{editorState?.scope.level === "USER_DEFAULTS" ? "User Defaults" : editorState?.scope.level === "SCENARIO" ? "Scenario Assumptions" : "Goal Overrides"}</p>
                <p className="mt-1 text-sm text-slate-300">Switch scope without duplicating values unnecessarily.</p>
              </div>
            </div>
          </div>
        </ContentCard>

        {editorState ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <ContentCard className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <SlidersHorizontal className="h-4 w-4" />
                  Scope Controls
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant={editorState.scope.level === "USER_DEFAULTS" ? "default" : "outline"}
                    onClick={() => {
                      void handleOpenUserDefaults();
                    }}
                  >
                    User Defaults
                  </Button>
                  <div className="min-w-[260px] flex-1">
                    <select
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900"
                      value={editorState.scope.level === "SCENARIO" ? editorState.scope.scenarioId : editorState.activeScenarioId ?? ""}
                      onChange={(event) => {
                        void handleActivateScenario(event.target.value);
                      }}
                    >
                      {editorState.scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void handleCreateCustomScenario()}>
                    <Sparkles className="h-4 w-4" />
                    Create Custom Scenario
                  </Button>
                </div>
              </ContentCard>

              <ContentCard className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <ArrowRightLeft className="h-4 w-4" />
                  Inheritance Notes
                </div>
                <div className="space-y-3 text-sm leading-6 text-slate-600">
                  <p>Scenario selection changes the active planning assumption layer used by downstream planning calculations.</p>
                  <p>Resetting a value removes the current override and reveals the lower-level inherited value instead of copying duplicate data.</p>
                  <p>Recommended values come from the system baseline for user defaults and from the preset template for Conservative, Base and Optimistic scenarios.</p>
                </div>
              </ContentCard>
            </div>

            <AssumptionForm
              currentValues={editorState.effective}
              recommendedValues={editorState.recommended}
              inheritedValues={editorState.inherited}
              overrides={editorState.overrides}
              draftValues={draftValues}
              validationErrors={validationErrors}
              expandedSections={expandedSections}
              savingSection={savingSection}
              onToggleSection={(category) => {
                setExpandedSections((current) => ({
                  ...current,
                  [category]: !(current[category] ?? true),
                }));
              }}
              onFieldChange={handleFieldChange}
              onResetField={(key) => {
                void handleResetField(key);
              }}
              onResetSection={(category) => {
                void handleResetSection(category);
              }}
              onSaveSection={(category) => {
                void handleSaveSection(category);
              }}
            />
          </>
        ) : null}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
      </PageContainer>
    </AppLayout>
  );
}