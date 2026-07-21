"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ContributionFrequency,
  ContributionGrowthStrategy,
  ContributionPolicy,
  ContributionPolicyCreateInput,
} from "@/types/contributionPolicy";

interface ContributionEditorProps {
  initialData?: ContributionPolicy | null;
  onSubmit: (input: ContributionPolicyCreateInput) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

interface ContributionEditorState {
  name: string;
  description: string;
  targetAccount: string;
  amount: number | string;
  currency: string;
  frequency: ContributionFrequency;
  startDate: string;
  endDate: string;
  growthStrategy: ContributionGrowthStrategy;
  growthRate: number | string;
  growthAmount: number | string;
}

function defaultState(initialData?: ContributionPolicy | null): ContributionEditorState {
  return {
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    targetAccount: initialData?.targetAccount ?? "",
    amount: initialData?.amount ?? "",
    currency: initialData?.currency ?? "INR",
    frequency: initialData?.frequency ?? "MONTHLY",
    startDate: initialData?.startDate ?? "",
    endDate: initialData?.endDate ?? "",
    growthStrategy: initialData?.growthStrategy ?? "FIXED",
    growthRate: initialData?.growthRate ?? "",
    growthAmount: initialData?.growthAmount ?? "",
  };
}

export function ContributionEditor({ initialData, onSubmit, onCancel, submitting = false }: ContributionEditorProps) {
  const [values, setValues] = useState<ContributionEditorState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isStepUpPercentage = values.growthStrategy === "STEP_UP_PERCENTAGE";
  const isStepUpAmount = values.growthStrategy === "STEP_UP_AMOUNT";

  const title = useMemo(() => (initialData ? "Edit Contribution Policy" : "Create Contribution Policy"), [initialData]);

  function updateField<K extends keyof ContributionEditorState>(key: K, value: ContributionEditorState[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function validate(nextValues: ContributionEditorState) {
    const issues: Record<string, string> = {};

    if (!nextValues.name.trim()) {
      issues.name = "Policy name is required.";
    }

    if (!Number.isFinite(Number(nextValues.amount)) || Number(nextValues.amount) <= 0) {
      issues.amount = "Contribution amount must be greater than zero.";
    }

    if (!nextValues.startDate) {
      issues.startDate = "Start date is required.";
    }

    if (nextValues.endDate && nextValues.startDate && new Date(nextValues.endDate) < new Date(nextValues.startDate)) {
      issues.endDate = "End date must be on or after start date.";
    }

    if (nextValues.growthStrategy === "STEP_UP_PERCENTAGE") {
      if (!Number.isFinite(Number(nextValues.growthRate)) || Number(nextValues.growthRate) < 0) {
        issues.growthRate = "Growth rate is required and cannot be negative.";
      }
    }

    if (nextValues.growthStrategy === "STEP_UP_AMOUNT") {
      if (!Number.isFinite(Number(nextValues.growthAmount)) || Number(nextValues.growthAmount) < 0) {
        issues.growthAmount = "Growth amount is required and cannot be negative.";
      }
    }

    return issues;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues = validate(values);
    setErrors(issues);

    if (Object.keys(issues).length > 0) {
      return;
    }

    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || null,
      targetAccount: values.targetAccount.trim() || null,
      amount: Number(values.amount),
      currency: values.currency.trim() || "INR",
      frequency: values.frequency,
      startDate: values.startDate,
      endDate: values.endDate || null,
      growthStrategy: values.growthStrategy,
      growthRate: isStepUpPercentage ? Number(values.growthRate) : null,
      growthAmount: isStepUpAmount ? Number(values.growthAmount) : null,
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">Configure recurring contribution rules without embedding business logic in UI components.</p>
      </div>

      <FormGrid>
        <FormField className="md:col-span-2">
          <Label htmlFor="policy_name">Policy Name</Label>
          <Input id="policy_name" value={values.name} onChange={(event) => updateField("name", event.target.value)} />
          {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" min="0" step="0.01" value={values.amount} onChange={(event) => updateField("amount", event.target.value)} />
          {errors.amount ? <p className="text-xs text-rose-600">{errors.amount}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" value={values.currency} onChange={(event) => updateField("currency", event.target.value.toUpperCase())} maxLength={3} />
        </FormField>

        <FormField>
          <Label htmlFor="frequency">Frequency</Label>
          <select
            id="frequency"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.frequency}
            onChange={(event) => updateField("frequency", event.target.value as ContributionFrequency)}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUALLY">Annually</option>
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="target_account">Target Account</Label>
          <Input id="target_account" value={values.targetAccount} onChange={(event) => updateField("targetAccount", event.target.value)} placeholder="e.g. Equity Mutual Funds" />
        </FormField>

        <FormField>
          <Label htmlFor="start_date">Start Date</Label>
          <Input id="start_date" type="date" value={values.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
          {errors.startDate ? <p className="text-xs text-rose-600">{errors.startDate}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="end_date">End Date (optional)</Label>
          <Input id="end_date" type="date" value={values.endDate} onChange={(event) => updateField("endDate", event.target.value)} />
          {errors.endDate ? <p className="text-xs text-rose-600">{errors.endDate}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="growth_strategy">Growth Strategy</Label>
          <select
            id="growth_strategy"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.growthStrategy}
            onChange={(event) => updateField("growthStrategy", event.target.value as ContributionGrowthStrategy)}
          >
            <option value="FIXED">Fixed</option>
            <option value="STEP_UP_PERCENTAGE">Annual Step-up (%)</option>
            <option value="STEP_UP_AMOUNT">Annual Step-up (Amount)</option>
          </select>
        </FormField>

        {isStepUpPercentage ? (
          <FormField>
            <Label htmlFor="growth_rate">Growth Rate (%)</Label>
            <Input id="growth_rate" type="number" min="0" step="0.01" value={values.growthRate} onChange={(event) => updateField("growthRate", event.target.value)} />
            {errors.growthRate ? <p className="text-xs text-rose-600">{errors.growthRate}</p> : null}
          </FormField>
        ) : null}

        {isStepUpAmount ? (
          <FormField>
            <Label htmlFor="growth_amount">Growth Amount</Label>
            <Input id="growth_amount" type="number" min="0" step="0.01" value={values.growthAmount} onChange={(event) => updateField("growthAmount", event.target.value)} />
            {errors.growthAmount ? <p className="text-xs text-rose-600">{errors.growthAmount}</p> : null}
          </FormField>
        ) : null}

        <FormField className="md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={values.description} onChange={(event) => updateField("description", event.target.value)} rows={3} />
        </FormField>
      </FormGrid>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : initialData ? "Update Policy" : "Create Policy"}</Button>
      </FormActions>
    </form>
  );
}
