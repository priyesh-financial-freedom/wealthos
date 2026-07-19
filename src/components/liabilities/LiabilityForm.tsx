"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIABILITY_TYPES, type Liability, type LiabilityInsert, type LiabilityType } from "@/types/liability";

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
  due_date: string;
  tenure_months: number | string;
  credit_limit: number | string;
  sanction_limit: number | string;
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
  due_date: initialData?.due_date ?? "",
  tenure_months: initialData?.tenure_months ?? "",
  credit_limit: initialData?.credit_limit ?? "",
  sanction_limit: initialData?.sanction_limit ?? "",
  status: initialData?.status ?? "active",
  notes: initialData?.notes ?? "",
});

const HOME_LIKE_TYPES: LiabilityType[] = ["Home Loan", "Loan Against Property"];
const VEHICLE_TYPES: LiabilityType[] = ["Car Loan"];
const TERM_LOAN_TYPES: LiabilityType[] = ["Home Loan", "Car Loan", "Personal Loan", "Education Loan", "Loan Against Property"];

function getAccountNameLabel(type: LiabilityType) {
  if (type === "Credit Card") {
    return "Card Name";
  }

  if (type === "Overdraft / Line of Credit") {
    return "Facility Name";
  }

  return "Account Name";
}

function getOutstandingLabel(type: LiabilityType) {
  if (type === "Credit Card") {
    return "Current Outstanding";
  }

  if (type === "Overdraft / Line of Credit") {
    return "Current Utilization";
  }

  return "Outstanding Amount";
}

export function LiabilityForm({ initialData, onSubmit, onCancel, submitting }: LiabilityFormProps) {
  const [formValues, setFormValues] = useState<LiabilityFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isCreditCard = formValues.liability_type === "Credit Card";
  const isOverdraft = formValues.liability_type === "Overdraft / Line of Credit";
  const isTermLoan = TERM_LOAN_TYPES.includes(formValues.liability_type);
  const showLoanAmount = !isCreditCard && !isOverdraft;

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
    if (formValues.credit_limit && Number(formValues.credit_limit) < 0) {
      nextErrors.credit_limit = "Credit limit must be positive";
    }
    if (formValues.sanction_limit && Number(formValues.sanction_limit) < 0) {
      nextErrors.sanction_limit = "Sanction limit must be positive";
    }
    if (formValues.tenure_months && (!Number.isInteger(Number(formValues.tenure_months)) || Number(formValues.tenure_months) <= 0)) {
      nextErrors.tenure_months = "Tenure must be a positive whole number";
    }
    if (formValues.due_day && (Number(formValues.due_day) < 1 || Number(formValues.due_day) > 31)) {
      nextErrors.due_day = "Due day must be between 1 and 31";
    }
    if (formValues.start_date && formValues.end_date && new Date(formValues.end_date) < new Date(formValues.start_date)) {
      nextErrors.end_date = "End date must be after start date";
    }
    if (isCreditCard && !formValues.credit_limit) {
      nextErrors.credit_limit = "Credit limit is required for credit cards";
    }
    if (isOverdraft && !formValues.sanction_limit) {
      nextErrors.sanction_limit = "Sanction limit is required for overdraft or line of credit";
    }
    if (isCreditCard && !formValues.due_date) {
      nextErrors.due_date = "Due date is required for credit cards";
    }

    const outstandingAmount = Number(formValues.outstanding_amount ?? 0);
    const creditLimit = Number(formValues.credit_limit ?? 0);
    const sanctionLimit = Number(formValues.sanction_limit ?? 0);
    if (isCreditCard && formValues.credit_limit && creditLimit < outstandingAmount) {
      nextErrors.credit_limit = "Credit limit should not be less than current outstanding";
    }
    if (isOverdraft && formValues.sanction_limit && sanctionLimit < outstandingAmount) {
      nextErrors.sanction_limit = "Sanction limit should not be less than current utilization";
    }

    return nextErrors;
  }, [formValues, isCreditCard, isOverdraft]);

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
      due_date: formValues.due_date || null,
      tenure_months: formValues.tenure_months ? Number(formValues.tenure_months) : null,
      credit_limit: formValues.credit_limit ? Number(formValues.credit_limit) : null,
      sanction_limit: formValues.sanction_limit ? Number(formValues.sanction_limit) : null,
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
            {LIABILITY_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_name">{getAccountNameLabel(formValues.liability_type)}</Label>
          <Input id="account_name" value={formValues.account_name} onChange={(event) => updateField("account_name", event.target.value)} />
          {errors.account_name ? <p className="text-sm text-rose-600">{errors.account_name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lender">Bank / Lender</Label>
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
          <Label htmlFor="outstanding_amount">{getOutstandingLabel(formValues.liability_type)}</Label>
          <Input id="outstanding_amount" type="number" step="0.01" value={formValues.outstanding_amount} onChange={(event) => updateField("outstanding_amount", event.target.value)} />
          {errors.outstanding_amount ? <p className="text-sm text-rose-600">{errors.outstanding_amount}</p> : null}
        </div>

        {showLoanAmount ? (
          <div className="space-y-2">
            <Label htmlFor="original_amount">{HOME_LIKE_TYPES.includes(formValues.liability_type) ? "Loan Amount" : VEHICLE_TYPES.includes(formValues.liability_type) ? "Vehicle Loan Amount" : "Original Amount"}</Label>
            <Input id="original_amount" type="number" step="0.01" value={formValues.original_amount} onChange={(event) => updateField("original_amount", event.target.value)} />
            {errors.original_amount ? <p className="text-sm text-rose-600">{errors.original_amount}</p> : null}
          </div>
        ) : null}

        {isCreditCard ? (
          <div className="space-y-2">
            <Label htmlFor="credit_limit">Credit Limit</Label>
            <Input id="credit_limit" type="number" step="0.01" value={formValues.credit_limit} onChange={(event) => updateField("credit_limit", event.target.value)} />
            {errors.credit_limit ? <p className="text-sm text-rose-600">{errors.credit_limit}</p> : null}
          </div>
        ) : null}

        {isOverdraft ? (
          <div className="space-y-2">
            <Label htmlFor="sanction_limit">Sanction Limit</Label>
            <Input id="sanction_limit" type="number" step="0.01" value={formValues.sanction_limit} onChange={(event) => updateField("sanction_limit", event.target.value)} />
            {errors.sanction_limit ? <p className="text-sm text-rose-600">{errors.sanction_limit}</p> : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="interest_rate">Interest rate (%)</Label>
          <Input id="interest_rate" type="number" step="0.01" value={formValues.interest_rate} onChange={(event) => updateField("interest_rate", event.target.value)} />
        </div>

        {isCreditCard ? null : (
          <div className="space-y-2">
            <Label htmlFor="emi">Monthly EMI</Label>
            <Input id="emi" type="number" step="0.01" value={formValues.emi} onChange={(event) => updateField("emi", event.target.value)} />
            {errors.emi ? <p className="text-sm text-rose-600">{errors.emi}</p> : null}
          </div>
        )}

        {isTermLoan ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="tenure_months">Tenure (months)</Label>
              <Input id="tenure_months" type="number" min="1" step="1" value={formValues.tenure_months} onChange={(event) => updateField("tenure_months", event.target.value)} />
              {errors.tenure_months ? <p className="text-sm text-rose-600">{errors.tenure_months}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input id="start_date" type="date" value={formValues.start_date} onChange={(event) => updateField("start_date", event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input id="end_date" type="date" value={formValues.end_date} onChange={(event) => updateField("end_date", event.target.value)} />
              {errors.end_date ? <p className="text-sm text-rose-600">{errors.end_date}</p> : null}
            </div>
          </>
        ) : null}

        {isCreditCard ? (
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input id="due_date" type="date" value={formValues.due_date} onChange={(event) => updateField("due_date", event.target.value)} />
            {errors.due_date ? <p className="text-sm text-rose-600">{errors.due_date}</p> : null}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="due_day">Due Day</Label>
            <Input id="due_day" type="number" min="1" max="31" value={formValues.due_day} onChange={(event) => updateField("due_day", event.target.value)} />
            {errors.due_day ? <p className="text-sm text-rose-600">{errors.due_day}</p> : null}
          </div>
        )}
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
