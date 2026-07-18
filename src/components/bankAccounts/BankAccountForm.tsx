"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BankAccount, BankAccountInsert, BankAccountStatus, BankAccountType } from "@/types/bankAccount";

interface BankAccountFormProps {
  initialData?: BankAccount | null;
  onSubmit: (values: BankAccountInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type BankAccountFormState = {
  account_type: BankAccountType;
  bank: string;
  account_name: string;
  nickname: string;
  account_number: string;
  ifsc: string;
  currency: string;
  current_balance: number | string;
  opening_balance: number | string;
  interest_rate: number | string;
  owner: string;
  nominee: string;
  joint_holder: string;
  notes: string;
  documents_placeholder: string;
  status: BankAccountStatus;
};

const defaultState = (initialData?: BankAccount | null): BankAccountFormState => ({
  account_type: initialData?.account_type ?? "Savings",
  bank: initialData?.bank ?? "",
  account_name: initialData?.account_name ?? "",
  nickname: initialData?.nickname ?? "",
  account_number: initialData?.account_number ?? "",
  ifsc: initialData?.ifsc ?? "",
  currency: initialData?.currency ?? "USD",
  current_balance: initialData?.current_balance ?? 0,
  opening_balance: initialData?.opening_balance ?? 0,
  interest_rate: initialData?.interest_rate ?? 0,
  owner: initialData?.owner ?? "",
  nominee: initialData?.nominee ?? "",
  joint_holder: initialData?.joint_holder ?? "",
  notes: initialData?.notes ?? "",
  documents_placeholder: initialData?.documents_placeholder ?? "",
  status: initialData?.status ?? "active",
});

export function BankAccountForm({ initialData, onSubmit, onCancel, submitting }: BankAccountFormProps) {
  const [formValues, setFormValues] = useState<BankAccountFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof BankAccountFormState>(field: K, value: BankAccountFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {};

    if (!formValues.bank.trim()) {
      nextErrors.bank = "Bank is required";
    }
    if (!formValues.account_name.trim()) {
      nextErrors.account_name = "Account name is required";
    }
    if (!formValues.account_number.trim()) {
      nextErrors.account_number = "Account number is required";
    }
    if (Number(formValues.current_balance) < 0) {
      nextErrors.current_balance = "Current balance must be positive";
    }
    if (Number(formValues.opening_balance) < 0) {
      nextErrors.opening_balance = "Opening balance must be positive";
    }
    if (Number(formValues.interest_rate) < 0) {
      nextErrors.interest_rate = "Interest rate must be positive";
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
      account_type: formValues.account_type,
      bank: formValues.bank.trim(),
      account_name: formValues.account_name.trim(),
      nickname: formValues.nickname.trim() || null,
      account_number: formValues.account_number.trim(),
      ifsc: formValues.ifsc.trim() || null,
      currency: formValues.currency.trim().toUpperCase(),
      current_balance: Number(formValues.current_balance),
      opening_balance: Number(formValues.opening_balance),
      interest_rate: Number(formValues.interest_rate),
      owner: formValues.owner.trim() || null,
      nominee: formValues.nominee.trim() || null,
      joint_holder: formValues.joint_holder.trim() || null,
      notes: formValues.notes.trim() || null,
      documents_placeholder: formValues.documents_placeholder.trim() || null,
      status: formValues.status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account_type">Account Type</Label>
          <select id="account_type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.account_type} onChange={(event) => updateField("account_type", event.target.value as BankAccountType)}>
            <option value="Savings">Savings</option>
            <option value="Salary">Salary</option>
            <option value="Current">Current</option>
            <option value="Cash">Cash</option>
            <option value="Wallet">Wallet</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank">Bank</Label>
          <Input id="bank" value={formValues.bank} onChange={(event) => updateField("bank", event.target.value)} />
          {errors.bank ? <p className="text-sm text-rose-600">{errors.bank}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_name">Account Name</Label>
          <Input id="account_name" value={formValues.account_name} onChange={(event) => updateField("account_name", event.target.value)} />
          {errors.account_name ? <p className="text-sm text-rose-600">{errors.account_name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input id="nickname" value={formValues.nickname} onChange={(event) => updateField("nickname", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number</Label>
          <Input id="account_number" value={formValues.account_number} onChange={(event) => updateField("account_number", event.target.value)} />
          {errors.account_number ? <p className="text-sm text-rose-600">{errors.account_number}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ifsc">IFSC</Label>
          <Input id="ifsc" value={formValues.ifsc} onChange={(event) => updateField("ifsc", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" value={formValues.currency} onChange={(event) => updateField("currency", event.target.value)} maxLength={6} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.status} onChange={(event) => updateField("status", event.target.value as BankAccountStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="current_balance">Current Balance</Label>
          <Input id="current_balance" type="number" step="0.01" value={formValues.current_balance} onChange={(event) => updateField("current_balance", event.target.value)} />
          {errors.current_balance ? <p className="text-sm text-rose-600">{errors.current_balance}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="opening_balance">Opening Balance</Label>
          <Input id="opening_balance" type="number" step="0.01" value={formValues.opening_balance} onChange={(event) => updateField("opening_balance", event.target.value)} />
          {errors.opening_balance ? <p className="text-sm text-rose-600">{errors.opening_balance}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="interest_rate">Interest Rate (%)</Label>
          <Input id="interest_rate" type="number" step="0.001" value={formValues.interest_rate} onChange={(event) => updateField("interest_rate", event.target.value)} />
          {errors.interest_rate ? <p className="text-sm text-rose-600">{errors.interest_rate}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner">Owner</Label>
          <Input id="owner" value={formValues.owner} onChange={(event) => updateField("owner", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nominee">Nominee</Label>
          <Input id="nominee" value={formValues.nominee} onChange={(event) => updateField("nominee", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="joint_holder">Joint Holder</Label>
          <Input id="joint_holder" value={formValues.joint_holder} onChange={(event) => updateField("joint_holder", event.target.value)} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="documents_placeholder">Documents Placeholder</Label>
          <Input id="documents_placeholder" value={formValues.documents_placeholder} onChange={(event) => updateField("documents_placeholder", event.target.value)} placeholder="Statements, KYC, passbook scans" />
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
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add account"}
        </Button>
      </div>
    </form>
  );
}
