"use client";

import { useEffect, useMemo, useState } from "react";

import { HouseholdMemberForm } from "@/components/household/HouseholdMemberForm";
import { HouseholdMembersTable } from "@/components/household/HouseholdMembersTable";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastViewport } from "@/components/ui/feedback";
import { FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/states";
import {
  addHouseholdMember,
  deleteHouseholdMember,
  ensureHouseholdInitialized,
  updateHousehold,
  updateHouseholdMember,
} from "@/services/households";
import type { Household, HouseholdMember, HouseholdMemberInsert, HouseholdUpdate } from "@/types/household";

function toMonthInput(dateValue: string) {
  if (!dateValue) {
    return "";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toFamilyFacingText(value: string) {
  return value.replaceAll(/household/gi, "family").replaceAll(/Household/g, "Family");
}

interface FamilyFormState {
  name: string;
  base_currency: string;
  financial_year_start_month: string;
  planning_start_month: string;
  planning_end_month: string;
}

function buildFamilyFormState(household: Household): FamilyFormState {
  return {
    name: household.name,
    base_currency: household.base_currency,
    financial_year_start_month: String(household.financial_year_start_month),
    planning_start_month: toMonthInput(household.planning_start_month),
    planning_end_month: toMonthInput(household.planning_end_month),
  };
}

function toMonthDateString(monthValue: string) {
  return `${monthValue}-01`;
}

export default function FamilySettingsPage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [formState, setFormState] = useState<FamilyFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<HouseholdMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HouseholdMember | null>(null);

  async function refreshFamily() {
    const response = await ensureHouseholdInitialized();
    setHousehold(response.household);
    setMembers(response.members);
    setFormState(buildFamilyFormState(response.household));
  }

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const response = await ensureHouseholdInitialized();
        if (!isMounted) {
          return;
        }

        setHousehold(response.household);
        setMembers(response.members);
        setFormState(buildFamilyFormState(response.household));
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Unable to load family data.";
        setError(toFamilyFacingText(message));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const planningValidationError = useMemo(() => {
    if (!formState?.planning_start_month || !formState?.planning_end_month) {
      return null;
    }

    const start = Date.parse(toMonthDateString(formState.planning_start_month));
    const end = Date.parse(toMonthDateString(formState.planning_end_month));
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "Planning months are invalid.";
    }

    if (end <= start) {
      return "Planning End Month must be after Planning Start Month.";
    }

    return null;
  }, [formState]);

  async function handleSaveFamily() {
    if (!household || !formState) {
      return;
    }

    if (!formState.name.trim()) {
      setError("Family Name is mandatory.");
      return;
    }

    if (planningValidationError) {
      setError(planningValidationError);
      return;
    }

    const payload: HouseholdUpdate = {
      id: household.id,
      name: formState.name,
      base_currency: formState.base_currency,
      financial_year_start_month: Number(formState.financial_year_start_month),
      planning_start_month: toMonthDateString(formState.planning_start_month),
      planning_end_month: toMonthDateString(formState.planning_end_month),
    };

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const updated = await updateHousehold(payload);
      setHousehold(updated);
      setFormState(buildFamilyFormState(updated));
      setNotice("Family information saved.");
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save family information.";
      setError(toFamilyFacingText(message));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddMember(values: HouseholdMemberInsert) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await addHouseholdMember(values);
      await refreshFamily();
      setMemberDialogOpen(false);
      setEditingMember(null);
      setNotice("Family member added successfully.");
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (memberError) {
      const message = memberError instanceof Error ? memberError.message : "Unable to add family member.";
      setError(toFamilyFacingText(message));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateMember(values: HouseholdMemberInsert) {
    if (!editingMember) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await updateHouseholdMember({ id: editingMember.id, ...values });
      await refreshFamily();
      setMemberDialogOpen(false);
      setEditingMember(null);
      setNotice("Family member updated successfully.");
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (memberError) {
      const message = memberError instanceof Error ? memberError.message : "Unable to update family member.";
      setError(toFamilyFacingText(message));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteMember() {
    if (!deleteTarget) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteHouseholdMember(deleteTarget.id);
      await refreshFamily();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setNotice("Family member deleted successfully.");
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete family member.";
      setError(toFamilyFacingText(message));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !formState) {
    return (
      <AppLayout>
        <PageContainer>
          <LoadingState label="Loading family settings..." />
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Family" }]} />
        <PageHeader title="Family" description="Manage family identity, planning window, and family members." />

        <ContentCard>
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Family Information</h2>
              <p className="text-sm text-slate-600">Configure default planning context used across all modules.</p>
            </div>

            <FormGrid>
              <FormField>
                <Label htmlFor="family_name">Family Name</Label>
                <Input id="family_name" value={formState.name} onChange={(event) => setFormState((current) => (current ? { ...current, name: event.target.value } : current))} />
              </FormField>

              <FormField>
                <Label htmlFor="base_currency">Base Currency</Label>
                <Input id="base_currency" value={formState.base_currency} onChange={(event) => setFormState((current) => (current ? { ...current, base_currency: event.target.value.toUpperCase() } : current))} maxLength={8} />
              </FormField>

              <FormField>
                <Label htmlFor="financial_year_start_month">Financial Year Start</Label>
                <select
                  id="financial_year_start_month"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={formState.financial_year_start_month}
                  onChange={(event) => setFormState((current) => (current ? { ...current, financial_year_start_month: event.target.value } : current))}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={String(month)}>
                      {new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(Date.UTC(2025, month - 1, 1)))}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField>
                <Label htmlFor="planning_start_month">Planning Start Month</Label>
                <Input
                  id="planning_start_month"
                  type="month"
                  value={formState.planning_start_month}
                  onChange={(event) => setFormState((current) => (current ? { ...current, planning_start_month: event.target.value } : current))}
                />
              </FormField>

              <FormField>
                <Label htmlFor="planning_end_month">Planning End Month</Label>
                <Input
                  id="planning_end_month"
                  type="month"
                  value={formState.planning_end_month}
                  onChange={(event) => setFormState((current) => (current ? { ...current, planning_end_month: event.target.value } : current))}
                />
                {planningValidationError ? <p className="text-sm text-rose-600">{planningValidationError}</p> : null}
              </FormField>
            </FormGrid>

            <div className="flex justify-end">
              <Button type="button" onClick={() => void handleSaveFamily()} disabled={submitting}>
                {submitting ? "Saving..." : "Save Family Information"}
              </Button>
            </div>
          </div>
        </ContentCard>

        <HouseholdMembersTable
          members={members}
          onView={(member) => {
            setSelectedMember(member);
            setViewDialogOpen(true);
          }}
          onEdit={(member) => {
            setEditingMember(member);
            setMemberDialogOpen(true);
          }}
          onDelete={(member) => {
            setDeleteTarget(member);
            setDeleteDialogOpen(true);
          }}
        />

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => {
              setEditingMember(null);
              setMemberDialogOpen(true);
            }}
          >
            Add Family Member
          </Button>
        </div>
      </PageContainer>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Family Member" : "Add Family Member"}</DialogTitle>
          </DialogHeader>
          <HouseholdMemberForm
            initialData={editingMember}
            submitting={submitting}
            onCancel={() => {
              setMemberDialogOpen(false);
              setEditingMember(null);
            }}
            onSubmit={(values) => {
              if (editingMember) {
                return handleUpdateMember(values);
              }

              return handleAddMember(values);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Family Member Details</DialogTitle>
          </DialogHeader>
          {selectedMember ? (
            <div className="space-y-3 text-sm text-slate-700">
              <p><span className="font-medium text-slate-900">Name:</span> {selectedMember.full_name}</p>
              <p><span className="font-medium text-slate-900">Relationship:</span> {selectedMember.relationship}</p>
              <p><span className="font-medium text-slate-900">Employment Status:</span> {selectedMember.employment_status ?? "—"}</p>
              <p><span className="font-medium text-slate-900">Date of Birth:</span> {selectedMember.date_of_birth ?? "—"}</p>
              <p><span className="font-medium text-slate-900">Retirement Date:</span> {selectedMember.retirement_date ?? "—"}</p>
              <p><span className="font-medium text-slate-900">Primary User:</span> {selectedMember.is_primary_user ? "Yes" : "No"}</p>
              <p><span className="font-medium text-slate-900">Status:</span> {selectedMember.is_active ? "Active" : "Inactive"}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete family member?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {deleteTarget ? `This will remove ${deleteTarget.full_name} from this family.` : "This action cannot be undone."}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleDeleteMember()} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
      <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
    </AppLayout>
  );
}
