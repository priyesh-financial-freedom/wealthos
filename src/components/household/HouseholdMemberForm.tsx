"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HouseholdMember, HouseholdMemberInsert } from "@/types/household";

interface HouseholdMemberFormProps {
  initialData?: HouseholdMember | null;
  onSubmit: (values: HouseholdMemberInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

interface HouseholdMemberFormState {
  full_name: string;
  relationship: string;
  date_of_birth: string;
  retirement_date: string;
  employment_status: string;
  is_primary_user: boolean;
  is_active: boolean;
}

function defaultState(initialData?: HouseholdMember | null): HouseholdMemberFormState {
  return {
    full_name: initialData?.full_name ?? "",
    relationship: initialData?.relationship ?? "",
    date_of_birth: initialData?.date_of_birth ?? "",
    retirement_date: initialData?.retirement_date ?? "",
    employment_status: initialData?.employment_status ?? "",
    is_primary_user: initialData?.is_primary_user ?? false,
    is_active: initialData?.is_active ?? true,
  };
}

export function HouseholdMemberForm({ initialData, onSubmit, onCancel, submitting }: HouseholdMemberFormProps) {
  const [formValues, setFormValues] = useState<HouseholdMemberFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof HouseholdMemberFormState>(field: K, value: HouseholdMemberFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {};

    if (!formValues.full_name.trim()) {
      nextErrors.full_name = "Name is required.";
    }

    if (!formValues.relationship.trim()) {
      nextErrors.relationship = "Relationship is required.";
    }

    if (formValues.date_of_birth && formValues.retirement_date) {
      const dob = Date.parse(formValues.date_of_birth);
      const retirement = Date.parse(formValues.retirement_date);
      if (Number.isFinite(dob) && Number.isFinite(retirement) && retirement <= dob) {
        nextErrors.retirement_date = "Retirement date must be after date of birth.";
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

    await onSubmit({
      full_name: formValues.full_name.trim(),
      relationship: formValues.relationship.trim(),
      date_of_birth: formValues.date_of_birth || null,
      retirement_date: formValues.retirement_date || null,
      employment_status: formValues.employment_status.trim() || null,
      is_primary_user: formValues.is_primary_user,
      is_active: formValues.is_active,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormGrid>
        <FormField>
          <Label htmlFor="full_name">Full Name</Label>
          <Input id="full_name" value={formValues.full_name} onChange={(event) => updateField("full_name", event.target.value)} />
          {errors.full_name ? <p className="text-sm text-rose-600">{errors.full_name}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="relationship">Relationship</Label>
          <select
            id="relationship"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={formValues.relationship}
            onChange={(event) => updateField("relationship", event.target.value)}
          >
            <option value="">Select relationship</option>
            <option value="Self">Self</option>
            <option value="Spouse">Spouse</option>
            <option value="Daughter">Daughter</option>
            <option value="Son">Son</option>
            <option value="Parent">Parent</option>
            <option value="Other">Other</option>
          </select>
          {errors.relationship ? <p className="text-sm text-rose-600">{errors.relationship}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="employment_status">Employment Status</Label>
          <select
            id="employment_status"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={formValues.employment_status}
            onChange={(event) => updateField("employment_status", event.target.value)}
          >
            <option value="">Not specified</option>
            <option value="Employed">Employed</option>
            <option value="Self-Employed">Self-Employed</option>
            <option value="Retired">Retired</option>
            <option value="Student">Student</option>
            <option value="Unemployed">Unemployed</option>
            <option value="Homemaker">Homemaker</option>
            <option value="Other">Other</option>
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="date_of_birth">Date of Birth</Label>
          <Input id="date_of_birth" type="date" value={formValues.date_of_birth ?? ""} onChange={(event) => updateField("date_of_birth", event.target.value)} />
        </FormField>

        <FormField>
          <Label htmlFor="retirement_date">Retirement Date</Label>
          <Input id="retirement_date" type="date" value={formValues.retirement_date ?? ""} onChange={(event) => updateField("retirement_date", event.target.value)} />
          {errors.retirement_date ? <p className="text-sm text-rose-600">{errors.retirement_date}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="is_primary_user">Primary User</Label>
          <select
            id="is_primary_user"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={formValues.is_primary_user ? "yes" : "no"}
            onChange={(event) => updateField("is_primary_user", event.target.value === "yes")}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="is_active">Status</Label>
          <select
            id="is_active"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={formValues.is_active ? "active" : "inactive"}
            onChange={(event) => updateField("is_active", event.target.value === "active")}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>
      </FormGrid>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add member"}
        </Button>
      </FormActions>
    </form>
  );
}
