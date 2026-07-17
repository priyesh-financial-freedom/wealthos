"use client";

import { useMemo, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { LiabilityCard } from "@/components/liabilities/LiabilityCard";
import { LiabilityForm } from "@/components/liabilities/LiabilityForm";
import { LiabilitySummary } from "@/components/liabilities/LiabilitySummary";
import { LiabilityTable } from "@/components/liabilities/LiabilityTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createLiability, deleteLiability, getLiabilities, updateLiability } from "@/services/liabilities";
import type { Liability, LiabilityInsert } from "@/types/liability";

export default function LiabilitiesPage() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"outstanding" | "name" | "created">("outstanding");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Liability | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshLiabilities() {
    try {
      setLoading(true);
      const nextLiabilities = await getLiabilities();
      setLiabilities(nextLiabilities);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load liabilities");
    } finally {
      setLoading(false);
    }
  }

  useState(() => {
    void refreshLiabilities();
  });

  const filteredLiabilities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = liabilities.filter((liability) => {
      const matchesQuery = !normalizedQuery || `${liability.account_name} ${liability.lender} ${liability.liability_type}`.toLowerCase().includes(normalizedQuery);
      const matchesFilter = filter === "all" || liability.status === filter || liability.liability_type === filter;
      return matchesQuery && matchesFilter;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "name") {
        return left.account_name.localeCompare(right.account_name);
      }
      if (sortBy === "created") {
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      }
      return Number(right.outstanding_amount) - Number(left.outstanding_amount);
    });
  }, [filter, liabilities, query, sortBy]);

  async function handleCreate(values: LiabilityInsert) {
    setSubmitting(true);
    try {
      await createLiability(values);
      setDialogOpen(false);
      await refreshLiabilities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create liability");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(values: LiabilityInsert) {
    if (!editingLiability) {
      return;
    }
    setSubmitting(true);
    try {
      await updateLiability({ id: editingLiability.id, ...values });
      setDialogOpen(false);
      setEditingLiability(null);
      await refreshLiabilities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update liability");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(liability: Liability) {
    try {
      await deleteLiability(liability.id);
      setDeleteTarget(null);
      await refreshLiabilities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete liability");
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader title="Liabilities" description="Track debt, repayment obligations, and risk in one place." />
          <Button onClick={() => { setEditingLiability(null); setDialogOpen(true); }}>Add Liability</Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <LiabilitySummary liabilities={filteredLiabilities} />

        <DashboardCard>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Liability portfolio</h3>
              <p className="text-sm text-slate-600">Search, filter, sort, and manage obligations</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search liabilities" className="max-w-sm" />
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="paid_off">Paid Off</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value as "outstanding" | "name" | "created") }>
                <option value="outstanding">Sort by outstanding</option>
                <option value="name">Sort by name</option>
                <option value="created">Sort by created</option>
              </select>
            </div>
          </div>

          {loading ? <div className="py-10 text-center text-sm text-slate-500">Loading liabilities...</div> : <LiabilityTable liabilities={filteredLiabilities} onEdit={(liability) => { setEditingLiability(liability); setDialogOpen(true); }} onDelete={(liability) => setDeleteTarget(liability)} />}
        </DashboardCard>

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredLiabilities.slice(0, 2).map((liability) => (
            <LiabilityCard key={liability.id} liability={liability} />
          ))}
        </div>
      </PageContainer>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingLiability(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingLiability ? "Edit liability" : "Add liability"}</DialogTitle>
          </DialogHeader>
          <LiabilityForm initialData={editingLiability} onSubmit={editingLiability ? handleUpdate : handleCreate} onCancel={() => { setDialogOpen(false); setEditingLiability(null); }} submitting={submitting} />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete liability</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this liability?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
