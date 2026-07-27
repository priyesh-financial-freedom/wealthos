"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type Loan,
  type LoanCreateInput,
  type LoanStatus,
  type LoanType,
  type PrepaymentFrequency,
  validateLoan,
} from "@/services/loanManagement";

interface LoanFormProps {
  initialData?: Loan | null;
  submitting?: boolean;
  onSubmit: (values: LoanCreateInput) => Promise<void> | void;
  onCancel: () => void;
}

const LOAN_TYPES: LoanType[] = [
  "Home Loan",
  "Car Loan",
  "Personal Loan",
  "Education Loan",
  "Loan Against Property",
  "Other",
];

const PREPAYMENT_FREQUENCIES: PrepaymentFrequency[] = [
  "None",
  "Monthly",
  "Quarterly",
  "Annual",
  "One-Time",
];

interface LoanFormState {
  name: string;
  lender: string;
  loanType: LoanType;
  outstandingAmount: number | string;
  interestRate: number | string;
  emi: number | string;
  tenureMonths: number | string;
  remainingMonths: number | string;
  startDate: string;
  endDate: string;
  prepaymentAmount: number | string;
  prepaymentFrequency: PrepaymentFrequency;
  status: LoanStatus;
  notes: string;
}

function defaultState(initialData?: Loan | null): LoanFormState {
  return {
    name: initialData?.name ?? "",
    lender: initialData?.lender ?? "",
    loanType: initialData?.loanType ?? "Home Loan",
    outstandingAmount: initialData?.outstandingAmount ?? 0,
    interestRate: initialData?.interestRate ?? 0,
    emi: initialData?.emi ?? 0,
    tenureMonths: initialData?.tenureMonths ?? 0,
    remainingMonths: initialData?.remainingMonths ?? 0,
    startDate: initialData?.startDate ?? "",
    endDate: initialData?.endDate ?? "",
    prepaymentAmount: initialData?.prepaymentAmount ?? 0,
    prepaymentFrequency: initialData?.prepaymentFrequency ?? "None",
    status: initialData?.status ?? "Active",
    notes: initialData?.notes ?? "",
  };
}

export function LoanForm({ initialData, submitting, onSubmit, onCancel }: LoanFormProps) {
  const [formValues, setFormValues] = useState<LoanFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof LoanFormState>(field: K, value: LoanFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const validationErrors = useMemo(() => {
    const payload: LoanCreateInput = {
      name: formValues.name,
      lender: formValues.lender,
      loanType: formValues.loanType,
      outstandingAmount: Number(formValues.outstandingAmount ?? 0),
      interestRate: Number(formValues.interestRate ?? 0),
      emi: Number(formValues.emi ?? 0),
      tenureMonths: Number(formValues.tenureMonths ?? 0),
      remainingMonths: Number(formValues.remainingMonths ?? 0),
      startDate: formValues.startDate || null,
      endDate: formValues.endDate || null,
      prepaymentAmount: Number(formValues.prepaymentAmount ?? 0),
      prepaymentFrequency: formValues.prepaymentFrequency,
      status: formValues.status,
      notes: formValues.notes || null,
    };
    const builtIn = validateLoan(payload).reduce<Record<string, string>>((acc, issue) => {
      acc[issue.field] = issue.message;
      return acc;
    }, {});

    if (!formValues.lender.trim()) {
      builtIn.lender = "Lender is required.";
    }

    if (formValues.endDate && formValues.startDate && new Date(formValues.endDate) < new Date(formValues.startDate)) {
      builtIn.endDate = "End date must be after start date.";
    }

    return builtIn;
   }, [formValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    await onSubmit({
      name: formValues.name,
      lender: formValues.lender,
      loanType: formValues.loanType,
      outstandingAmount: Number(formValues.outstandingAmount ?? 0),
      interestRate: Number(formValues.interestRate ?? 0),
      emi: Number(formValues.emi ?? 0),
      tenureMonths: Number(formValues.tenureMonths ?? 0),
      remainingMonths: Number(formValues.remainingMonths ?? 0),
      startDate: formValues.startDate || null,
      endDate: formValues.endDate || null,
      prepaymentAmount: Number(formValues.prepaymentAmount ?? 0),
      prepaymentFrequency: formValues.prepaymentFrequency,
      status: formValues.status,
      notes: formValues.notes || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Loan Name</Label>
          <Input id="name" value={formValues.name} onChange={(event) => updateField("name", event.target.value)} />
          {errors.name ? <p className="text-sm text-rose-600">{errors.name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lender">Lender</Label>
          <Input id="lender" value={formValues.lender} onChange={(event) => updateField("lender", event.target.value)} />
          {errors.lender ? <p className="text-sm text-rose-600">{errors.lender}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="loanType">Loan Type</Label>
          <select id="loanType" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.loanType} onChange={(event) => updateField("loanType", event.target.value as LoanType)}>
            {LOAN_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.status} onChange={(event) => updateField("status", event.target.value as LoanStatus)}>
            <option value="Active">Active</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="outstandingAmount">Outstanding Amount</Label>
          <Input id="outstandingAmount" type="number" step="0.01" value={formValues.outstandingAmount} onChange={(event) => updateField("outstandingAmount", event.target.value)} />
          {errors.outstandingAmount ? <p className="text-sm text-rose-600">{errors.outstandingAmount}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="interestRate">Interest Rate (%)</Label>
          <Input id="interestRate" type="number" step="0.01" value={formValues.interestRate} onChange={(event) => updateField("interestRate", event.target.value)} />
          {errors.interestRate ? <p className="text-sm text-rose-600">{errors.interestRate}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="emi">EMI</Label>
          <Input id="emi" type="number" step="0.01" value={formValues.emi} onChange={(event) => updateField("emi", event.target.value)} />
          {errors.emi ? <p className="text-sm text-rose-600">{errors.emi}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenureMonths">Tenure (months)</Label>
          <Input id="tenureMonths" type="number" step="1" min="0" value={formValues.tenureMonths} onChange={(event) => updateField("tenureMonths", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="remainingMonths">Remaining Months</Label>
          <Input id="remainingMonths" type="number" step="1" min="0" value={formValues.remainingMonths} onChange={(event) => updateField("remainingMonths", event.target.value)} />
          {errors.remainingMonths ? <p className="text-sm text-rose-600">{errors.remainingMonths}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" value={formValues.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" type="date" value={formValues.endDate} onChange={(event) => updateField("endDate", event.target.value)} />
          {errors.endDate ? <p className="text-sm text-rose-600">{errors.endDate}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prepaymentAmount">Prepayment Amount</Label>
          <Input id="prepaymentAmount" type="number" step="0.01" min="0" value={formValues.prepaymentAmount} onChange={(event) => updateField("prepaymentAmount", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prepaymentFrequency">Prepayment Frequency</Label>
          <select id="prepaymentFrequency" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.prepaymentFrequency} onChange={(event) => updateField("prepaymentFrequency", event.target.value as PrepaymentFrequency)}>
            {PREPAYMENT_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>{frequency}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={formValues.notes} onChange={(event) => updateField("notes", event.target.value)} rows={4} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : initialData ? "Update Loan" : "Add Loan"}</Button>
      </div>
    </form>
  );
}
