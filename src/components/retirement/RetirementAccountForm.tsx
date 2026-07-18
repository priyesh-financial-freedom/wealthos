"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RetirementAccount, RetirementAccountInsert, RetirementAccountType } from "@/types/retirementAccount";

interface RetirementAccountFormProps {
  initialData?: RetirementAccount | null;
  onSubmit: (values: RetirementAccountInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type RetirementAccountFormState = {
  account_type: RetirementAccountType;
  institution: string;
  account_number: string;
  holder_name: string;
  opening_date: string;
  current_value: number | string;
  monthly_contribution: number | string;
  annual_contribution: number | string;
  interest_rate: number | string;
  nominee: string;
  notes: string;
};

const defaultState = (initialData?: RetirementAccount | null): RetirementAccountFormState => ({
  account_type: initialData?.account_type ?? "EPF",
  institution: initialData?.institution ?? "",
  account_number: initialData?.account_number ?? "",
  holder_name: initialData?.holder_name ?? "",
  opening_date: initialData?.opening_date ?? "",
  current_value: initialData?.current_value ?? 0,
  monthly_contribution: initialData?.monthly_contribution ?? 0,
  annual_contribution: initialData?.annual_contribution ?? 0,
  interest_rate: initialData?.interest_rate ?? 0,
  nominee: initialData?.nominee ?? "",
  notes: initialData?.notes ?? "",
});

export function RetirementAccountForm({ initialData, onSubmit, onCancel, submitting }: RetirementAccountFormProps) {
  const [formValues, setFormValues] = useState<RetirementAccountFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof RetirementAccountFormState>(field: K, value: RetirementAccountFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {};

    if (!formValues.institution.trim()) {
      nextErrors.institution = "Institution is required";
    }
    if (!formValues.account_number.trim()) {
      nextErrors.account_number = "Account number is required";
    }
    if (!formValues.holder_name.trim()) {
      nextErrors.holder_name = "Holder name is required";
    }
    if (Number(formValues.current_value) < 0) {
      nextErrors.current_value = "Current value must be zero or higher";
    }
    if (Number(formValues.monthly_contribution) < 0) {
      nextErrors.monthly_contribution = "Monthly contribution must be zero or higher";
    }
    if (Number(formValues.annual_contribution) < 0) {
      nextErrors.annual_contribution = "Annual contribution must be zero or higher";
    }
    if (Number(formValues.interest_rate) < 0) {
      nextErrors.interest_rate = "Interest rate must be zero or higher";
    }

    return nextErrors;
  }, [formValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validationErrors;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const monthlyContribution = Number(formValues.monthly_contribution ?? 0);
    const annualContribution = Number(formValues.annual_contribution || monthlyContribution * 12);

    await onSubmit({
      account_type: formValues.account_type,
      institution: formValues.institution.trim(),
      account_number: formValues.account_number.trim(),
      holder_name: formValues.holder_name.trim(),
      opening_date: formValues.opening_date || null,
      current_value: Number(formValues.current_value),
      monthly_contribution: monthlyContribution,
      annual_contribution: annualContribution,
      interest_rate: Number(formValues.interest_rate),
      nominee: formValues.nominee.trim() || null,
      notes: formValues.notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account_type">Account Type</Label>
          <select id="account_type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.account_type} onChange={(event) => updateField("account_type", event.target.value as RetirementAccountType)}>
            <option value="EPF">EPF</option>
            <option value="PPF">PPF</option>
            <option value="NPS">NPS</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution">Institution</Label>
          <Input id="institution" value={formValues.institution} onChange={(event) => updateField("institution", event.target.value)} />
          {errors.institution ? <p className="text-sm text-rose-600">{errors.institution}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number</Label>
          <Input id="account_number" value={formValues.account_number} onChange={(event) => updateField("account_number", event.target.value)} />
          {errors.account_number ? <p className="text-sm text-rose-600">{errors.account_number}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="holder_name">Holder Name</Label>
          <Input id="holder_name" value={formValues.holder_name} onChange={(event) => updateField("holder_name", event.target.value)} />
          {errors.holder_name ? <p className="text-sm text-rose-600">{errors.holder_name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="opening_date">Opening Date</Label>
          <Input id="opening_date" type="date" value={formValues.opening_date} onChange={(event) => updateField("opening_date", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="current_value">Current Value</Label>
          <Input id="current_value" type="number" step="0.01" value={formValues.current_value} onChange={(event) => updateField("current_value", event.target.value)} />
          {errors.current_value ? <p className="text-sm text-rose-600">{errors.current_value}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthly_contribution">Monthly Contribution</Label>
          <Input id="monthly_contribution" type="number" step="0.01" value={formValues.monthly_contribution} onChange={(event) => updateField("monthly_contribution", event.target.value)} />
          {errors.monthly_contribution ? <p className="text-sm text-rose-600">{errors.monthly_contribution}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="annual_contribution">Annual Contribution</Label>
          <Input id="annual_contribution" type="number" step="0.01" value={formValues.annual_contribution} onChange={(event) => updateField("annual_contribution", event.target.value)} />
          {errors.annual_contribution ? <p className="text-sm text-rose-600">{errors.annual_contribution}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="interest_rate">Interest Rate (%)</Label>
          <Input id="interest_rate" type="number" step="0.001" value={formValues.interest_rate} onChange={(event) => updateField("interest_rate", event.target.value)} />
          {errors.interest_rate ? <p className="text-sm text-rose-600">{errors.interest_rate}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nominee">Nominee</Label>
          <Input id="nominee" value={formValues.nominee} onChange={(event) => updateField("nominee", event.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={formValues.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add retirement account"}
        </Button>
      </div>
    </form>
  );
}