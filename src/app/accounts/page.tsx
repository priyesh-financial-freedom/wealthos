"use client";

import { useEffect, useMemo, useState } from "react";

import { AccountDetailsDialog } from "@/components/accounts/AccountDetailsDialog";
import { AccountForm } from "@/components/accounts/AccountForm";
import { AccountSummary } from "@/components/accounts/AccountSummary";
import { AccountTable } from "@/components/accounts/AccountTable";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { createAccount, deleteAccount, getAccounts, updateAccount } from "@/services/accounts";
import type { Account, AccountInsert } from "@/types/account";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"name" | "current_value" | "category" | "updated_at">("current_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshAccounts() {
    try {
      setLoading(true);
      const nextAccounts = await getAccounts();
      setAccounts(nextAccounts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAccounts() {
      try {
        const nextAccounts = await getAccounts();
        if (isMounted) {
          setAccounts(nextAccounts);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load accounts");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadAccounts();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = accounts.filter((account) => {
      const matchesQuery =
        !normalizedQuery ||
        `${account.name} ${account.category} ${account.institution ?? ""} ${account.owner ?? ""} ${account.notes ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesCategory = categoryFilter === "all" || account.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || account.status === statusFilter;

      return matchesQuery && matchesCategory && matchesStatus;
    });

    return [...filtered].sort((left, right) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      const getValue = (account: Account) => {
        switch (sortKey) {
          case "name":
            return account.name.toLowerCase();
          case "category":
            return account.category.toLowerCase();
          case "updated_at":
            return new Date(account.updated_at).getTime();
          case "current_value":
          default:
            return Number(account.current_value ?? 0);
        }
      };

      const leftValue = getValue(left);
      const rightValue = getValue(right);

      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * multiplier;
      }

      return (Number(leftValue) - Number(rightValue)) * multiplier;
    });
  }, [accounts, categoryFilter, query, sortDirection, sortKey, statusFilter]);

  async function handleCreate(values: AccountInsert) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await createAccount(values);
      setDialogOpen(false);
      setNotice("Account created successfully.");
      await refreshAccounts();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(values: AccountInsert) {
    if (!editingAccount) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await updateAccount({ id: editingAccount.id, ...values });
      setDialogOpen(false);
      setEditingAccount(null);
      setNotice("Account updated successfully.");
      await refreshAccounts();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(account: Account) {
    setError(null);
    setNotice(null);

    try {
      await deleteAccount(account.id);
      setDeleteTarget(null);
      setNotice("Account deleted successfully.");
      await refreshAccounts();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete account");
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Accounts"
            description="Master catalog for all financial accounts across assets, investments, liabilities, and insurance."
          />
          <Button
            onClick={() => {
              setEditingAccount(null);
              setDialogOpen(true);
            }}
            disabled={submitting}
          >
            Add Account
          </Button>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
        ) : null}

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <AccountSummary accounts={filteredAccounts} />

        <DashboardCard>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Accounts portfolio</h3>
              <p className="text-sm text-slate-600">Search, filter, sort, and manage your complete account universe</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search accounts"
                className="max-w-sm"
              />
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">All categories</option>
                <option value="Bank Account">Bank Account</option>
                <option value="Investment">Investment</option>
                <option value="Retirement">Retirement</option>
                <option value="Fixed Income">Fixed Income</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Vehicle">Vehicle</option>
                <option value="Precious Metals">Precious Metals</option>
                <option value="Liability">Liability</option>
                <option value="Insurance">Insurance</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Other">Other</option>
              </select>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={`${sortKey}:${sortDirection}`}
                onChange={(event) => {
                  const [nextKey, nextDirection] = event.target.value.split(":") as [typeof sortKey, typeof sortDirection];
                  setSortKey(nextKey);
                  setSortDirection(nextDirection);
                }}
              >
                <option value="current_value:desc">Current Value (High-Low)</option>
                <option value="current_value:asc">Current Value (Low-High)</option>
                <option value="name:asc">Name (A-Z)</option>
                <option value="name:desc">Name (Z-A)</option>
                <option value="category:asc">Category (A-Z)</option>
                <option value="category:desc">Category (Z-A)</option>
                <option value="updated_at:desc">Updated (Newest)</option>
                <option value="updated_at:asc">Updated (Oldest)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner label="Loading accounts..." />
          ) : filteredAccounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <h4 className="text-base font-semibold text-slate-900">No accounts yet</h4>
              <p className="mt-2 text-sm text-slate-600">
                Add your first account to build a complete top-level catalog for all financial items.
              </p>
            </div>
          ) : (
            <AccountTable
              accounts={filteredAccounts}
              onView={(account) => setSelectedAccount(account)}
              onEdit={(account) => {
                setEditingAccount(account);
                setDialogOpen(true);
              }}
              onDelete={(account) => setDeleteTarget(account)}
            />
          )}
        </DashboardCard>
      </PageContainer>

      <AccountDetailsDialog
        account={selectedAccount}
        open={Boolean(selectedAccount)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAccount(null);
          }
        }}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingAccount(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit account" : "Add account"}</DialogTitle>
          </DialogHeader>
          <AccountForm
            key={editingAccount?.id ?? "new-account"}
            initialData={editingAccount}
            onSubmit={editingAccount ? handleUpdate : handleCreate}
            onCancel={() => {
              setDialogOpen(false);
              setEditingAccount(null);
            }}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this account?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={submitting}
            >
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
