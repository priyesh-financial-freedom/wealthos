"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AssumptionDataType } from "@/types/assumptions";
import type { AssumptionWithValue } from "@/types/assumptions";

interface AssumptionEditorProps {
  assumptions: AssumptionWithValue[];
  mode: "SIMPLE" | "ADVANCED";
  search: string;
  onModeChange: (mode: "SIMPLE" | "ADVANCED") => void;
  onSearchChange: (search: string) => void;
  onSaveAssumption: (assumptionId: string, value: unknown) => Promise<void>;
  savingAssumptionId: string | null;
}

function toInputNumber(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function toTextValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function AssumptionEditor({ assumptions, mode, search, onModeChange, onSearchChange, onSaveAssumption, savingAssumptionId }: AssumptionEditorProps) {
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>({});

  const filteredAssumptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return assumptions.filter((assumption) => {
      if (mode === "SIMPLE" && assumption.advancedOnly) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        assumption.name.toLowerCase().includes(normalizedSearch) ||
        assumption.key.toLowerCase().includes(normalizedSearch) ||
        (assumption.helpText ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [assumptions, mode, search]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assumption Editor</h2>
        <div className="flex gap-2">
          <Button type="button" variant={mode === "SIMPLE" ? "default" : "outline"} size="sm" onClick={() => onModeChange("SIMPLE")}>
            Simple Mode
          </Button>
          <Button type="button" variant={mode === "ADVANCED" ? "default" : "outline"} size="sm" onClick={() => onModeChange("ADVANCED")}>
            Advanced Mode
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search assumptions by name, key or help text"
          aria-label="Search assumptions"
        />
      </div>

      <div className="mt-4 space-y-3">
        {filteredAssumptions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">No assumptions match the selected filters.</p>
        ) : (
          filteredAssumptions.map((assumption) => {
            const hasDraftValue = Object.prototype.hasOwnProperty.call(draftValues, assumption.id);
            const currentValue = hasDraftValue ? draftValues[assumption.id] : assumption.currentValue;

            return (
              <article key={assumption.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{assumption.name}</h3>
                  <p className="text-xs text-slate-600">{assumption.key}</p>
                </div>
                {assumption.advancedOnly ? <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs text-white">Advanced</span> : null}
              </div>

              <div className="mt-3">{renderInput(assumption, currentValue, (value) => setDraftValues((current) => ({ ...current, [assumption.id]: value })))}</div>

              {assumption.helpText ? <p className="mt-2 text-xs text-slate-500">{assumption.helpText}</p> : null}

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {assumption.required ? "Required" : "Optional"}
                  {assumption.unit ? ` • Unit: ${assumption.unit}` : ""}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onSaveAssumption(assumption.id, currentValue)}
                  disabled={savingAssumptionId === assumption.id}
                >
                  {savingAssumptionId === assumption.id ? "Saving..." : "Save"}
                </Button>
              </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function renderInput(assumption: AssumptionWithValue, value: unknown, onChange: (value: unknown) => void) {
  switch (assumption.dataType) {
    case AssumptionDataType.Boolean:
      return (
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>Enabled</span>
        </label>
      );
    case AssumptionDataType.Text:
      return <Textarea value={toTextValue(value)} onChange={(event) => onChange(event.target.value)} />;
    case AssumptionDataType.Month:
      return <Input type="month" value={toTextValue(value)} onChange={(event) => onChange(event.target.value)} />;
    case AssumptionDataType.Enum:
      return (
        <select
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={toTextValue(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {(assumption.allowedValues ?? []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      );
    case AssumptionDataType.Integer:
      return (
        <Input
          type="number"
          step="1"
          value={toInputNumber(value)}
          onChange={(event) => onChange(event.target.value === "" ? null : Number.parseInt(event.target.value, 10))}
        />
      );
    case AssumptionDataType.Number:
    case AssumptionDataType.Currency:
    case AssumptionDataType.Percentage:
    default:
      return (
        <Input
          type="number"
          step="0.01"
          value={toInputNumber(value)}
          onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        />
      );
  }
}
