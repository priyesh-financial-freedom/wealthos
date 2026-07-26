"use client";

import { useEffect, useMemo, useState } from "react";

import { BankAccountDetailsDialog } from "@/components/bankAccounts/BankAccountDetailsDialog";
import { BankAccountForm } from "@/components/bankAccounts/BankAccountForm";
import { BankAccountMonthlySnapshotForm } from "@/components/bankAccounts/BankAccountMonthlySnapshotForm";
import { BankAccountMonthlySnapshotsTable } from "@/components/bankAccounts/BankAccountMonthlySnapshotsTable";
import { BankAccountsDashboard } from "@/components/bankAccounts/BankAccountsDashboard";
import { BankAccountTable } from "@/components/bankAccounts/BankAccountTable";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastViewport } from "@/components/ui/feedback";
import { LoadingState } from "@/components/ui/states";
import {
  buildBankAccountsDashboardModel,
  createBankAccount,
  createBankAccountMonthlySnapshot,
  deleteBankAccount,
  deleteBankAccountMonthlySnapshot,
  getBankAccountMonthlySnapshots,
  getBankAccounts,
  updateBankAccount,
  updateBankAccountMonthlySnapshot,
} from "@/services/bankAccounts";
import type {
  BankAccount,
  BankAccountInsert,
  BankAccountMonthlySnapshot,
  BankAccountMonthlySnapshotInsert,
} from "@/types/bankAccount";

const OWNER_OPTIONS = ["Priyesh", "Shobhana", "Joint"];

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [snapshots, setSnapshots] = useState<BankAccountMonthlySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"account_name" | "bank" | "current_balance" | "interest_rate" | "updated_at">("current_balance");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<BankAccountMonthlySnapshot | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [historyAccount, setHistoryAccount] = useState<BankAccount | null>(null);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<BankAccount | null>(null);
  const [deleteSnapshotTarget, setDeleteSnapshotTarget] = useState<BankAccountMonthlySnapshot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshData() {
    try {
      setLoading(true);
      const [accounts, snapshots] = await Promise.all([
        getBankAccounts(),
        getBankAccountMonthlySnapshots(),
      ]);

      setAccounts(accounts);
      setSnapshots(snapshots);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bank accounts data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [accounts, snapshots] = await Promise.all([
          getBankAccounts(),
          getBankAccountMonthlySnapshots(),
        ]);

        if (!isMounted) {
          return;
        }

        setAccounts(accounts);
        setSnapshots(snapshots);
        setError(null);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load bank accounts data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAccounts = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const filtered = accounts.filter((account) => {
      const matchesQuery =
        !normalized ||
        `${account.bank} ${account.account_name} ${account.nickname ?? ""} ${account.owner ?? ""} ${account.masked_account_number}`
          .toLowerCase()
          .includes(normalized);

      const matchesType = typeFilter === "all" || account.account_type === typeFilter;
      const matchesStatus = statusFilter === "all" || account.status === statusFilter;

      return matchesQuery && matchesType && matchesStatus;
    });

    return [...filtered].sort((left, right) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      const valueFor = (account: BankAccount) => {
        switch (sortKey) {
          case "account_name":
            return account.account_name.toLowerCase();
          case "bank":
            return account.bank.toLowerCase();
          case "interest_rate":
            return Number(account.interest_rate ?? 0);
          case "updated_at":
            return new Date(account.updated_at).getTime();
          case "current_balance":
          default:
            return Number(account.current_balance ?? 0);
        }
      };

      const leftValue = valueFor(left);
      const rightValue = valueFor(right);

      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * multiplier;
      }

      return (Number(leftValue) - Number(rightValue)) * multiplier;
    });
  }, [accounts, query, sortDirection, sortKey, statusFilter, typeFilter]);

  const dashboardModel = useMemo(() => buildBankAccountsDashboardModel(accounts, snapshots), [accounts, snapshots]);

  const ownerOptions = OWNER_OPTIONS;

  const paginatedAccounts = useMemo(() => filteredAccounts.slice((page - 1) * pageSize, page * pageSize), [filteredAccounts, page, pageSize]);
  const historySnapshots = useMemo(
    () => (historyAccount ? snapshots.filter((snapshot) => snapshot.bank_account_id === historyAccount.id) : []),
    [historyAccount, snapshots],
  );

  async function handleCreateAccount(values: BankAccountInsert) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await createBankAccount(values);
      setAccountDialogOpen(false);
      setNotice("Bank account created successfully.");
      await refreshData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create bank account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateAccount(values: BankAccountInsert) {
    if (!editingAccount) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await updateBankAccount({ id: editingAccount.id, ...values });
      setAccountDialogOpen(false);
      setEditingAccount(null);
      setNotice("Bank account updated successfully.");
      await refreshData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update bank account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAccount(account: BankAccount) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteBankAccount(account.id);
      setDeleteAccountTarget(null);
      setNotice("Bank account deleted successfully.");
      await refreshData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete bank account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkDeleteAccounts(selectedAccounts: BankAccount[]) {
    if (selectedAccounts.length === 0) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedAccounts.length} selected bank account(s)?`);
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await Promise.all(selectedAccounts.map((account) => deleteBankAccount(account.id)));
      setNotice(`${selectedAccounts.length} bank account(s) deleted successfully.`);
      await refreshData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete selected bank accounts");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkChangeAccountStatus(selectedAccounts: BankAccount[], status: BankAccount["status"]) {
    if (selectedAccounts.length === 0) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await Promise.all(selectedAccounts.map((account) => updateBankAccount({ id: account.id, status })));
      setNotice(`Updated status for ${selectedAccounts.length} bank account(s).`);
      await refreshData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update selected bank accounts");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkChangeAccountOwner(selectedAccounts: BankAccount[], owner: string) {
    if (selectedAccounts.length === 0 || !owner.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await Promise.all(selectedAccounts.map((account) => updateBankAccount({ id: account.id, owner: owner.trim() })));
      setNotice(`Updated owner for ${selectedAccounts.length} bank account(s).`);
      await refreshData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update account owners");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSnapshot(values: BankAccountMonthlySnapshotInsert) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await createBankAccountMonthlySnapshot(values);
      setSnapshotDialogOpen(false);
      setNotice("Monthly history saved successfully.");
      await refreshData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create monthly update");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateSnapshot(values: BankAccountMonthlySnapshotInsert) {
    if (!editingSnapshot) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await updateBankAccountMonthlySnapshot({ id: editingSnapshot.id, ...values });
      setSnapshotDialogOpen(false);
      setEditingSnapshot(null);
      setNotice("Monthly history saved successfully.");
      await refreshData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update monthly snapshot");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSnapshot(snapshot: BankAccountMonthlySnapshot) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteBankAccountMonthlySnapshot(snapshot.id);
      setDeleteSnapshotTarget(null);
      setNotice("Monthly history deleted successfully.");
      await refreshData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete monthly update");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "Cash & Banking", href: "/bank-accounts" }, { label: "Bank Accounts" }]} />

        <PageToolbar>
          <PageHeader title="Bank Accounts" description="Track bank balances using month-end positions, not transaction ledgers." />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingSnapshot(null);
                setHistoryAccount(null);
                setSnapshotDialogOpen(true);
              }}
              disabled={submitting || accounts.length === 0}
            >
              Add Monthly History
            </Button>
            <Button
              onClick={() => {
                setEditingAccount(null);
                setAccountDialogOpen(true);
              }}
              disabled={submitting}
            >
              Add Bank Account
            </Button>
          </div>
        </PageToolbar>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <BankAccountsDashboard model={dashboardModel} emptyState={accounts.length === 0} />
        </ContentContainer>

        <BankAccountTable
          accounts={paginatedAccounts}
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          typeFilter={typeFilter}
          onTypeFilterChange={(value) => {
            setTypeFilter(value);
            setPage(1);
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={(nextKey, nextDirection) => {
            setSortKey(nextKey);
            setSortDirection(nextDirection);
            setPage(1);
          }}
          page={page}
          pageSize={pageSize}
          totalRows={filteredAccounts.length}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          onView={(account) => setSelectedAccount(account)}
          onOpenHistory={(account) => {
            setHistoryAccount(account);
            setHistoryDialogOpen(true);
          }}
          onEdit={(account) => {
            setEditingAccount(account);
            setAccountDialogOpen(true);
          }}
          onDelete={(account) => setDeleteAccountTarget(account)}
          onBulkDelete={handleBulkDeleteAccounts}
          onBulkChangeStatus={handleBulkChangeAccountStatus}
          onBulkChangeOwner={handleBulkChangeAccountOwner}
          ownerOptions={ownerOptions}
        />

        <ContentContainer>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Monthly Balance History</h3>
              <p className="text-sm text-slate-600">One month-end closing balance record per account and financial month</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setEditingSnapshot(null);
                setHistoryAccount(null);
                setSnapshotDialogOpen(true);
              }}
              disabled={submitting || accounts.length === 0}
            >
              Add Monthly History
            </Button>
          </div>

          {loading ? (
            <LoadingState label="Loading monthly updates..." />
          ) : (
            <BankAccountMonthlySnapshotsTable
              snapshots={snapshots}
              accounts={accounts}
              onEdit={(snapshot) => {
                setEditingSnapshot(snapshot);
                setSnapshotDialogOpen(true);
              }}
              onDelete={(snapshot) => setDeleteSnapshotTarget(snapshot)}
            />
          )}
        </ContentContainer>
      </PageContainer>

      <BankAccountDetailsDialog
        account={selectedAccount}
        open={Boolean(selectedAccount)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAccount(null);
          }
        }}
      />

      <Dialog
        open={accountDialogOpen}
        onOpenChange={(open) => {
          setAccountDialogOpen(open);
          if (!open) {
            setEditingAccount(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit bank account" : "Add bank account"}</DialogTitle>
          </DialogHeader>
          <BankAccountForm
            key={editingAccount?.id ?? "new-bank-account"}
            initialData={editingAccount}
            onSubmit={editingAccount ? handleUpdateAccount : handleCreateAccount}
            onCancel={() => {
              setAccountDialogOpen(false);
              setEditingAccount(null);
            }}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={snapshotDialogOpen}
        onOpenChange={(open) => {
          setSnapshotDialogOpen(open);
          if (!open) {
            setEditingSnapshot(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingSnapshot ? "Edit monthly history" : "Add monthly history"}</DialogTitle>
          </DialogHeader>
          <BankAccountMonthlySnapshotForm
            accounts={accounts}
            initialData={editingSnapshot}
            preselectedAccountId={historyAccount?.id ?? null}
            onSubmit={editingSnapshot ? handleUpdateSnapshot : handleCreateSnapshot}
            onCancel={() => {
              setSnapshotDialogOpen(false);
              setEditingSnapshot(null);
            }}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyDialogOpen}
        onOpenChange={(open) => {
          setHistoryDialogOpen(open);
          if (!open) {
            setHistoryAccount(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{historyAccount ? `Monthly History · ${historyAccount.bank} · ${historyAccount.nickname || historyAccount.account_name}` : "Monthly History"}</DialogTitle>
          </DialogHeader>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setEditingSnapshot(null);
                setSnapshotDialogOpen(true);
              }}
              disabled={submitting || !historyAccount}
            >
              Add Monthly History
            </Button>
          </div>

          <BankAccountMonthlySnapshotsTable
            snapshots={historySnapshots}
            accounts={accounts}
            onEdit={(snapshot) => {
              setEditingSnapshot(snapshot);
              setSnapshotDialogOpen(true);
            }}
            onDelete={(snapshot) => setDeleteSnapshotTarget(snapshot)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteAccountTarget)} onOpenChange={(open) => !open && setDeleteAccountTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete bank account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to delete this bank account?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteAccountTarget(null)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => deleteAccountTarget && handleDeleteAccount(deleteAccountTarget)} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteSnapshotTarget)} onOpenChange={(open) => !open && setDeleteSnapshotTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete monthly history</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to delete this monthly history record?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteSnapshotTarget(null)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => deleteSnapshotTarget && handleDeleteSnapshot(deleteSnapshotTarget)} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
