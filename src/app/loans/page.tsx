"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { LoanDetailsDialog } from "@/components/loans/LoanDetailsDialog";
import { LoanForm } from "@/components/loans/LoanForm";
import { LoanList } from "@/components/loans/LoanList";
import { LoanSummaryCard } from "@/components/loans/LoanSummaryCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  loanManagementService,
  type Loan,
  type LoanCreateInput,
  type LoanSummary,
} from "@/services/loanManagement";

const EMPTY_SUMMARY: LoanSummary = {
  totalOutstanding: 0,
  totalEmi: 0,
  averageInterestRate: 0,
  activeLoans: 0,
  closedLoans: 0,
  upcomingPrepayments: 0,
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<LoanSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => (editingLoan ? "Edit Loan" : "Add Loan"), [editingLoan]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [allLoans, nextSummary] = await Promise.all([
        loanManagementService.listLoans(),
        loanManagementService.getLoanSummary(),
      ]);

      setLoans(allLoans);
      setSummary(nextSummary);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load loans.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleCreateOrUpdate(values: LoanCreateInput) {
    setSubmitting(true);

    try {
      if (editingLoan) {
        await loanManagementService.editLoan(editingLoan.id, values);
      } else {
        await loanManagementService.addLoan(values);
      }

      setIsFormOpen(false);
      setEditingLoan(null);
      await loadData();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to save loan.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(loan: Loan) {
    const confirmed = window.confirm(`Delete ${loan.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await loanManagementService.deleteLoan(loan.id);
      await loadData();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete loan.";
      setError(message);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Loan Management</h1>
          <p className="mt-2 text-sm text-slate-500">Track all liabilities, EMIs and prepayments in one place.</p>
        </div>
        <Button
          onClick={() => {
            setEditingLoan(null);
            setIsFormOpen(true);
          }}
          className="w-full md:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Loan
        </Button>
      </header>

      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>
      ) : null}

      <LoanSummaryCard summary={summary} />

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading loans...</section>
      ) : (
        <LoanList
          loans={loans}
          onView={(loan) => setSelectedLoan(loan)}
          onEdit={(loan) => {
            setEditingLoan(loan);
            setIsFormOpen(true);
          }}
          onDelete={(loan) => {
            void handleDelete(loan);
          }}
        />
      )}

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingLoan(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <LoanForm
            initialData={editingLoan}
            submitting={submitting}
            onCancel={() => {
              setEditingLoan(null);
              setIsFormOpen(false);
            }}
            onSubmit={handleCreateOrUpdate}
          />
        </DialogContent>
      </Dialog>

      <LoanDetailsDialog
        open={Boolean(selectedLoan)}
        loan={selectedLoan}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLoan(null);
          }
        }}
      />
    </main>
  );
}
