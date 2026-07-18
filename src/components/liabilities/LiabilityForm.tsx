"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Liability, LiabilityInsert } from "@/types/liability";

interface LiabilityFormProps {
  initialData?: Liability | null;
  onSubmit: (values: LiabilityInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type LiabilityFormState = {
  liability_type: Liability["liability_type"];
  lender: string;
  account_name: string;
  outstanding_amount: number | string;
  original_amount: number | string;
  interest_rate: number | string;
  emi: number | string;
  start_date: string;
  end_date: string;
  due_day: number | string;
  status: Liability["status"];
  notes: string;
};

const defaultState = (initialData?: Liability | null): LiabilityFormState => ({
  liability_type: initialData?.liability_type ?? "Home Loan",
  lender: initialData?.lender ?? "",
  account_name: initialData?.account_name ?? "",
  outstanding_amount: initialData?.outstanding_amount ?? 0,
  original_amount: initialData?.original_amount ?? "",
  interest_rate: initialData?.interest_rate ?? "",
  emi: initialData?.emi ?? "",
  start_date: initialData?.start_date ?? "",
  end_date: initialData?.end_date ?? "",
  due_day: initialData?.due_day ?? "",
  status: initialData?.status ?? "active",
  notes: initialData?.notes ?? "",
});

export function LiabilityForm({ initialData, onSubmit, onCancel, submitting }: LiabilityFormProps) {
  const [formValues, setFormValues] = useState<LiabilityFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof LiabilityFormState>(field: K, value: LiabilityFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {};
    if (!formValues.lender.trim()) {
      nextErrors.lender = "Lender is required";
    }
    if (!formValues.account_name.trim()) {
      nextErrors.account_name = "Account name is required";
    }
    if (Number(formValues.outstanding_amount) < 0) {
      nextErrors.outstanding_amount = "Outstanding amount must be positive";
    }
    if (formValues.original_amount && Number(formValues.original_amount) < 0) {
      nextErrors.original_amount = "Original amount must be positive";
    }
    if (formValues.emi && Number(formValues.emi) < 0) {
      nextErrors.emi = "EMI must be positive";
    }
    if (formValues.due_day && (Number(formValues.due_day) < 1 || Number(formValues.due_day) > 31)) {
      nextErrors.due_day = "Due day must be between 1 and 31";
    }
    if (formValues.start_date && formValues.end_date && new Date(formValues.end_date) < new Date(formValues.start_date)) {
      nextErrors.end_date = "End date must be after start date";
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

    await onSubmit({
      liability_type: formValues.liability_type,
      lender: formValues.lender,
      account_name: formValues.account_name,
      outstanding_amount: Number(formValues.outstanding_amount),
      original_amount: formValues.original_amount ? Number(formValues.original_amount) : null,
      interest_rate: formValues.interest_rate ? Number(formValues.interest_rate) : null,
      emi: formValues.emi ? Number(formValues.emi) : null,
      start_date: formValues.start_date || null,
      end_date: formValues.end_date || null,
      due_day: formValues.due_day ? Number(formValues.due_day) : null,
      status: formValues.status,
      notes: formValues.notes || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="liability_type">Liability type</Label>
          <select
            id="liability_type"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={formValues.liability_type}
            onChange={(event) => updateField("liability_type", event.target.value as Liability["liability_type"])}
          >
            <option value="Home Loan">Home Loan</option>
            <option value="Car Loan">Car Loan</option>
            <option value="Personal Loan">Personal Loan</option>
            <option value="Education Loan">Education Loan</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_name">Account name</Label>
          <Input id="account_name" value={formValues.account_name} onChange={(event) => updateField("account_name", event.target.value)} />
          {errors.account_name ? <p className="text-sm text-rose-600">{errors.account_name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lender">Lender</Label>
          <Input id="lender" value={formValues.lender} onChange={(event) => updateField("lender", event.target.value)} />
          {errors.lender ? <p className="text-sm text-rose-600">{errors.lender}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={formValues.status}
            onChange={(event) => updateField("status", event.target.value as Liability["status"])}
          >
            <option value="active">Active</option>
            <option value="paid_off">Paid Off</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="outstanding_amount">Outstanding amount</Label>
          <Input id="outstanding_amount" type="number" step="0.01" value={formValues.outstanding_amount} onChange={(event) => updateField("outstanding_amount", event.target.value)} />
          {errors.outstanding_amount ? <p className="text-sm text-rose-600">{errors.outstanding_amount}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="original_amount">Original amount</Label>
          <Input id="original_amount" type="number" step="0.01" value={formValues.original_amount} onChange={(event) => updateField("original_amount", event.target.value)} />
          {errors.original_amount ? <p className="text-sm text-rose-600">{errors.original_amount}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="interest_rate">Interest rate (%)</Label>
          <Input id="interest_rate" type="number" step="0.01" value={formValues.interest_rate} onChange={(event) => updateField("interest_rate", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emi">EMI</Label>
          <Input id="emi" type="number" step="0.01" value={formValues.emi} onChange={(event) => updateField("emi", event.target.value)} />
          {errors.emi ? <p className="text-sm text-rose-600">{errors.emi}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" type="date" value={formValues.start_date} onChange={(event) => updateField("start_date", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">End date</Label>
          <Input id="end_date" type="date" value={formValues.end_date} onChange={(event) => updateField("end_date", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_day">Due day</Label>
          <Input id="due_day" type="number" min="1" max="31" value={formValues.due_day} onChange={(event) => updateField("due_day", event.target.value)} />
          {errors.due_day ? <p className="text-sm text-rose-600">{errors.due_day}</p> : null}
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
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add liability"}
        </Button>
      </div>
    </form>
  );
}
