"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ContributionFrequency,
  ContributionMonth,
  RetirementAccount,
  RetirementAccountInsert,
  RetirementAccountType,
} from "@/types/retirementAccount";

interface RetirementAccountFormProps {
  initialData?: RetirementAccount | null;
  onSubmit: (values: RetirementAccountInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type RetirementAccountFormState = {
  account_type: RetirementAccountType;
  owner: string;
  institution: string;
  account_number: string;
  opening_date: string;
  current_balance: number | string;
  interest_rate: number | string;
  nominee: string;
  notes: string;
  contribution_frequency: ContributionFrequency;
  contribution_amount: number | string;
  contribution_day: number | string;
  contribution_month: ContributionMonth | "";
  maturity_date: string;
  employer: string;
  uan: string;
  employee_contribution: number | string;
  employer_contribution: number | string;
  pran: string;
  pop: string;
  equity_percent: number | string;
  corporate_debt_percent: number | string;
  government_securities_percent: number | string;
  alternative_assets_percent: number | string;
};

const defaultState = (initialData?: RetirementAccount | null): RetirementAccountFormState => ({
  account_type: initialData?.account_type ?? "PPF",
  owner: initialData?.owner ?? "",
  institution: initialData?.institution ?? "",
  account_number: initialData?.account_number ?? "",
  opening_date: initialData?.opening_date ?? "",
  current_balance: initialData?.current_balance ?? 0,
  interest_rate: initialData?.interest_rate ?? "",
  nominee: initialData?.nominee ?? "",
  notes: initialData?.notes ?? "",
  contribution_frequency: initialData?.contribution_frequency ?? "Monthly",
  contribution_amount: initialData?.contribution_amount ?? 0,
  contribution_day: initialData?.contribution_day ?? "",
  contribution_month: initialData?.contribution_month ?? "",
  maturity_date: initialData?.account_type === "PPF" ? (initialData.maturity_date ?? "") : "",
  employer: initialData?.account_type === "EPF" ? (initialData.employer ?? "") : "",
  uan: initialData?.account_type === "EPF" ? (initialData.uan ?? "") : "",
  employee_contribution: initialData?.account_type === "EPF" ? (initialData.employee_contribution ?? "") : "",
  employer_contribution: initialData?.account_type === "EPF" ? (initialData.employer_contribution ?? "") : "",
  pran: initialData?.account_type === "NPS" ? (initialData.pran ?? "") : "",
  pop: initialData?.account_type === "NPS" ? (initialData.pop ?? "") : "",
  equity_percent: initialData?.account_type === "NPS" ? (initialData.equity_percent ?? "") : "",
  corporate_debt_percent: initialData?.account_type === "NPS" ? (initialData.corporate_debt_percent ?? "") : "",
  government_securities_percent: initialData?.account_type === "NPS" ? (initialData.government_securities_percent ?? "") : "",
  alternative_assets_percent: initialData?.account_type === "NPS" ? (initialData.alternative_assets_percent ?? "") : "",
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
    if (!formValues.owner.trim()) {
      nextErrors.owner = "Owner is required";
    }
    if (Number(formValues.current_balance) < 0) {
      nextErrors.current_balance = "Current balance must be zero or higher";
    }
    if (Number(formValues.contribution_amount) < 0) {
      nextErrors.contribution_amount = "Contribution amount must be zero or higher";
    }
    if (formValues.contribution_day !== "" && (Number(formValues.contribution_day) < 1 || Number(formValues.contribution_day) > 31)) {
      nextErrors.contribution_day = "Contribution day must be between 1 and 31";
    }
    if (formValues.contribution_frequency === "Annual" && !formValues.contribution_month) {
      nextErrors.contribution_month = "Contribution month is required for annual schedule";
    }
    if (formValues.interest_rate !== "" && Number(formValues.interest_rate) < 0) {
      nextErrors.interest_rate = "Interest rate must be zero or higher";
    }

    if (formValues.account_type === "NPS") {
      const npsFields = [
        Number(formValues.equity_percent || 0),
        Number(formValues.corporate_debt_percent || 0),
        Number(formValues.government_securities_percent || 0),
        Number(formValues.alternative_assets_percent || 0),
      ];
      if (npsFields.some((value) => value < 0 || value > 100)) {
        nextErrors.nps_allocation = "NPS allocation values must be between 0 and 100";
      }
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

    const baseValues = {
      owner: formValues.owner.trim(),
      institution: formValues.institution.trim(),
      account_number: formValues.account_number.trim() || null,
      opening_date: formValues.opening_date || null,
      current_balance: Number(formValues.current_balance),
      interest_rate: formValues.interest_rate === "" ? null : Number(formValues.interest_rate),
      nominee: formValues.nominee.trim() || null,
      notes: formValues.notes.trim() || null,
      contribution_frequency: formValues.contribution_frequency,
      contribution_amount: Number(formValues.contribution_amount),
      contribution_day: formValues.contribution_day === "" ? null : Number(formValues.contribution_day),
      contribution_month: formValues.contribution_frequency === "Annual" ? formValues.contribution_month || null : null,
    };

    let payload: RetirementAccountInsert;

    if (formValues.account_type === "PPF") {
      payload = {
        ...baseValues,
        account_type: "PPF",
        maturity_date: formValues.maturity_date || null,
      };
    } else if (formValues.account_type === "EPF") {
      payload = {
        ...baseValues,
        account_type: "EPF",
        employer: formValues.employer.trim() || null,
        uan: formValues.uan.trim() || null,
        employee_contribution: formValues.employee_contribution === "" ? null : Number(formValues.employee_contribution),
        employer_contribution: formValues.employer_contribution === "" ? null : Number(formValues.employer_contribution),
      };
    } else {
      payload = {
        ...baseValues,
        account_type: "NPS",
        pran: formValues.pran.trim() || null,
        pop: formValues.pop.trim() || null,
        equity_percent: formValues.equity_percent === "" ? null : Number(formValues.equity_percent),
        corporate_debt_percent: formValues.corporate_debt_percent === "" ? null : Number(formValues.corporate_debt_percent),
        government_securities_percent: formValues.government_securities_percent === "" ? null : Number(formValues.government_securities_percent),
        alternative_assets_percent: formValues.alternative_assets_percent === "" ? null : Number(formValues.alternative_assets_percent),
      };
    }

    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account_type">Account Type</Label>
          <select id="account_type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.account_type} onChange={(event) => updateField("account_type", event.target.value as RetirementAccountType)}>
            <option value="PPF">PPF</option>
            <option value="EPF">EPF</option>
            <option value="NPS">NPS</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner">Owner</Label>
          <Input id="owner" value={formValues.owner} onChange={(event) => updateField("owner", event.target.value)} />
          {errors.owner ? <p className="text-sm text-rose-600">{errors.owner}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution">Institution</Label>
          <Input id="institution" value={formValues.institution} onChange={(event) => updateField("institution", event.target.value)} />
          {errors.institution ? <p className="text-sm text-rose-600">{errors.institution}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number</Label>
          <Input id="account_number" value={formValues.account_number} onChange={(event) => updateField("account_number", event.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="opening_date">Opening Date</Label>
          <Input id="opening_date" type="date" value={formValues.opening_date} onChange={(event) => updateField("opening_date", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="current_balance">Current Balance</Label>
          <Input id="current_balance" type="number" step="0.01" value={formValues.current_balance} onChange={(event) => updateField("current_balance", event.target.value)} />
          {errors.current_balance ? <p className="text-sm text-rose-600">{errors.current_balance}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contribution_frequency">Contribution Frequency</Label>
          <select id="contribution_frequency" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.contribution_frequency} onChange={(event) => updateField("contribution_frequency", event.target.value as ContributionFrequency)}>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Annual">Annual</option>
            <option value="One-time">One-time</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contribution_amount">Contribution Amount</Label>
          <Input id="contribution_amount" type="number" step="0.01" value={formValues.contribution_amount} onChange={(event) => updateField("contribution_amount", event.target.value)} />
          {errors.contribution_amount ? <p className="text-sm text-rose-600">{errors.contribution_amount}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contribution_day">Contribution Day</Label>
          <Input id="contribution_day" type="number" min={1} max={31} value={formValues.contribution_day} onChange={(event) => updateField("contribution_day", event.target.value)} placeholder="1-31" />
          {errors.contribution_day ? <p className="text-sm text-rose-600">{errors.contribution_day}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contribution_month">Contribution Month</Label>
          <select id="contribution_month" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.contribution_month} onChange={(event) => updateField("contribution_month", event.target.value as ContributionMonth | "") } disabled={formValues.contribution_frequency !== "Annual"}>
            <option value="">Select month</option>
            {[
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ].map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
          {errors.contribution_month ? <p className="text-sm text-rose-600">{errors.contribution_month}</p> : null}
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

        {formValues.account_type === "PPF" ? (
          <div className="space-y-2">
            <Label htmlFor="maturity_date">Maturity Date</Label>
            <Input id="maturity_date" type="date" value={formValues.maturity_date} onChange={(event) => updateField("maturity_date", event.target.value)} />
          </div>
        ) : null}

        {formValues.account_type === "EPF" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="employer">Employer</Label>
              <Input id="employer" value={formValues.employer} onChange={(event) => updateField("employer", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uan">UAN</Label>
              <Input id="uan" value={formValues.uan} onChange={(event) => updateField("uan", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_contribution">Employee Contribution</Label>
              <Input id="employee_contribution" type="number" step="0.01" value={formValues.employee_contribution} onChange={(event) => updateField("employee_contribution", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer_contribution">Employer Contribution</Label>
              <Input id="employer_contribution" type="number" step="0.01" value={formValues.employer_contribution} onChange={(event) => updateField("employer_contribution", event.target.value)} />
            </div>
          </>
        ) : null}

        {formValues.account_type === "NPS" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="pran">PRAN</Label>
              <Input id="pran" value={formValues.pran} onChange={(event) => updateField("pran", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pop">POP</Label>
              <Input id="pop" value={formValues.pop} onChange={(event) => updateField("pop", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equity_percent">Equity %</Label>
              <Input id="equity_percent" type="number" step="0.01" value={formValues.equity_percent} onChange={(event) => updateField("equity_percent", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="corporate_debt_percent">Corporate Debt %</Label>
              <Input id="corporate_debt_percent" type="number" step="0.01" value={formValues.corporate_debt_percent} onChange={(event) => updateField("corporate_debt_percent", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="government_securities_percent">Government Securities %</Label>
              <Input id="government_securities_percent" type="number" step="0.01" value={formValues.government_securities_percent} onChange={(event) => updateField("government_securities_percent", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alternative_assets_percent">Alternative Assets %</Label>
              <Input id="alternative_assets_percent" type="number" step="0.01" value={formValues.alternative_assets_percent} onChange={(event) => updateField("alternative_assets_percent", event.target.value)} />
            </div>
            {errors.nps_allocation ? <p className="text-sm text-rose-600 md:col-span-2">{errors.nps_allocation}</p> : null}
          </>
        ) : null}
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