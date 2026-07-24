"use client";

import { ChevronDown, ChevronRight, RotateCcw, Save } from "lucide-react";

import { AssumptionHelpPopover } from "@/components/planning/assumptions/AssumptionHelpPopover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { PLANNING_ASSUMPTION_FIELD_DEFINITIONS, PLANNING_ASSUMPTION_SECTIONS } from "@/services/planning/assumptions";
import type {
  EffectivePlanningAssumptions,
  PlanningFamilyProfile,
  PlanningAssumptionCategoryKey,
  PlanningAssumptionFieldDefinition,
  PlanningAssumptionKey,
  PlanningAssumptionOverrides,
} from "@/services/planning/assumptions";

interface AssumptionFormProps {
  currentValues: EffectivePlanningAssumptions;
  recommendedValues: EffectivePlanningAssumptions;
  inheritedValues: EffectivePlanningAssumptions;
  overrides: PlanningAssumptionOverrides;
  draftValues: Partial<Record<PlanningAssumptionKey, string>>;
  validationErrors: Partial<Record<PlanningAssumptionKey, string>>;
  familyProfile: PlanningFamilyProfile;
  familyProfileDraft: { primaryDateOfBirth: string; spouseDateOfBirth: string };
  familyProfileErrors: { primaryDateOfBirth?: string; spouseDateOfBirth?: string };
  familyProfileSaving: boolean;
  expandedSections: Partial<Record<PlanningAssumptionCategoryKey, boolean>>;
  savingSection: PlanningAssumptionCategoryKey | null;
  onToggleSection: (category: PlanningAssumptionCategoryKey) => void;
  onFieldChange: (key: PlanningAssumptionKey, value: string) => void;
  onFamilyProfileFieldChange: (key: "primaryDateOfBirth" | "spouseDateOfBirth", value: string) => void;
  onSaveFamilyProfile: () => void;
  onResetField: (key: PlanningAssumptionKey) => void;
  onResetSection: (category: PlanningAssumptionCategoryKey) => void;
  onSaveSection: (category: PlanningAssumptionCategoryKey) => void;
}

function getFieldDefinition(key: PlanningAssumptionKey): PlanningAssumptionFieldDefinition {
  const definition = PLANNING_ASSUMPTION_FIELD_DEFINITIONS.find((item) => item.key === key);
  if (!definition) {
    throw new Error(`Missing field definition for ${key}.`);
  }

  return definition;
}

function formatAssumptionValue(definition: PlanningAssumptionFieldDefinition, value: EffectivePlanningAssumptions[PlanningAssumptionKey]) {
  if (definition.inputKind === "currency" && typeof value === "number") {
    return formatCurrency(value, { maximumFractionDigits: 0 });
  }

  if (definition.inputKind === "percentage" && typeof value === "number") {
    return formatPercent(value, { multiply: false, digits: 1 });
  }

  if (definition.inputKind === "integer" && typeof value === "number") {
    return formatNumber(value);
  }

  return String(value);
}

function formatDifference(definition: PlanningAssumptionFieldDefinition, currentValue: EffectivePlanningAssumptions[PlanningAssumptionKey], recommendedValue: EffectivePlanningAssumptions[PlanningAssumptionKey]) {
  if (typeof currentValue === "number" && typeof recommendedValue === "number") {
    const difference = currentValue - recommendedValue;
    const prefix = difference > 0 ? "+" : difference < 0 ? "-" : "";
    const absolute = Math.abs(difference);

    if (definition.inputKind === "currency") {
      return `${prefix}${formatCurrency(absolute, { maximumFractionDigits: 0 })}`;
    }

    if (definition.inputKind === "percentage") {
      return `${prefix}${absolute.toFixed(1)}%`;
    }

    return `${prefix}${formatNumber(absolute)}`;
  }

  return currentValue === recommendedValue ? "Aligned" : "Different";
}

export function AssumptionForm({
  currentValues,
  recommendedValues,
  inheritedValues,
  overrides,
  draftValues,
  validationErrors,
  familyProfile,
  familyProfileDraft,
  familyProfileErrors,
  familyProfileSaving,
  expandedSections,
  savingSection,
  onToggleSection,
  onFieldChange,
  onFamilyProfileFieldChange,
  onSaveFamilyProfile,
  onResetField,
  onResetSection,
  onSaveSection,
}: AssumptionFormProps) {
  return (
    <div className="space-y-5">
      {PLANNING_ASSUMPTION_SECTIONS.map((section) => {
        const isExpanded = expandedSections[section.category] ?? true;
        const isSaving = savingSection === section.category;

        return (
          <section key={section.category} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <button
                type="button"
                className="flex items-center gap-3 text-left"
                onClick={() => onToggleSection(section.category)}
              >
                <span className="rounded-full border border-slate-200 bg-slate-50 p-1 text-slate-600">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{section.label}</p>
                  <p className="text-sm text-slate-600">{section.description}</p>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onResetSection(section.category)}>
                  <RotateCcw className="h-4 w-4" />
                  Reset to Default
                </Button>
                <Button type="button" size="sm" onClick={() => onSaveSection(section.category)} disabled={isSaving}>
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>

            {isExpanded ? (
              <div className="grid gap-4 p-5 lg:grid-cols-2">
                {section.category === "PERSONAL" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 lg:col-span-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Planner Family Profile</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">Primary and spouse date of birth are the canonical source for age-dependent planning.</p>
                      </div>
                      <Button type="button" size="sm" onClick={onSaveFamilyProfile} disabled={familyProfileSaving}>
                        {familyProfileSaving ? "Saving..." : "Save DOB"}
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Primary Date Of Birth</p>
                        <Input
                          type="date"
                          value={familyProfileDraft.primaryDateOfBirth}
                          onChange={(event) => onFamilyProfileFieldChange("primaryDateOfBirth", event.target.value)}
                          className="bg-white"
                        />
                        {familyProfileErrors.primaryDateOfBirth ? <p className="text-xs font-medium text-rose-600">{familyProfileErrors.primaryDateOfBirth}</p> : null}
                        <p className="text-xs text-slate-600">Current Age (read-only): <span className="font-semibold text-slate-900">{familyProfile.primaryCurrentAge}</span></p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Spouse Date Of Birth</p>
                        <Input
                          type="date"
                          value={familyProfileDraft.spouseDateOfBirth}
                          onChange={(event) => onFamilyProfileFieldChange("spouseDateOfBirth", event.target.value)}
                          className="bg-white"
                        />
                        {familyProfileErrors.spouseDateOfBirth ? <p className="text-xs font-medium text-rose-600">{familyProfileErrors.spouseDateOfBirth}</p> : null}
                        <p className="text-xs text-slate-600">Current Age (read-only): <span className="font-semibold text-slate-900">{familyProfile.spouseCurrentAge ?? "Not set"}</span></p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {section.fieldKeys.map((fieldKey) => {
                  const definition = getFieldDefinition(fieldKey);
                  const currentValue = currentValues[fieldKey];
                  const recommendedValue = recommendedValues[fieldKey];
                  const inheritedValue = inheritedValues[fieldKey];
                  const isOverridden = typeof overrides[fieldKey] !== "undefined";
                  const inputValue = draftValues[fieldKey] ?? String(currentValue);
                  const validationError = validationErrors[fieldKey] ?? null;

                  return (
                    <div key={fieldKey} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{definition.label}</p>
                            <AssumptionHelpPopover label={definition.label} helpContent={definition.helpContent} />
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-600">{definition.description}</p>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isOverridden ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                          {isOverridden ? "Override" : "Inherited"}
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {definition.inputKind === "select" ? (
                          <select
                            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900"
                            value={inputValue}
                            onChange={(event) => onFieldChange(fieldKey, event.target.value)}
                          >
                            {(definition.options ?? []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type="number"
                            min={definition.min}
                            max={definition.max}
                            step={definition.step}
                            value={inputValue}
                            onChange={(event) => onFieldChange(fieldKey, event.target.value)}
                            className="bg-white"
                          />
                        )}

                        {validationError ? <p className="text-xs font-medium text-rose-600">{validationError}</p> : null}

                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{formatAssumptionValue(definition, currentValue)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{formatAssumptionValue(definition, recommendedValue)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Difference</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDifference(definition, currentValue, recommendedValue)}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span>Inherited baseline: {formatAssumptionValue(definition, inheritedValue)}</span>
                          <button type="button" className="font-semibold text-slate-700 hover:text-slate-950" onClick={() => onResetField(fieldKey)}>
                            Reset Field
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}