"use client";

import { useMemo, useState, type FormEvent } from "react";

import { OWNERSHIP_OPTIONS } from "@/lib/family";
import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  account_nickname: string;
  current_balance: number | string;
  opening_balance: number | string;
  interest_rate: number | string;
  owner: string;
  include_in_net_worth: boolean;
  include_in_cash_position: boolean;
  status: Extract<BankAccountStatus, "active" | "closed">;
};

const defaultState = (initialData?: BankAccount | null): BankAccountFormState => ({
  account_type: initialData?.account_type ?? "Savings",
  bank: initialData?.bank ?? "",
  account_nickname: initialData?.nickname ?? initialData?.account_name ?? "",
  current_balance: initialData?.current_balance ?? 0,
  opening_balance: initialData?.opening_balance ?? 0,
  interest_rate: initialData?.interest_rate ?? 0,
  owner: initialData?.owner ?? "Priyesh",
  include_in_net_worth: initialData?.include_in_net_worth ?? true,
  include_in_cash_position: initialData?.include_in_cash_position ?? true,
  status: initialData?.status === "closed" ? "closed" : "active",
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
    if (!formValues.account_nickname.trim()) {
      nextErrors.account_nickname = "Account nickname is required";
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
      account_name: formValues.account_nickname.trim(),
      nickname: formValues.account_nickname.trim(),
      current_balance: Number(formValues.current_balance),
      opening_balance: Number(formValues.opening_balance),
      interest_rate: Number(formValues.interest_rate || 0),
      owner: formValues.owner.trim() || null,
      include_in_net_worth: formValues.include_in_net_worth,
      include_in_cash_position: formValues.include_in_cash_position,
      status: formValues.status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormGrid>
        <FormField>
          <Label htmlFor="account_type">Account Type</Label>
          <select id="account_type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.account_type} onChange={(event) => updateField("account_type", event.target.value as BankAccountType)}>
            <option value="Savings">Savings</option>
            <option value="Salary">Salary</option>
            <option value="Current">Current</option>
            <option value="Cash">Cash</option>
            <option value="Wallet">Wallet</option>
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="bank">Bank</Label>
          <Input id="bank" value={formValues.bank} onChange={(event) => updateField("bank", event.target.value)} />
          {errors.bank ? <p className="text-sm text-rose-600">{errors.bank}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="account_nickname">Account Nickname</Label>
          <Input id="account_nickname" value={formValues.account_nickname} onChange={(event) => updateField("account_nickname", event.target.value)} placeholder="Emergency Fund, Salary Account..." />
          {errors.account_nickname ? <p className="text-sm text-rose-600">{errors.account_nickname}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="owner">Owner</Label>
          <select id="owner" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.owner} onChange={(event) => updateField("owner", event.target.value)}>
            {OWNERSHIP_OPTIONS.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="status">Status</Label>
          <select id="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.status} onChange={(event) => updateField("status", event.target.value as Extract<BankAccountStatus, "active" | "closed">)}>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="current_balance">Current Balance</Label>
          <Input id="current_balance" type="number" step="0.01" value={formValues.current_balance} onChange={(event) => updateField("current_balance", event.target.value)} />
          {errors.current_balance ? <p className="text-sm text-rose-600">{errors.current_balance}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="opening_balance">Opening Balance</Label>
          <Input id="opening_balance" type="number" step="0.01" value={formValues.opening_balance} onChange={(event) => updateField("opening_balance", event.target.value)} />
          {errors.opening_balance ? <p className="text-sm text-rose-600">{errors.opening_balance}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="interest_rate">Interest Rate (%)</Label>
          <Input id="interest_rate" type="number" step="0.001" value={formValues.interest_rate} onChange={(event) => updateField("interest_rate", event.target.value)} />
          {errors.interest_rate ? <p className="text-sm text-rose-600">{errors.interest_rate}</p> : null}
        </FormField>

        <FormField className="md:col-span-2">
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={formValues.include_in_net_worth}
                onChange={(event) => updateField("include_in_net_worth", event.target.checked)}
              />
              <span>
                <span className="block font-medium text-slate-900">Include in Net Worth</span>
                <span className="block text-slate-600">Use this account in overall net worth calculations.</span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={formValues.include_in_cash_position}
                onChange={(event) => updateField("include_in_cash_position", event.target.checked)}
              />
              <span>
                <span className="block font-medium text-slate-900">Include in Cash Position</span>
                <span className="block text-slate-600">Count this account in total cash reporting.</span>
              </span>
            </label>
          </div>
        </FormField>
      </FormGrid>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add account"}
        </Button>
      </FormActions>
    </form>
  );
}
